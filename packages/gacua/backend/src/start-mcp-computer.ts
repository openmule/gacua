/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import readline from 'readline';
import path from 'path';
import { fork, ChildProcess } from 'child_process';
import { createRequire } from 'module';
import net from 'net';

async function findAvailablePort(startPort = 10001): Promise<number> {
  let port = startPort;
  const maxAttempts = 10;
  let attempts = 0;

  const isFree = (p: number): Promise<boolean> =>
    new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => {
        resolve(false);
      });
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(p, '127.0.0.1');
    });

  while (attempts < maxAttempts) {
    if (await isFree(port)) {
      return port;
    }
    port++;
    attempts++;
  }

  throw new Error(
    `Could not find available port after ${maxAttempts} attempts starting from ${startPort}`,
  );
}

function resolveMCPComputerEntry(): string {
  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve('@gacua/mcp-computer/package.json');
  const pkgDir = path.dirname(pkgJsonPath);
  const pkgJson = require(pkgJsonPath);
  const binField = pkgJson.bin;

  if (!binField) {
    throw new Error(
      'No binary field found in @gacua/mcp-computer package.json',
    );
  }

  const binRelative =
    typeof binField === 'string' ? binField : binField['gacua-mcp-computer'];

  if (!binRelative) {
    throw new Error('No gacua-mcp-computer binary found in package.json');
  }

  return path.join(pkgDir, binRelative);
}

async function startMCPComputer(): Promise<ChildProcess> {
  const mcpComputerEntry = resolveMCPComputerEntry();

  const host = 'localhost';
  const port = await findAvailablePort(10001);

  return new Promise((resolve, reject) => {
    const url = `http://${host}:${port}/mcp`;
    const successIndicator = `MCP Server for '.computer' tool listening on ${host}:${port}`;

    const mcpComputerProcess = fork(
      mcpComputerEntry,
      ['--host', host, '--port', port.toString()],
      {
        detached: false,
        stdio: 'pipe',
      },
    );

    if (!mcpComputerProcess.pid) {
      return reject(new Error('Failed to start MCP computer process.'));
    }

    const startTimeout = setTimeout(() => {
      mcpComputerProcess.kill();
      reject(
        new Error(`Timeout: MCP computer did not start within 15 seconds.`),
      );
    }, 15000);

    readline
      .createInterface({
        input: mcpComputerProcess.stdout!,
        crlfDelay: Infinity,
      })
      .on('line', (line) => {
        console.log(`[MCP] ${line}`);
        if (line === successIndicator) {
          clearTimeout(startTimeout);
          process.env['GACUA_MCP_COMPUTER_URL'] = url;
          console.log(`[+] GACUA_MCP_COMPUTER_URL=${url}`);
          resolve(mcpComputerProcess);
        }
      });

    readline
      .createInterface({
        input: mcpComputerProcess.stderr!,
        crlfDelay: Infinity,
      })
      .on('line', (line) => {
        console.error(`[MCP] ${line}`);
      });

    mcpComputerProcess.on('exit', (code, signal) => {
      reject(
        new Error(
          `MCP computer exited with code ${code}` +
            (signal ? `, signal ${signal}` : ''),
        ),
      );
    });
  });
}

export async function startMCPComputerDaemon() {
  let isShuttingDown = false;

  let mcpComputerDaemon: ChildProcess;
  let restartAttempts = 0;
  const MAX_RESTART_ATTEMPTS = 3;
  const RESTART_DELAY = 1000;

  const startAndMonitor = async () => {
    try {
      mcpComputerDaemon = await startMCPComputer();
      restartAttempts = 0; // Reset attempts on a successful start
      setupExitHandler(mcpComputerDaemon);
    } catch (error) {
      console.error('Failed to start MCP computer:', error);
      handleExit(); // Treat a failed start as an exit
    }
  };

  const handleExit = () => {
    if (isShuttingDown) return;

    if (restartAttempts < MAX_RESTART_ATTEMPTS) {
      restartAttempts++;
      console.log(
        `Restarting MCP computer (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})...`,
      );
      setTimeout(startAndMonitor, RESTART_DELAY * restartAttempts);
    } else {
      console.error(
        'Max restart attempts reached. MCP computer will not be restarted.',
      );
    }
  };

  const setupExitHandler = (processInstance: ChildProcess) => {
    processInstance.on('exit', (code: number, signal: string) => {
      if (isShuttingDown) return;
      console.log(`MCP computer exited with code ${code}, signal ${signal}`);
      handleExit();
    });
  };

  // For the first start, do not use startAndMonitor to error out if the MCP computer fails to start
  mcpComputerDaemon = await startMCPComputer();
  setupExitHandler(mcpComputerDaemon);

  process.on('exit', () => {
    isShuttingDown = true;
    console.log('Exiting — killing GACUA MCP computer');
    if (mcpComputerDaemon && !mcpComputerDaemon.killed) {
      mcpComputerDaemon.kill();
    }
  });
}
