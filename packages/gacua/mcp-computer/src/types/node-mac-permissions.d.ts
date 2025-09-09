/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

declare module 'node-mac-permissions' {
  export function getAuthStatus(
    permissionType: 'screen' | 'accessibility',
  ): 'authorized' | 'denied' | 'restricted' | 'not determined';
}
