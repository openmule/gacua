/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { pinoHttp } from 'pino-http';
import type { CreateSessionRequest } from '@gacua/shared';
import qrcode from 'qrcode-terminal';
import sanitize from 'sanitize-filename';

import { logger } from './logger.js';
import { setupWebSocketServer } from './ws/index.js';
import { sessionManager } from './services/session/index.js';
import { sessionRepository } from './repository/index.js';
import {
  regenerateToken,
  validateTokenString,
  getAccessToken,
} from './auth/token.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env['PORT'] || 3000;

function validateToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const token = req.query['token'] as string;

  if (!validateTokenString(token)) {
    logger.warn(
      {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
      'Invalid token attempt',
    );
    res.status(403).json({ error: 'Invalid or missing access token' });
    return;
  }
  next();
}

const app = express();
const server = createServer(app);

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => {
      return (
        req.get('x-request-id') || req.get('x-correlation-id') || randomUUID()
      );
    },
    customLogLevel: (req, res) => {
      const code = res.statusCode || 500;
      if (code >= 400) return 'error';
      if (code === 304) return 'debug';
      if (code >= 300) return 'warn';
      return 'debug';
    },
  }),
);

app.use(express.json());

app.get('/api/health', validateToken, (req, res) => {
  res.json({ message: 'healthy' });
});

app.get('/api/sessions', validateToken, async (req, res) => {
  try {
    const sessions = await sessionManager.getAllSessions();
    res.json(sessions);
  } catch (error) {
    req.log.error({ err: error }, 'Failed to retrieve sessions');
    res.status(500).json({ error: 'Failed to retrieve sessions' });
  }
});

app.post('/api/sessions', validateToken, async (req, res) => {
  try {
    const requestBody: CreateSessionRequest = req.body;
    const result = await sessionManager.createSession(requestBody);
    res.status(201).json(result);
  } catch (error) {
    req.log.error({ err: error }, 'Failed to create session');
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.get('/api/sessions/:id', validateToken, async (req, res) => {
  try {
    const sessionId = req.params['id'];
    const metadata = await sessionManager.getSession(sessionId);
    res.json(metadata);
  } catch (error) {
    req.log.warn(
      { sessionId: req.params['id'], err: error },
      'Session not found',
    );
    res.status(404).json({ error: 'Session not found' });
  }
});

app.get('/api/sessions/:id/messages', validateToken, async (req, res) => {
  try {
    const sessionId = req.params['id'];
    const messages = await sessionManager.getMessages(sessionId);
    res.json(messages);
  } catch (error) {
    req.log.error(
      { sessionId: req.params['id'], err: error },
      'Failed to retrieve messages',
    );
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

app.get('/images/:sessionId/:fileName', validateToken, async (req, res) => {
  try {
    const { sessionId, fileName } = req.params;
    if (sanitize(fileName) !== fileName) {
      req.log.warn({ sessionId, fileName }, 'Invalid characters in filename');
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    const imageBuffer = await sessionRepository.getImage(sessionId, fileName);
    res.set({
      'Content-Type': 'image/*',
      'Cache-Control': 'public, max-age=86400',
    });
    res.send(imageBuffer);
  } catch (error) {
    req.log.warn(
      {
        sessionId: req.params['sessionId'],
        fileName: req.params['fileName'],
        err: error,
      },
      'Image not found',
    );
    res.status(404).json({ error: 'Image not found' });
  }
});

setupWebSocketServer(server);

app.use(express.static(path.join(__dirname, 'public')));

function findLanIpAddress() {
  const allIps: string[] = [];
  const interfaces = os.networkInterfaces();
  let bestGuess = null;

  const potentialInterfaces = Object.values(interfaces)
    .flatMap((interfaceList) => interfaceList)
    .filter((info) => !!info)
    .filter((info) => info.family === 'IPv4' && !info.internal);

  potentialInterfaces.forEach((info) => {
    allIps.push(info.address);
  });

  if (allIps.length === 0) {
    return { bestGuess: null, allIps: [] };
  }

  // Priority 1: Find IPs in the most common home network range (192.168.x.x)
  const homeNetworkIp = potentialInterfaces.find((info) =>
    info.address.startsWith('192.168.'),
  );
  if (homeNetworkIp) {
    bestGuess = homeNetworkIp.address;
  }

  // Priority 2 (if no 192.168 found): Check for other private ranges, avoiding common Docker/VM ranges
  if (!bestGuess) {
    const privateIp = potentialInterfaces.find(
      (info) =>
        info.address.startsWith('10.') || info.address.startsWith('172.'),
    );
    // Be wary of default Docker bridge network (172.17.x.x)
    if (privateIp && !privateIp.address.startsWith('172.17.')) {
      bestGuess = privateIp.address;
    }
  }

  // Priority 3 (Last resort): If no ideal IP was found, just take the first one available
  if (!bestGuess) {
    bestGuess = allIps[0] || null;
  }

  return { bestGuess, allIps };
}

export function startServer() {
  logger.info('Starting GACUA server...');
  regenerateToken();

  server.listen(port, () => {
    logger.info({ port }, 'GACUA server started successfully');
    const { bestGuess, allIps } = findLanIpAddress();

    if (bestGuess) {
      const serverUrl = `http://${bestGuess}:${port}?token=${getAccessToken()}`;
      console.log('\n🚀 --- Primary Access URL (Magic Link) --- 🚀');
      console.log(`Scan the QR code with your phone to access GACUA:`);
      qrcode.generate(serverUrl, { small: true });
      console.log(`Or open this URL in your phone's browser: ${serverUrl}`);
      console.log(
        '🔒 This URL includes a secure access token valid for 24 hours',
      );
      console.log('------------------------------------');

      const otherIps = allIps.filter((ip) => ip !== bestGuess);

      if (otherIps.length > 0) {
        console.log('\n🔍 Other potential addresses on this machine:');
        otherIps.forEach((ip) => {
          console.log(`   - http://${ip}:${port}?token=${getAccessToken()}`);
        });
        console.log(
          '\nIf the QR code does not work, try one of the URLs above.',
        );
      }
    } else {
      console.warn('\n⚠️ Could not find a suitable network IP address.');
      console.warn(
        `You can access the server from this PC at: http://localhost:${port}?token=${getAccessToken()}`,
      );
    }
  });
}
