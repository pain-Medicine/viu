#!/usr/bin/env node
// Builds release targets on this machine (Windows, macOS or Linux).
//
//   node scripts/build.mjs <target> [--aab]
//
//   web          static site in dist/web
//   android-tv   Android TV APK (sideload with adb or a file manager)
//   android      phone/tablet APK, or an AAB for Google Play with --aab
//                (both Android targets build the WireGuard library from Go
//                first whenever its code changed)
//   ios          unsigned iPhone/iPad IPA (macOS + Xcode only)
//   windows      not set up yet (placeholder so it slots in later)
//   all          every target this machine can build
//
// Output lands in dist/ as viu-<target>-<version>.<ext>.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const isWindows = process.platform === 'win32';

const [target, ...flags] = process.argv.slice(2);
const aab = flags.includes('--aab');
const version = process.env.VIU_VERSION ?? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd ?? root,
    stdio: 'inherit',
    // npx and gradlew.bat are batch files on Windows and need a shell.
    shell: isWindows,
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0) {
    console.error(`\n${cmd} failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function prebuild(platform, tv) {
  run('npx', ['expo', 'prebuild', '--clean', '--platform', platform], {
    // CI=1 only tells Expo not to stop and ask questions; nothing runs remotely.
    env: { EXPO_TV: tv ? '1' : '0', CI: '1' },
  });
}

function gradle(task) {
  const gradlew = isWindows ? 'gradlew.bat' : './gradlew';
  run(gradlew, [task, '--no-daemon'], { cwd: join(root, 'android') });
}

function collect(from, name) {
  mkdirSync(dist, { recursive: true });
  const out = join(dist, name);
  copyFileSync(from, out);
  console.log(`\nBuilt ${out}`);
}

// Fails early with a clear message instead of a long Gradle stack trace.
function checkAndroidTools() {
  const java = spawnSync('java', ['-version'], { shell: isWindows, encoding: 'utf8' });
  if (java.status !== 0) {
    console.error('Java not found. Install JDK 17 (for example Temurin 17) and make sure `java` is on your PATH.');
    process.exit(1);
  }
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk || !existsSync(sdk)) {
    console.error(
      'Android SDK not found. Install Android Studio (or the command-line tools) and set ANDROID_HOME,\n' +
        'usually %LOCALAPPDATA%\\Android\\Sdk on Windows or ~/Library/Android/sdk on macOS.',
    );
    process.exit(1);
  }
}

// The WireGuard library is built from the Go code the terminal app also runs
// (../viu_media/assets/tunnel) and isn't committed. It's built when missing
// and rebuilt whenever that code is newer than the built library.
const tunnelSource = resolve(root, '..', 'viu_media', 'assets', 'tunnel');
const tunnelAar = join(root, 'modules', 'viu-network', 'android', 'libs', 'viutunnel.aar');

function newestTunnelSource(dir = tunnelSource) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) newest = Math.max(newest, newestTunnelSource(path));
    else if (/^go\.(mod|sum)$/.test(entry.name) || (entry.name.endsWith('.go') && !entry.name.endsWith('_test.go'))) {
      newest = Math.max(newest, statSync(path).mtimeMs);
    }
  }
  return newest;
}

function buildTunnel() {
  if (!existsSync(join(tunnelSource, 'tunnel.go'))) {
    console.error(`Tunnel source not found at ${tunnelSource}. Run this from viu-app inside the Viu repo.`);
    process.exit(1);
  }
  const built = existsSync(tunnelAar);
  if (built && statSync(tunnelAar).mtimeMs >= newestTunnelSource()) return;
  console.log(built ? '\nThe WireGuard Go code changed, rebuilding the library.' : '\nBuilding the WireGuard library from Go.');

  if (spawnSync('go', ['version'], { shell: isWindows }).status !== 0) {
    console.error('Go not found. Install Go 1.24 or newer and make sure `go` is on your PATH.');
    process.exit(1);
  }
  // gomobile lands in GOPATH/bin, which often isn't on PATH. It also runs
  // gobind, which sits next to it.
  const gopath = spawnSync('go', ['env', 'GOPATH'], { encoding: 'utf8', shell: isWindows }).stdout?.trim() || join(homedir(), 'go');
  const local = join(gopath, 'bin', isWindows ? 'gomobile.exe' : 'gomobile');
  const gomobile = existsSync(local) ? local : 'gomobile';
  if (spawnSync(gomobile, ['version'], { shell: isWindows }).error) {
    console.error('gomobile not found. Install it with:\n  go install golang.org/x/mobile/cmd/gomobile@latest\n  gomobile init');
    process.exit(1);
  }
  mkdirSync(join(tunnelAar, '..'), { recursive: true });
  run(
    gomobile,
    [
      'bind',
      // 32-bit arm is still common on TV sticks; amd64 is for the emulator.
      '-target=android/arm64,android/arm,android/amd64',
      '-androidapi', '24',
      '-javapkg', 'media.viu',
      '-ldflags=-s -w',
      '-o', tunnelAar,
      '.',
    ],
    { cwd: tunnelSource, env: { PATH: [join(gopath, 'bin'), process.env.PATH].join(isWindows ? ';' : ':') } },
  );
}

function build(target) {
switch (target) {
  case 'web': {
    rmSync(join(dist, 'web'), { recursive: true, force: true });
    run('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist/web']);
    console.log(`\nBuilt ${join(dist, 'web')}`);
    break;
  }

  case 'android-tv':
  case 'android': {
    const tv = target === 'android-tv';
    if (tv && aab) {
      console.error('Use --aab with the android target. Android TV builds are sideloaded as an APK.');
      process.exit(1);
    }
    checkAndroidTools();
    buildTunnel();
    prebuild('android', tv);
    gradle(aab ? 'bundleRelease' : 'assembleRelease');
    const from = aab
      ? join(root, 'android/app/build/outputs/bundle/release/app-release.aab')
      : join(root, 'android/app/build/outputs/apk/release/app-release.apk');
    collect(from, `viu-${target}-${version}.${aab ? 'aab' : 'apk'}`);
    if (!process.env.VIU_UPLOAD_STORE_FILE) {
      console.log('Signed with the debug key (fine for sideloading). Set VIU_UPLOAD_* to sign with your own key.');
    }
    break;
  }

  case 'ios': {
    if (process.platform !== 'darwin') {
      console.error('iOS builds need macOS with Xcode.');
      process.exit(1);
    }
    prebuild('ios', false); // also runs pod install
    const archive = join(root, 'ios/build/Viu.xcarchive');
    run('xcodebuild', [
      '-workspace', 'ios/Viu.xcworkspace',
      '-scheme', 'Viu',
      '-configuration', 'Release',
      '-sdk', 'iphoneos',
      '-destination', 'generic/platform=iOS',
      '-archivePath', archive,
      'archive',
      'CODE_SIGNING_ALLOWED=NO',
      'CODE_SIGNING_REQUIRED=NO',
    ]);
    // An IPA is a zip with the app inside a Payload folder. It is unsigned;
    // sideload it with AltStore or Sideloadly, which sign it with your Apple ID.
    const payload = join(root, 'ios/build/Payload');
    rmSync(payload, { recursive: true, force: true });
    mkdirSync(payload, { recursive: true });
    const apps = join(archive, 'Products/Applications');
    const app = readdirSync(apps).find((f) => f.endsWith('.app'));
    if (!app) {
      console.error(`No .app found in ${apps}`);
      process.exit(1);
    }
    run('cp', ['-R', join(apps, app), payload]);
    mkdirSync(dist, { recursive: true });
    const ipa = join(dist, `viu-ios-${version}-unsigned.ipa`);
    rmSync(ipa, { force: true });
    run('zip', ['-qr', ipa, 'Payload'], { cwd: join(root, 'ios/build') });
    console.log(`\nBuilt ${ipa}`);
    break;
  }

  // Windows is planned (likely a Tauri shell around the web build). Add its
  // steps here and to the `all` list below when it's ready.
  case 'windows': {
    console.error('The Windows build is not set up yet.');
    process.exit(1);
  }

  default:
    console.error('Usage: node scripts/build.mjs <web|android-tv|android|ios|windows|all> [--aab]');
    process.exit(1);
}
}

if (target === 'all') {
  const targets = ['web', 'android-tv', 'android', ...(process.platform === 'darwin' ? ['ios'] : [])];
  for (const t of targets) build(t);
  console.log(`\nBuilt ${targets.join(', ')} into ${dist}`);
} else {
  build(target);
}
