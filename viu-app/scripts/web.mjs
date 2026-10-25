#!/usr/bin/env node
// `npm run web`: the Expo dev server for the browser, plus the local provider
// proxy so episodes play (see scripts/provider-proxy.mjs). Set
// EXPO_PUBLIC_PROVIDER_PROXY yourself to use a proxy you run elsewhere.
import { spawn } from 'node:child_process';

import { DEFAULT_PORT, startProxy } from './provider-proxy.mjs';

const own = process.env.EXPO_PUBLIC_PROVIDER_PROXY;
if (!own) {
  try {
    await startProxy(DEFAULT_PORT);
  } catch (err) {
    if (err.code !== 'EADDRINUSE') throw err;
    console.log(`Port ${DEFAULT_PORT} is in use, so using the provider proxy that's already running there.`);
  }
}

const expo = spawn('npx', ['expo', 'start', '--web', ...process.argv.slice(2)], {
  stdio: 'inherit',
  // npx is a batch file on Windows and needs a shell.
  shell: process.platform === 'win32',
  env: { ...process.env, EXPO_PUBLIC_PROVIDER_PROXY: own || `http://127.0.0.1:${DEFAULT_PORT}/` },
});
expo.on('exit', (code) => process.exit(code ?? 0));
