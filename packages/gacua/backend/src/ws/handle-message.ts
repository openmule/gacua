/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import { WebSocket } from 'ws';

import { runComputerUseAgent } from '../services/computer-use/index.js';
import type {
  SessionStatusEvent,
  ClientRequest,
  ServerEvent,
  ToolReviewResponse,
} from '@gacua/shared';
import { logger } from '../logger.js';

const messageHandlerLogger = logger.child({
  module: 'websocket-message-handler',
});

export async function handleMessage(ws: WebSocket, message: WebSocket.RawData) {
  let sessionId = 'unknown';
  let messageType = 'unknown';

  try {
    const data: ClientRequest = JSON.parse(message.toString());
    sessionId = data.sessionId;
    messageType = data.type;

    const handlerLogger = messageHandlerLogger.child({
      sessionId,
      messageType,
    });

    let input: string | ToolReviewResponse;
    let model: string | undefined;

    if (data.type === 'tool_review') {
      input = data.payload;
      handlerLogger.info({ input }, 'Tool review message received');
    } else {
      // data.type === 'user_input'
      input = data.payload.input;
      model = data.payload.model;
      handlerLogger.info({ model, input }, 'User input message received');
    }

    await runComputerUseAgent(sessionId, input, model, (event: ServerEvent) => {
      const eventString = JSON.stringify(event);
      handlerLogger.debug(
        {
          eventType: event.type,
          eventPayloadSize: eventString.length,
        },
        'Sending event to WebSocket client',
      );
      ws.send(eventString);
    });

    handlerLogger.debug('WebSocket message processed successfully');
  } catch (error) {
    messageHandlerLogger.error(
      {
        sessionId,
        messageType,
        err: error,
      },
      'WebSocket message handling error',
    );

    const sessionErrorEvent: SessionStatusEvent = {
      type: 'session_status',
      sessionId,
      payload: {
        status: 'error',
        message: `Internal server error: ${error}`,
      },
    };

    try {
      ws.send(JSON.stringify(sessionErrorEvent));
      messageHandlerLogger.debug(
        { sessionId },
        'Error response sent to WebSocket client',
      );
    } catch (sendError) {
      messageHandlerLogger.error(
        {
          sessionId,
          err: sendError,
        },
        'Failed to send error response to WebSocket client',
      );
    }
  }
}
