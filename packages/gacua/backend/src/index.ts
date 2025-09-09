#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from './initialize.js';
import { startServer } from './server.js';
import { logger } from './logger.js';

initializeApp()
  .catch((error) => {
    logger.error('Error initializing GACUA:', error.message);
    process.exit(1);
  })
  .then(startServer);
