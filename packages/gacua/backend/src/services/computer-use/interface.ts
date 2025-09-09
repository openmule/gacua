/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Part } from '@google/genai';
import { AuthType, Config, ApprovalMode } from '@gacua/gemini-cli-core';
import { getAuthType } from '../../auth/gemini.js';
import {
  type AgentInput,
  type AgentPersistMessage,
  runAgent,
} from './agent.js';
import { sessionRepository } from '../../repository/index.js';
import { logger } from '../../logger.js';
import type {
  ServerEvent,
  SessionStatus,
  StreamMessage,
  PersistentMessageContentBlock,
  FunctionCall,
  FunctionResponse,
  ToolReviewRequest,
  ToolReviewResponse,
} from '@gacua/shared';

const agentInterfaceLogger = logger.child({ module: 'agent-interface' });

export async function prepareComputerUseConfig(
  sessionId: string,
  model: string,
): Promise<Config> {
  agentInterfaceLogger.info(
    { sessionId, model },
    'Preparing computer use config',
  );

  const authType = getAuthType();
  if (!authType || !Object.values(AuthType).includes(authType)) {
    const errorMessage = `Invalid authType: ${authType}. Valid options are: ${Object.values(AuthType).join(', ')}`;
    agentInterfaceLogger.error({ authType }, errorMessage);
    throw new Error(errorMessage);
  }

  const config = new Config({
    sessionId,
    targetDir: process.cwd(), // This is not used, let it be the current working directory.
    debugMode: false,
    coreTools: [],
    mcpServers: {
      '.computer': {
        httpUrl: process.env['GACUA_MCP_COMPUTER_URL'],
      },
    },
    approvalMode: ApprovalMode.YOLO,
    cwd: process.cwd(),
    model,
  });

  await config.initialize();
  await config.refreshAuth(authType);

  agentInterfaceLogger.info(
    { sessionId },
    'Computer use config prepared successfully',
  );
  return config;
}

async function persistentContentBlockToPart(
  block: PersistentMessageContentBlock,
  sessionId: string,
): Promise<Part> {
  if ('thought' in block) {
    return { text: block.thought, thought: true };
  }
  if ('text' in block) {
    return { text: block.text };
  }
  if ('functionCall' in block) {
    return { functionCall: block.functionCall };
  }
  if ('functionResponse' in block) {
    return { functionResponse: block.functionResponse };
  }
  if ('image' in block && block.image.src.startsWith('internal://')) {
    const [imageSessionId, fileName] = block.image.src.slice(11).split('/');
    if (imageSessionId !== sessionId) {
      throw new Error(
        `Image session ID does not match: ${imageSessionId} !== ${sessionId}`,
      );
    }
    return {
      inlineData: {
        data: (
          await sessionRepository.getImage(imageSessionId, fileName)
        ).toString('base64'),
        mimeType: 'image/png',
      },
    };
  }
  throw new Error('Not implemented');
}

function partToPersistentContentBlock(
  part: Part,
): PersistentMessageContentBlock {
  if (part.thought) {
    if (part.functionCall) {
      throw new Error('If thought included, functionCall must be empty');
    }
    if (!part.text) {
      throw new Error('If thought included, text must be included');
    }
    return { thought: part.text };
  }
  if (part.text) {
    if (part.functionCall) {
      throw new Error('If text included, functionCall must be empty');
    }
    return { text: part.text };
  }
  if (part.functionCall) {
    return {
      functionCall: part.functionCall as FunctionCall,
    };
  }
  if (part.functionResponse) {
    return { functionResponse: part.functionResponse as FunctionResponse };
  }
  throw new Error('Either thought, text, or functionCall must be included');
}

async function recoverHistory(sessionId: string) {
  const persistentMessages = await sessionRepository.getMessages(
    sessionId,
    true,
  );

  const getHistoryMessages = async () =>
    await Promise.all(
      persistentMessages
        .filter((message) => message.forDisplay !== true)
        .map(async (message) => ({
          role: message.role === 'model' ? 'model' : 'user',
          parts: await Promise.all(
            message.content.map(async (block) => {
              return persistentContentBlockToPart(block, sessionId);
            }),
          ),
        })),
    );

  const toolReviewRequests: ToolReviewRequest[] = [];
  const toolReviewResponses: ToolReviewResponse[] = [];
  for (let i = persistentMessages.length - 1; i >= 0; i--) {
    const persistentMessage = persistentMessages[i];
    if (persistentMessage.role === 'tool') {
      // Tool messages exist between tool reviews.
      continue;
    }
    if (!persistentMessage.toolReview) {
      break;
    }
    const toolReview = persistentMessage.toolReview;
    if ('functionCall' in toolReview) {
      toolReviewRequests.unshift(toolReview);
    } else {
      toolReviewResponses.unshift(toolReview);
    }
  }

  return { getHistoryMessages, toolReviewRequests, toolReviewResponses };
}

export async function runComputerUseAgent(
  sessionId: string,
  input: string | ToolReviewResponse,
  model?: string,
  emitEvent?: (event: ServerEvent) => void,
) {
  const setSessionStatus = async (status: SessionStatus, message?: string) => {
    await sessionRepository.updateSession(sessionId, {
      status,
      statusMessage: message,
    });
    emitEvent?.({
      type: 'session_status',
      sessionId,
      payload: { status, message },
    });
  };

  const streamMessage = async (message: StreamMessage) => {
    emitEvent?.({
      type: 'stream_message',
      sessionId,
      payload: message,
    });
  };

  const saveImage = async (imageBuffer: Buffer, nameSuffix: string) => {
    const fileName = `${new Date().toISOString().replace(/[:.]/g, '-')}_${nameSuffix}.png`;
    await sessionRepository.saveImage(imageBuffer, sessionId, fileName);
    return fileName;
  };

  const persistMessage = async (message: AgentPersistMessage) => {
    const persistentMessage = {
      id: Date.now().toString(),
      role: message.role,
      content: message.parts.map((part) => {
        if ('imageFileName' in part) {
          return {
            image: {
              src: `internal://${sessionId}/${part.imageFileName}`,
            },
          };
        }
        return partToPersistentContentBlock(part);
      }),
      toolReview: message.toolReview,
      forDisplay: message.forDisplay,
      timestamp: new Date(),
    };
    await sessionRepository.appendMessages(sessionId, [persistentMessage]);
    if (message.forDisplay !== false) {
      emitEvent?.({
        type: 'persistent_message',
        sessionId,
        payload: {
          ...persistentMessage,
          timestamp: persistentMessage.timestamp.toISOString(),
        },
      });
    }
  };

  const agentLogger = logger.child({ module: 'agent', sessionId });

  const { getHistoryMessages, toolReviewRequests, toolReviewResponses } =
    await recoverHistory(sessionId);

  let agentInput: AgentInput;
  const sessionAcceptedTools =
    (await sessionRepository.getSession(sessionId)).acceptedTools || [];

  if (typeof input !== 'string') {
    if (!toolReviewRequests.find((r) => r.reviewId === input.reviewId)) {
      throw new Error(
        `Can not find the corresponding tool review request for reviewId: ${input.reviewId}`,
      );
    }
    if (toolReviewResponses.find((r) => r.reviewId === input.reviewId)) {
      throw new Error(
        `The tool review response for reviewId: ${input.reviewId} already exists`,
      );
    }

    toolReviewResponses.push(input);
    await persistMessage({
      role: 'user',
      parts: [],
      toolReview: input,
      forDisplay: true,
    });

    if (toolReviewResponses.length < toolReviewRequests.length) {
      return;
    }

    const newSessionAcceptedTools: string[] = [];
    const processedResponses = toolReviewRequests.map((request) => {
      const response = toolReviewResponses.find(
        (response) => response.reviewId === request.reviewId,
      );
      if (!response) {
        throw new Error(
          `Can not find the corresponding tool review response for reviewId: ${request.reviewId}`,
        );
      }

      if (response.choice === 'accept_session') {
        if (sessionAcceptedTools.includes(request.originalFunctionCall.name)) {
          throw new Error(
            `Function ${request.originalFunctionCall.name} is already accepted in this session`,
          );
        }
        newSessionAcceptedTools.push(request.originalFunctionCall.name);
      }

      return { ...request, response: response.choice };
    });

    if (newSessionAcceptedTools.length > 0) {
      sessionAcceptedTools.push(...newSessionAcceptedTools);
      await sessionRepository.updateSession(sessionId, {
        acceptedTools: sessionAcceptedTools,
      });
    }

    agentInput = processedResponses;
  } else {
    if (toolReviewResponses.length < toolReviewRequests.length) {
      throw new Error(
        `Input is not allowed when there are pending tool review requests`,
      );
    }

    agentInput = input;
  }

  const config = await prepareComputerUseConfig(
    sessionId,
    model ?? (await sessionRepository.getSession(sessionId)).model,
  );
  const historyMessages = await getHistoryMessages();

  try {
    await runAgent(
      config,
      historyMessages,
      agentInput,
      sessionAcceptedTools,
      setSessionStatus,
      streamMessage,
      saveImage,
      persistMessage,
      agentLogger,
    );
  } catch (error) {
    agentInterfaceLogger.error({ error }, 'Internal error while running agent');
    setSessionStatus(
      'error',
      error instanceof Error ? error.message : String(error),
    );
  }
}
