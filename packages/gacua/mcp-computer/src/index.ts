#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseArgs } from 'node:util';
import { runPreflightChecks } from './preflight-check';
import { startServer } from './server';

const { values } = parseArgs({
  options: {
    host: {
      type: 'string',
      short: 'h',
      default: '0.0.0.0',
    },
    port: {
      type: 'string',
      short: 'p',
      default: '10001',
    },
  },
});

runPreflightChecks()
  .catch((error) => {
    console.error('Error running preflight checks:', error);
    process.exit(1);
  })
  .then(() => {
    const host = values.host!;
    const port = parseInt(values.port!, 10);
    startServer(port, host);
  });
