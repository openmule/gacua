/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import readline from 'readline';
import {
  Config,
  AuthType,
  clearCachedCredentialFile,
  getErrorMessage,
} from '@gacua/gemini-cli-core';
import stripJsonComments from 'strip-json-comments';
import { logger } from '../logger.js';

const authLogger = logger.child({ module: 'gemini-auth' });

const USER_SETTINGS_PATH = path.join(homedir(), '.gemini', 'settings.json');

export function getAuthType() {
  if (fs.existsSync(USER_SETTINGS_PATH)) {
    const userContent = fs.readFileSync(USER_SETTINGS_PATH, 'utf-8');
    const parsedUserSettings = JSON.parse(stripJsonComments(userContent));
    return parsedUserSettings.selectedAuthType as AuthType | undefined;
  }
  return undefined;
}

function saveAuthType(authType: AuthType) {
  const dirPath = path.dirname(USER_SETTINGS_PATH);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  let settings = {};
  if (fs.existsSync(USER_SETTINGS_PATH)) {
    const content = fs.readFileSync(USER_SETTINGS_PATH, 'utf-8');
    settings = JSON.parse(stripJsonComments(content));
  }

  fs.writeFileSync(
    USER_SETTINGS_PATH,
    JSON.stringify({ ...settings, selectedAuthType: authType }, null, 2),
    'utf-8',
  );
}

export async function isAuthenticated(
  config: Config,
  authType?: AuthType,
): Promise<boolean> {
  if (!authType) {
    authLogger.debug('No auth type provided for authentication check');
    return false;
  }

  try {
    await config.refreshAuth(authType);
    authLogger.debug({ authType }, 'Authentication successful');
    return true;
  } catch (error) {
    authLogger.debug({ authType, err: error }, 'Authentication failed');
    return false;
  }
}

async function promptAuthType(): Promise<AuthType | null> {
  const authTypes = [
    { key: '1', value: AuthType.LOGIN_WITH_GOOGLE, label: 'Login with Google' },
    { key: '2', value: AuthType.CLOUD_SHELL, label: 'Cloud Shell' },
    { key: '3', value: AuthType.USE_GEMINI, label: 'Gemini API Key' },
    { key: '4', value: AuthType.USE_VERTEX_AI, label: 'Vertex AI' },
  ];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\nSelect authentication method:');
  authTypes.forEach((type) => console.log(`${type.key}. ${type.label}`));

  const choice = await new Promise<string>((resolve) => {
    rl.question('Enter your choice (1-4): ', resolve);
  });

  rl.close();

  const selectedAuth = authTypes.find((t) => t.key === choice)?.value;
  if (!selectedAuth) {
    console.error('Invalid choice');
    return null;
  }

  return selectedAuth;
}

async function authenticateConfig(config: Config, authType?: AuthType) {
  if (authType && (await isAuthenticated(config, authType))) {
    authLogger.info({ authType }, 'Already authenticated');
    return;
  }

  authLogger.info('Starting authentication process');
  await clearCachedCredentialFile();

  const selectedAuthType = authType || (await promptAuthType());
  if (!selectedAuthType) {
    authLogger.warn('Authentication cancelled by user');
    throw new Error('Authentication cancelled');
  }

  try {
    authLogger.info(
      { authType: selectedAuthType },
      'Attempting authentication',
    );
    await config.refreshAuth(selectedAuthType);
    authLogger.info(
      { authType: selectedAuthType },
      'Authentication completed successfully',
    );
    return selectedAuthType;
  } catch (error) {
    authLogger.error(
      { authType: selectedAuthType, err: error },
      'Authentication failed',
    );
    throw new Error(`Authentication failed: ${getErrorMessage(error)}`);
  }
}

export async function tryAuthenticate() {
  authLogger.info('Starting authentication attempt');
  const config = new Config({
    sessionId: randomUUID(),
    targetDir: process.cwd(),
    debugMode: false,
    cwd: process.cwd(),
    model: 'gemini-2.5-pro',
    coreTools: [],
  });
  await config.initialize();
  const authType = getAuthType();
  authLogger.debug(
    { existingAuthType: authType },
    'Retrieved existing auth type',
  );

  const selectedAuthType = await authenticateConfig(config, authType);
  if (selectedAuthType && selectedAuthType != authType) {
    authLogger.info({ newAuthType: selectedAuthType }, 'Saving new auth type');
    saveAuthType(selectedAuthType);
  }
  return selectedAuthType;
}
