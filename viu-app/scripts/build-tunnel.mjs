#!/usr/bin/env node
// Builds the WireGuard tunnel library (modules/viu-network/android/libs/viutunnel.aar)
// from the Go code the terminal app also uses (../viu_media/assets/tunnel).
//
//   node scripts/build-tunnel.mjs
//
// Needs Go 1.24+, the Android SDK with an NDK installed (ANDROID_HOME), and gomobile:
//   go install golang.org/x/mobile/cmd/gomobile@latest && gomobile init
// Only needed again when the Go code changes.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, '..', 'viu_media', 'assets', 'tunnel');
const out = join(root, 'modules', 'viu-network', 'android', 'libs', 'viutunnel.aar');
const isWindows = process.platform === 'win32';

if (!existsSync(join(source, 'tunnel.go'))) {
  console.error(`Tunnel source not found at ${source}. Run this from viu-app inside the Viu repo.`);
  process.exit(1);
}

// gomobile lands in GOPATH/bin, which often isn't on PATH.
const gopath = spawnSync('go', ['env', 'GOPATH'], { encoding: 'utf8', shell: isWindows }).stdout?.trim() || join(homedir(), 'go');
const local = join(gopath, 'bin', isWindows ? 'gomobile.exe' : 'gomobile');
const gomobile = existsSync(local) ? local : 'gomobile';
if (spawnSync(gomobile, ['version'], { shell: isWindows }).error) {
  console.error('gomobile not found. Install it with:\n  go install golang.org/x/mobile/cmd/gomobile@latest\n  gomobile init');
  process.exit(1);
}

mkdirSync(join(out, '..'), { recursive: true });
const args = [
  'bind',
  // 32-bit arm is still common on TV sticks; amd64 is for the emulator.
  '-target=android/arm64,android/arm,android/amd64',
  '-androidapi', '24',
  '-javapkg', 'media.viu',
  '-ldflags=-s -w',
  '-o', out,
  '.',
];
console.log(`> ${gomobile} ${args.join(' ')}`);
// gomobile also runs gobind, which sits next to it in GOPATH/bin.
const path = [join(gopath, 'bin'), process.env.PATH].join(isWindows ? ';' : ':');
const result = spawnSync(gomobile, args, { cwd: source, stdio: 'inherit', shell: isWindows, env: { ...process.env, PATH: path } });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`\nBuilt ${out}`);
