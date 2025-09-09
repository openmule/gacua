/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import pino from 'pino';
import path from 'path';

const createLogger = () => {
  const logLevel = process.env['LOG_LEVEL'] || 'info';
  const startTime = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(
    process.cwd(),
    '.gemini',
    'gacua_logs',
    `${startTime}.log`,
  );

  return pino({
    level: logLevel.toLowerCase(),
    redact: {
      paths: [
        'password',
        'token',
        'accessToken',
        'apikey',
        'secret',
        'authorization',
      ],
      remove: true,
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    transport: {
      targets: [
        {
          target: 'pino-pretty',
          level: 'warn',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
        {
          target: 'pino-pretty',
          level: logLevel.toLowerCase(),
          options: {
            destination: logFile,
            colorize: false,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            mkdir: true,
          },
        },
      ],
    },
  });
};

export const logger = createLogger();
