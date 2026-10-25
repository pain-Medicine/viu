# Building the Viu app

All builds run on your own machine from the `viu-app` folder on the `React-Native` branch. Every build is one command, and the output goes to `viu-app/dist/`.

## Every build

1. Install Node 20.19 or newer.
2. Install the dependencies once (and again after changing branches):
   ```sh
   cd viu-app
   npm ci
   ```
3. Optional: set the version before building. Android only installs an update when the build number is higher than the one already installed.
   ```powershell
   $env:VIU_VERSION = "1.0.1"; $env:VIU_BUILD_NUMBER = "2"   # PowerShell
   ```

## Android TV

**Needs:** JDK 17, the Android SDK with the NDK, Go 1.24 or newer, and gomobile.

- Installing Android Studio gives you JDK 17 and the SDK. In the SDK Manager, go to SDK Tools and tick **NDK**.
- Set `ANDROID_HOME` to the SDK folder, usually `%LOCALAPPDATA%\Android\Sdk`.
- Install gomobile once:
  ```sh
  go install golang.org/x/mobile/cmd/gomobile@latest
  gomobile init
  ```

**Build:**
```sh
npm run build:android-tv
```
**Output:** `dist/viu-android-tv-<version>.apk`

**Install on the TV:** turn on Developer options and USB (or network) debugging on the TV, then run:
```sh
adb connect <tv-ip>
adb install -r dist/viu-android-tv-<version>.apk
```
Or copy the APK to the TV and open it with a file manager app such as Downloader.

## Android phone and tablet

**Needs:** the same tools as Android TV. Both Android builds include the WireGuard library, which is built from Go.

**Build:**
```sh
npm run build:android        # APK to sideload
npm run build:android:aab    # AAB bundle for Google Play
```
**Output:** `dist/viu-android-<version>.apk` or `.aab`

The phone app (`media.viu.app`) and the TV app (`media.viu.app.tv`) have different IDs, so both can be installed on the same device.

## Web

**Needs:** Node only.

**Run it while developing:**
```sh
npm run web
```
This opens the app on http://localhost:8081 and starts the local provider proxy, so episodes play.

**Build:**
```sh
npm run build:web
```
**Output:** `dist/web/`, a static site.

**Serve the build:**
```sh
npm run serve:web
```
This serves `dist/web` on http://localhost:8080 together with the provider proxy. Ctrl+C stops both.

The proxy (`scripts/provider-proxy.mjs`) is needed because browsers can't send the `Origin` and `Referer` headers AllAnime and mp4upload require. It runs on your own machine, listens only on `127.0.0.1:8787`, and only forwards to those two sites. If you host `dist/web` somewhere else, each viewer needs the proxy running on their machine (`npm run proxy`). Alternatively, build with `EXPO_PUBLIC_PROVIDER_PROXY` set to a proxy address of your own.

## iOS (iPhone and iPad)

> **Untested.** The build command exists, but it has never been run.

**Needs:** a Mac with Xcode and CocoaPods.

**Build:**
```sh
npm run build:ios
```
**Output:** `dist/viu-ios-<version>-unsigned.ipa`

The IPA is unsigned. Sideload it with AltStore or Sideloadly, which sign it with your Apple ID. TestFlight or the App Store would need an Apple Developer account.

## Build everything

```sh
npm run build:all
```
This builds Web, Android TV and Android on any machine, plus iOS on a Mac.

## Signing key (Android)

The first Android build creates your release key in `~/.viu` (`viu-release.keystore` and `viu-release.password`). **Back up that folder.** Android only installs an update when it is signed with the same key, so losing the key means users have to uninstall and reinstall.

To use a different key, for example a Google Play upload key, set `VIU_UPLOAD_STORE_FILE`, `VIU_UPLOAD_STORE_PASSWORD`, `VIU_UPLOAD_KEY_ALIAS` and `VIU_UPLOAD_KEY_PASSWORD`.

## Good to know

- The native `android/` and `ios/` folders aren't committed. Each build regenerates them, so don't edit them by hand.
- If Gradle fails to download from Maven Central with HTTP 429 (rate limited), try again later, or point Gradle at Google's Maven Central mirror (`maven-central.storage-download.googleapis.com`).
- There's no Windows build yet. `build.mjs` has a placeholder for it.
