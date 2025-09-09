/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function openSettingsPane(permission: 'screen' | 'accessibility'): void {
  const urls = {
    screen:
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    accessibility:
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  };

  const urlToOpen = urls[permission];

  exec(`open "${urlToOpen}"`, (error) => {
    if (error) {
      console.error(
        `❌ Failed to open settings automatically. Please open them manually.`,
      );
    }
  });
}

async function checkXcodeTools(): Promise<boolean> {
  try {
    await execAsync('xcode-select -p');
    return true;
  } catch (_error) {
    console.error('❌ Xcode Command Line Tools are not installed.');
    return false;
  }
}

async function checkMacPermission(
  permissionType: 'screen' | 'accessibility',
): Promise<boolean> {
  if (process.platform !== 'darwin') {
    console.warn(
      `⚠️ ${permissionType} permission check is only supported on macOS.`,
    );
    return false;
  }

  const permissionName =
    permissionType.charAt(0).toUpperCase() + permissionType.slice(1);

  try {
    const { getAuthStatus } = await import('node-mac-permissions');
    const status = getAuthStatus(permissionType);

    if (status === 'authorized') {
      return true;
    } else {
      console.error(`❌ ${permissionName} permission is '${status}'.`);
      return false;
    }
  } catch (_error) {
    console.error(
      `❌ Could not check for ${permissionName} permission. The 'node-mac-permissions' module may not be installed.`,
    );
    return false;
  }
}

function promptForFix(checkType: 'xcode' | 'screen' | 'accessibility'): void {
  console.log('--- PLEASE TAKE ACTION ---');
  switch (checkType) {
    case 'xcode':
      console.log(
        'To install Xcode Command Line Tools, please open Terminal.app and run the following command:',
      );
      console.log('\n  xcode-select --install\n');
      console.log(
        'Follow the on-screen instructions to complete the installation.',
      );
      break;

    case 'screen':
    case 'accessibility': {
      openSettingsPane(checkType);

      const permissionName =
        checkType === 'screen' ? 'Screen Recording' : 'Accessibility';
      console.log(`To grant ${permissionName} permission:`);
      console.log(
        `  1. The System Settings window should have opened for you.`,
      );
      console.log(
        `  2. In the "${permissionName}" section, find this application in the list.`,
      );
      console.log(`  3. Enable the toggle next to it.`);
      console.log(
        `  4. You may be prompted to restart the application for the change to take effect.`,
      );
      break;
    }
  }
  console.log('--------------------------');
}

export async function runPreflightChecks(): Promise<void> {
  if (process.platform !== 'darwin') {
    return;
  }

  const failedChecks: string[] = [];

  if (!(await checkXcodeTools())) {
    promptForFix('xcode');
    failedChecks.push('Xcode Command Line Tools');
  }

  if (!(await checkMacPermission('screen'))) {
    promptForFix('screen');
    failedChecks.push('Screen Recording Permission');
  }

  if (!(await checkMacPermission('accessibility'))) {
    promptForFix('accessibility');
    failedChecks.push('Accessibility Permission');
  }

  if (failedChecks.length > 0) {
    console.error(
      '⚠️ Some preflight checks failed. Please follow the instructions above to configure correctly.',
    );
    process.exit(13); // This exit code means "pre-flight checks failed".
  }
}
