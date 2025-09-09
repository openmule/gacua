/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
const gacuaPath = path.join('packages', 'gacua');
const frontendDistPath = path.join(gacuaPath, 'frontend', 'dist');
const backendPublicPath = path.join(gacuaPath, 'backend', 'dist', 'public');

fs.rmSync(backendPublicPath, { recursive: true, force: true });
fs.cpSync(frontendDistPath, backendPublicPath, { recursive: true });

console.log('Successfully copied GACUA frontend/dist to backend/dist/public');
