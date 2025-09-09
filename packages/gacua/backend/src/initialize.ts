/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { startMCPComputerDaemon } from './start-mcp-computer.js';
import { tryAuthenticate } from './auth/gemini.js';

const GEMINI_DIR = path.join(process.cwd(), '.gemini');
const GACUA_SYSTEM_MD_PATH = path.join(GEMINI_DIR, 'gacua_system.md');
const GACUA_SESSIONS_DIR = path.join(GEMINI_DIR, 'gacua_sessions');

const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant.`;

export async function initializeApp() {
  if (!fs.existsSync(GEMINI_DIR)) {
    console.log(`Creating directory: ${GEMINI_DIR}`);
    fs.mkdirSync(GEMINI_DIR, { recursive: true });
  }

  if (!fs.existsSync(GACUA_SYSTEM_MD_PATH)) {
    console.log(`Creating default system prompt: ${GACUA_SYSTEM_MD_PATH}`);
    fs.writeFileSync(GACUA_SYSTEM_MD_PATH, DEFAULT_SYSTEM_PROMPT, {
      flag: 'wx',
    });
  }

  if (!fs.existsSync(GACUA_SESSIONS_DIR)) {
    console.log(`Creating directory: ${GACUA_SESSIONS_DIR}`);
    fs.mkdirSync(GACUA_SESSIONS_DIR, { recursive: true });
  }

  function setupEnvVariable(name: string, defaultValue: string): void {
    if (process.env[name]) {
      console.log(`[✓] ${name}: ${process.env[name]}`);
    } else {
      process.env[name] = defaultValue;
    }
  }
  setupEnvVariable('GACUA_ENABLE_HIDDEN_TOOLS', 'true');
  setupEnvVariable('GEMINI_SYSTEM_MD', GACUA_SYSTEM_MD_PATH); // TODO: no effect yet

  if (process.env['GACUA_MCP_COMPUTER_URL']) {
    console.log(
      `[✓] GACUA_MCP_COMPUTER_URL: ${process.env['GACUA_MCP_COMPUTER_URL']}`,
    );
  } else {
    await startMCPComputerDaemon();
  }

  await tryAuthenticate();
}
