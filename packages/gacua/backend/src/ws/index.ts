/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import { Server } from 'http';
import { WebSocketServer } from 'ws';
import { URL } from 'url';
import { randomUUID } from 'crypto';
import type { IncomingMessage } from 'http';

import { handleMessage } from './handle-message.js';
import { validateTokenString } from '../auth/token.js';
import { logger } from '../logger.js';

const wsLogger = logger.child({ module: 'websocket' });

export function setupWebSocketServer(server: Server) {
  wsLogger.info('Setting up WebSocket server');
  const wss = new WebSocketServer({
    server,
    verifyClient: (info: {
      origin: string;
      secure: boolean;
      req: IncomingMessage;
    }) => {
      const url = new URL(
        info.req.url || '',
        `http://${info.req.headers.host}`,
      );
      const token = url.searchParams.get('token');

      wsLogger.debug(
        {
          origin: info.origin,
          userAgent: info.req.headers['user-agent'],
          remoteAddress: info.req.socket.remoteAddress,
        },
        'WebSocket connection attempt',
      );

      if (!validateTokenString(token || '')) {
        wsLogger.warn(
          {
            origin: info.origin,
            remoteAddress: info.req.socket.remoteAddress,
            hasToken: !!token,
          },
          'WebSocket connection rejected: Invalid or missing token',
        );
        return false;
      }

      wsLogger.debug(
        { origin: info.origin },
        'WebSocket token validation successful',
      );
      return true;
    },
  });

  let connectionCounter = 0;
  const wsConnections = new Map();

  wss.on('connection', (ws, req) => {
    const connectionId = `ws-${connectionCounter++}-${randomUUID()}`;
    const connectionLogger = wsLogger.child({ connectionId });

    wsConnections.set(ws, { connectionId, logger: connectionLogger });

    connectionLogger.info(
      {
        remoteAddress: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
      },
      'WebSocket connection established',
    );

    ws.on('message', async (message) => {
      connectionLogger.debug('Received WebSocket message');

      try {
        await handleMessage(ws, message);
        connectionLogger.debug('WebSocket message handled successfully');
      } catch (error) {
        connectionLogger.error(
          { err: error },
          'Failed to handle WebSocket message',
        );
      }
    });

    ws.on('close', (code, reason) => {
      connectionLogger.info(
        {
          closeCode: code,
          closeReason: reason?.toString(),
        },
        'WebSocket connection closed',
      );
      wsConnections.delete(ws);
    });

    ws.on('error', (error) => {
      connectionLogger.error({ err: error }, 'WebSocket connection error');
    });

    ws.on('pong', () => {
      connectionLogger.debug('Received WebSocket pong');
    });
  });

  wsLogger.info('WebSocket server setup completed');
}
