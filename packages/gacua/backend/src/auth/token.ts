/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { logger } from '../logger.js';

const authLogger = logger.child({ module: 'auth' });

let accessToken: string = '';
let tokenExpiration: Date = new Date();

export function generateAccessToken(): string {
  const token = crypto.randomBytes(32).toString('hex');
  authLogger.debug('New access token generated');
  return token;
}

export function regenerateToken(): void {
  accessToken = generateAccessToken();
  tokenExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000);
  authLogger.info(
    {
      expiresAt: tokenExpiration.toISOString(),
      validityHours: 24,
    },
    'Access token regenerated',
  );
}

export function validateTokenString(token: string): boolean {
  if (!token) {
    authLogger.debug('Token validation failed: No token provided');
    return false;
  }

  if (token !== accessToken) {
    authLogger.warn('Token validation failed: Invalid token provided');
    return false;
  }

  if (new Date() > tokenExpiration) {
    authLogger.warn(
      {
        expiresAt: tokenExpiration.toISOString(),
        currentTime: new Date().toISOString(),
      },
      'Token validation failed: Token has expired',
    );
    return false;
  }

  authLogger.debug('Token validation successful');
  return true;
}

export function getAccessToken(): string {
  authLogger.debug('Access token requested');
  return accessToken;
}
