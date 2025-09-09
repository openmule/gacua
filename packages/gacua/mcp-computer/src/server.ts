/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  isInitializeRequest,
  TextContent,
  ImageContent,
} from '@modelcontextprotocol/sdk/types.js';
import { computerToolInputSchema, computerToolArgs } from './types';
import { executeComputerAction } from './actions';

const app = express();
app.use(express.json({ limit: '50mb' }));

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        transports[sessionId] = transport;
      },
      enableDnsRebindingProtection: false,
    });

    let pingIntervalId: NodeJS.Timeout | undefined = undefined;
    const PING_INTERVAL_MS = 180000;

    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId];
      }
      if (pingIntervalId) {
        clearInterval(pingIntervalId);
        console.log(
          `[${transport.sessionId}] SSE connection closed. Stopped pinging.`,
        );
      }
    };

    pingIntervalId = setInterval(() => {
      // An SSE message that starts with a colon is a comment and is ignored
      // by the client's EventSource API. It serves only as network traffic
      // to keep the connection alive.
      res.write(':ping\n\n');
      console.log(`[${transport.sessionId}] Sent SSE keep-alive ping.`);
    }, PING_INTERVAL_MS);

    const server = new McpServer({
      name: 'computer-tool-server',
      version: '1.0.0',
    });

    server.registerTool(
      '.computer',
      {
        inputSchema: computerToolInputSchema.shape,
      },
      async (args) => {
        try {
          const result = await executeComputerAction(args as computerToolArgs);
          const content: (TextContent | ImageContent)[] = [];

          if (typeof result === 'string') {
            content.push({ type: 'text', text: result });
          } else {
            const base64String = result.toString('base64');
            content.push({
              type: 'image',
              data: base64String,
              mimeType: 'image/png',
            });
          }

          return { content };
        } catch (error: unknown) {
          console.error('Error executing tool:', error);
          const errorMessage =
            error instanceof Error ? error.message : `${error}`;
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Error calling computer tool: ${errorMessage}`,
              },
            ],
          };
        }
      },
    );

    await server.connect(transport);
  } else {
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

const handleSessionRequest = async (
  req: express.Request,
  res: express.Response,
) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Invalid or missing session ID',
      },
      id: null,
    });
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
};

app.get('/mcp', handleSessionRequest);
app.delete('/mcp', handleSessionRequest);

export function startServer(port: number = 10001, host: string = '0.0.0.0') {
  app.listen(port, host, () => {
    console.log(`MCP Server for '.computer' tool listening on ${host}:${port}`);
  });
}
