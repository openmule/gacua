/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Config,
  type ToolCallRequestInfo,
  executeToolCall,
  type ContentGenerator,
} from '@gacua/gemini-cli-core';
import {
  type Content,
  type Part,
  GenerateContentResponse,
} from '@google/genai';
import type {
  SessionStatus,
  ToolReviewRequest,
  ToolReviewChoice,
  FunctionCall as StrictFunctionCall,
  StreamMessage,
  ToolReviewResponse,
} from '@gacua/shared';
import { takeScreenshot, cropScreenshot, imageToPart } from './screen.js';
import {
  getValidComputerTool,
  getComputerFunctionDeclarations,
} from './tool-computer/index.js';
import pino from 'pino';

export type AgentInput =
  | string
  | {
      functionCall: StrictFunctionCall;
      originalFunctionCall: StrictFunctionCall;
      response: ToolReviewChoice;
    }[];

export type AgentPersistMessage = {
  role: 'user' | 'model' | 'tool' | 'workflow' | 'grounding_model';
  parts: (Part | { imageFileName: string })[];
  toolReview?: ToolReviewRequest | ToolReviewResponse;
  forDisplay?: boolean;
};

function getResponseText(
  response: GenerateContentResponse,
): { text?: string; thought?: string } | null {
  if (response.candidates && response.candidates.length > 0) {
    const candidate = response.candidates[0];
    if (
      candidate.content &&
      candidate.content.parts &&
      candidate.content.parts.length > 0
    ) {
      let mergedText = '';
      let thought = false;
      for (const part of candidate.content.parts) {
        if (part.text) {
          mergedText += part.text;
        }
        if (part.thought) {
          thought = true;
        }
      }
      return thought ? { thought: mergedText } : { text: mergedText };
    }
  }
  return null;
}

async function detectElement(
  imagePart: Part,
  elementDescription: string,
  contentGenerator: ContentGenerator,
  processStreamResponse: (
    role: 'grounding_model',
    responseStream: AsyncGenerator<GenerateContentResponse>,
    forDisplay: true,
    logger: pino.Logger,
  ) => Promise<{ thought: string; output: string }>,
  logger: pino.Logger,
) {
  logger.debug({ elementDescription }, 'Starting element detection');

  const prompt = elementDescription;
  const responseStream = await contentGenerator.generateContentStream(
    {
      model: 'gemini-2.5-pro',
      contents: [imagePart, { text: prompt }],
      config: {
        systemInstruction: `You are a UI grounding agent.
Given an image and a text description, find the described UI element.
Return the element's bounding box as [ymin, xmin, ymax, xmax], normalized to a 0-1000 scale. Depending on the action, the center of the box may need to be on an interactable part of the element.
The box_2d should be [ymin, xmin, ymax, xmax] normalized to 0-1000.
`,
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          properties: {
            box_2d: {
              type: 'array',
              items: { type: 'number' },
              minItems: 4,
              maxItems: 4,
            },
            label: {
              type: 'string',
            },
          },
          required: ['box_2d'],
        },
        temperature: 0.0,
        thinkingConfig: {
          includeThoughts: true,
          thinkingBudget: 256,
        },
      },
    },
    '',
  );

  const { output } = await processStreamResponse(
    'grounding_model',
    responseStream,
    true,
    logger,
  );
  if (!output) {
    logger.error(
      { elementDescription },
      'No response text from grounding model',
    );
    throw new Error('No response text');
  }

  const boundingBoxData = JSON.parse(output);
  const box2d = Array.isArray(boundingBoxData)
    ? boundingBoxData[0].box_2d
    : boundingBoxData.box_2d;

  if (!Array.isArray(box2d) || box2d.length !== 4) {
    logger.error(
      { elementDescription, box2d },
      'Invalid box_2d format from grounding model',
    );
    throw new Error(
      `Invalid box_2d format: expected array of 4 numbers, got ${box2d}`,
    );
  }

  const [ymin, xmin, ymax, xmax] = box2d.map((coord: unknown) => {
    const intCoord = parseInt(String(coord));
    if (isNaN(intCoord) || intCoord < 0 || intCoord > 1000) {
      logger.error({ elementDescription, coord }, 'Invalid coordinate value');
      throw new Error(`Invalid coordinate value: ${coord} (must be 0-1000)`);
    }
    return intCoord;
  });

  if (ymin >= ymax || xmin >= xmax) {
    logger.error(
      { elementDescription, ymin, xmin, ymax, xmax },
      'Invalid bounding box',
    );
    throw new Error(
      `Invalid bounding box: ymin(${ymin}) >= ymax(${ymax}) or xmin(${xmin}) >= xmax(${xmax})`,
    );
  }

  logger.debug(
    { elementDescription, boundingBox: { ymin, xmin, ymax, xmax } },
    'Element detection completed successfully',
  );
  return { ymin, xmin, ymax, xmax };
}

class ContextManager {
  private history: Content[] = [];

  constructor(initialHistory: Content[] = []) {
    this.history = this.mergeAdjacentMessages(initialHistory);
  }

  private mergeAdjacentMessages(messages: Content[]): Content[] {
    if (messages.length === 0) return [];

    const merged: Content[] = [];
    let current = messages[0];
    for (let i = 1; i < messages.length; i++) {
      const next = messages[i];
      if (next.role === current.role) {
        current.parts = [...current.parts!, ...next.parts!];
      } else {
        merged.push(current);
        current = next;
      }
    }

    merged.push(current);
    return merged;
  }

  appendContent(content: Content): ContextManager {
    if (
      this.history.length > 0 &&
      this.history[this.history.length - 1].role === content.role
    ) {
      const lastMessage = this.history[this.history.length - 1];
      lastMessage.parts = [...lastMessage.parts!, ...content.parts!];
    } else {
      this.history.push(content);
    }
    return this;
  }

  getHistory(): Content[] {
    return this.history;
  }
}

export async function runAgent(
  config: Config,
  historyMessages: Content[],
  input: AgentInput,
  allowedTools: string[],
  setSessionStatus: (status: SessionStatus, message?: string) => Promise<void>,
  streamMessage: (message: StreamMessage) => void,
  saveImage: (imageBuffer: Buffer, nameSuffix: string) => Promise<string>,
  persistMessage: (message: AgentPersistMessage) => Promise<void>,
  logger: pino.Logger,
): Promise<void> {
  logger.info(
    {
      historyMessageCount: historyMessages.length,
      inputType: typeof input === 'string' ? 'text' : 'tool_responses',
      allowedToolsCount: allowedTools.length,
    },
    'Starting agent run',
  );

  const contentGenerator = config.getGeminiClient().getContentGenerator();
  const abortController = new AbortController();
  const toolRegistry = await config.getToolRegistry();
  const toolComputer = toolRegistry.getTool('.computer');
  if (!toolComputer) {
    throw new Error('Core tool .computer not found in registry');
  }

  function forgeToolResponse(
    response: { output: string } | { error: string },
    functionCall: StrictFunctionCall,
    originalFunctionCall?: StrictFunctionCall,
  ): Part {
    if (!functionCall.id) {
      throw new Error('Function call id is required in tool response');
    }
    return {
      functionResponse: {
        id: originalFunctionCall?.id ?? functionCall.id,
        name: originalFunctionCall?.name ?? functionCall.name,
        response,
      },
    };
  }

  async function executeToolGetPart(
    functionCall: StrictFunctionCall,
    originalFunctionCall?: StrictFunctionCall,
  ): Promise<Part> {
    const requestInfo: ToolCallRequestInfo = {
      callId: functionCall.id,
      name: functionCall.name,
      args: functionCall.args,
      isClientInitiated: false,
      prompt_id: '',
    };

    const result = await executeToolCall(
      config,
      requestInfo,
      toolRegistry,
      abortController.signal,
    );

    const parseResult = () => {
      const parts = Array.isArray(result.responseParts)
        ? result.responseParts
        : [result.responseParts];
      return parts
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          } else if (part.text) {
            return part.text;
          } else if (part.functionResponse?.response?.['output']) {
            return part.functionResponse.response['output'];
          } else {
            throw new Error('Unsupported tool response part: ' + part);
          }
        })
        .join('\n');
    };

    const response = result.error
      ? { error: result.error.message }
      : {
          output: parseResult(),
        };

    return forgeToolResponse(response, functionCall, originalFunctionCall);
  }

  let currentParts: Part[];
  if (typeof input === 'string') {
    currentParts = [{ text: input }];
    await persistMessage({
      role: 'user',
      parts: currentParts,
    });
  } else {
    currentParts = [];
    for (const { functionCall, originalFunctionCall, response } of input) {
      if (response === 'reject_once') {
        const toolRejectPart = forgeToolResponse(
          { error: 'Rejected by user' },
          functionCall,
          originalFunctionCall,
        );
        await persistMessage({
          role: 'tool',
          parts: [toolRejectPart],
          forDisplay: false,
        });
        currentParts.push(toolRejectPart);
      } else {
        // response === 'accept_once' || response === 'accept_session'
        const toolResultPart = await executeToolGetPart(
          functionCall,
          originalFunctionCall,
        );
        await persistMessage({
          role: 'tool',
          parts: [toolResultPart],
        });
        currentParts.push(toolResultPart);
      }
    }
    if (input.every(({ response }) => response === 'reject_once')) {
      setSessionStatus('stagnant', 'User rejected all tool calls.');
      return;
    }
  }

  async function processStreamResponse(
    role: 'model' | 'grounding_model',
    responseStream: AsyncGenerator<GenerateContentResponse>,
    forDisplay: boolean | undefined,
    logger: pino.Logger,
  ) {
    let thought = '';
    let output = '';
    const functionCalls: StrictFunctionCall[] = [];
    for await (const resp of responseStream) {
      logger.debug({ resp }, 'Received raw response');
      if (abortController.signal.aborted) {
        throw new Error('Operation cancelled.');
      }
      const textPart = getResponseText(resp);
      if (textPart) {
        streamMessage({ role, ...textPart });
        thought += textPart.thought || '';
        output += textPart.text || '';
      }
      if (resp.functionCalls) {
        functionCalls.push(
          ...resp.functionCalls.map((fc) => ({
            id:
              fc.id ??
              `${fc.name}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            name: fc.name!,
            args: fc.args!,
          })),
        );
      }
    }

    // Only persist message if there's actual content.
    if (output || functionCalls.length > 0) {
      await persistMessage({
        role,
        parts: [
          ...(thought ? [{ text: thought, thought: true }] : []),
          ...(output ? [{ text: output }] : []),
          ...functionCalls.map((fc) => ({ functionCall: fc })),
        ],
        forDisplay,
      });
    }

    return { thought, output, functionCalls };
  }

  const contextManager = new ContextManager(historyMessages);
  let turnCount = 0;
  try {
    while (true) {
      turnCount++;
      setSessionStatus('running', 'Turn ' + turnCount);
      const turnLogger = logger.child({ turnCount });

      turnLogger.debug('Taking screenshot');
      const screenshot = await takeScreenshot(
        (
          await toolComputer.buildAndExecute(
            { action: 'screenshot' },
            abortController.signal,
          )
        ).llmContent,
      );
      const screenshotDescription = `Screenshot at ${new Date().toLocaleString()}:`;
      await persistMessage({
        role: 'workflow',
        parts: [
          { text: screenshotDescription },
          { imageFileName: await saveImage(screenshot.buffer, 'screenshot') },
        ],
        forDisplay: true,
      });

      turnLogger.debug('Cropping screenshot');
      const croppedScreenshotsData = await Promise.all(
        (await cropScreenshot(screenshot)).map(
          async ({ image, nameSuffix }) => ({
            imageFileName: await saveImage(image.buffer, nameSuffix),
            imagePart: imageToPart(image),
          }),
        ),
      );
      await persistMessage({
        role: 'workflow',
        parts: [
          { text: screenshotDescription },
          ...croppedScreenshotsData.map(({ imageFileName }) => ({
            imageFileName,
          })),
        ],
        forDisplay: false,
      });
      currentParts.push(
        { text: screenshotDescription },
        ...croppedScreenshotsData.map(({ imagePart }) => imagePart),
      );

      turnLogger.debug('Planning next step');
      let functionCalls: StrictFunctionCall[] = [];

      async function planNextStep(extraPrompt?: string): Promise<boolean> {
        const userParts = currentParts;
        if (extraPrompt) {
          userParts.push({ text: extraPrompt });
        }

        const requestContents = contextManager
          .appendContent({
            role: 'user',
            parts: userParts,
          })
          .getHistory();

        const responseStream = await contentGenerator.generateContentStream(
          {
            model: config.getModel(),
            contents: requestContents,
            config: {
              abortSignal: abortController.signal,
              tools: [
                { functionDeclarations: getComputerFunctionDeclarations() },
              ],
              temperature: 0.2,
              thinkingConfig: {
                includeThoughts: true,
              },
            },
          },
          '',
        );

        const result = await processStreamResponse(
          'model',
          responseStream,
          undefined,
          turnLogger,
        );

        if (result.output || result.functionCalls.length > 0) {
          contextManager.appendContent({
            role: 'model',
            parts: [
              ...(result.output ? [{ text: result.output }] : []),
              ...result.functionCalls.map((fc) => ({ functionCall: fc })),
            ],
          });
          functionCalls = result.functionCalls;
          return true;
        }

        return false;
      }

      if (!(await planNextStep())) {
        turnLogger.warn('Empty response from model, retrying with "continue"');
        if (!(await planNextStep('continue'))) {
          setSessionStatus(
            'error',
            'Model returned empty response even after retry.',
          );
        }
      }

      if (functionCalls.length > 0) {
        turnLogger.debug(
          { functionCallCount: functionCalls.length },
          'Processing function calls',
        );

        const toolResponseParts: Part[] = [];
        let pending = false;
        const toolReviewMessages: AgentPersistMessage[] = [];
        // If any function call needs review, all others will be delayed.
        const delayedFunctionCalls: {
          functionCall: StrictFunctionCall;
          originalFunctionCall: StrictFunctionCall;
        }[] = [];

        for (const fc of functionCalls) {
          const originalFunctionCall: StrictFunctionCall = {
            id: fc.id ?? `${fc.name}-${Date.now()}`,
            name: fc.name!,
            args: fc.args!,
          };
          const id = originalFunctionCall.id;
          const functionCallLogger = turnLogger.child({ id });
          functionCallLogger.info(
            { originalFunctionCall },
            'Processing function call',
          );

          let functionCall = originalFunctionCall;
          if (functionCall.name.startsWith('computer_')) {
            functionCallLogger.debug('Processing computer tool call');

            const groundableTool = getValidComputerTool(
              originalFunctionCall.name,
              originalFunctionCall.args,
            );
            if (typeof groundableTool === 'string') {
              functionCallLogger.warn(
                {
                  groundingError: groundableTool,
                },
                'Validation failed',
              );
              toolResponseParts.push(
                forgeToolResponse(
                  { error: groundableTool },
                  functionCall,
                  originalFunctionCall,
                ),
              );
              continue;
            }

            const groundedToolCall = await groundableTool.ground(
              originalFunctionCall.args,
              screenshot,
              croppedScreenshotsData,
              (imagePart: Part, elementDescription: string) =>
                detectElement(
                  imagePart,
                  elementDescription,
                  contentGenerator,
                  processStreamResponse,
                  functionCallLogger,
                ),
            );
            if (typeof groundedToolCall === 'string') {
              functionCallLogger.warn(
                {
                  groundingError: groundedToolCall,
                },
                'Grounding process failed',
              );
              toolResponseParts.push(
                forgeToolResponse(
                  {
                    error: 'Error during grounding: ' + groundedToolCall,
                  },
                  functionCall,
                  originalFunctionCall,
                ),
              );
              continue;
            }

            functionCall = {
              ...groundedToolCall.value(),
              id: originalFunctionCall.id,
            };
            const toolCallDescription =
              await groundedToolCall.getDescription(saveImage);
            toolReviewMessages.push({
              role: 'workflow',
              parts: toolCallDescription,
              toolReview: {
                reviewId: id,
                functionCall,
                originalFunctionCall,
              },
              forDisplay: true,
            });

            if (allowedTools.includes(originalFunctionCall.name)) {
              functionCallLogger.info('Tool auto-accepted, executing directly');
              toolReviewMessages.push({
                role: 'user',
                parts: [],
                toolReview: {
                  reviewId: id,
                  choice: 'accept_session',
                },
                forDisplay: true,
              });
              delayedFunctionCalls.push({ functionCall, originalFunctionCall });
            } else {
              pending = true;
            }

            // Computer function calls are either pending or delayed.
            continue;
          }

          // Non-computer function calls, we do not care their execution order.
          toolResponseParts.push(
            await executeToolGetPart(functionCall, originalFunctionCall),
          );
        }

        // 1. Display executed tool call responses if any.
        if (toolResponseParts.length > 0) {
          await persistMessage({
            role: 'tool',
            parts: toolResponseParts,
          });
        }

        // 2. Display tool call reviews if any.
        for (const message of toolReviewMessages) {
          await persistMessage(message);
        }

        // 3. If not pending, execute and display delayed function calls if any.
        if (!pending) {
          const delayedToolResponseParts = [];
          for await (const part of delayedFunctionCalls.map(
            async ({ functionCall, originalFunctionCall }) =>
              await executeToolGetPart(functionCall, originalFunctionCall),
          )) {
            delayedToolResponseParts.push(part);
          }
          persistMessage({
            role: 'tool',
            parts: delayedToolResponseParts,
          });
          toolResponseParts.push(...delayedToolResponseParts);
        }

        if (pending) {
          turnLogger.info('Session paused for tool review');
          setSessionStatus('pending', 'Tool call pending.');
          break;
        }

        currentParts = toolResponseParts;
      } else {
        const message = 'No more tool calls from model.';
        turnLogger.info(message);
        setSessionStatus('stagnant', message);
        break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ turnCount, error, message }, 'Agent execution failed');
    setSessionStatus('error', message);
  } finally {
    logger.info({ turnCount }, 'Agent run completed');
  }
}
