/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const HOST = '0.0.0.0';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: HOST,
      port: parseInt(env['VITE_PORT']),
      proxy: {
        '/api': {
          target: `http://localhost:3000`,
          changeOrigin: true,
        },
        '/images': {
          target: `http://localhost:3000`,
          changeOrigin: true,
        },
        '/ws': {
          target: `ws://localhost:3000`,
          ws: true,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
    },
  };
});
