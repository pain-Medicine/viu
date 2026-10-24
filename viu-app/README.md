# Viu app (Android TV + web)

A React Native (Expo) front end for Viu. One codebase builds the Android TV app and a web version. It uses AniList for metadata and the AllAnime provider for streams.

## Themes

Both themes share every screen and component. A theme only changes how the shared pieces look, so a new theme is one more entry in `src/theme/themes.ts`.

- **Material Glass** (default) is the v2 design: coral tones, rounded shapes, frosted glass panels and a white focus ring.
- **Graphic Realism** is the v3 design: ink and bone with acid accents, condensed type, cut corners, corner-bracket focus, halftone and hazard details.

You can switch between them in **Settings**. The choice is saved on the device.

## Screens

- **Home**: Continue watching, Trending, Popular this season and All-time popular. The hero follows the focused card.
- **Browse**: the AniList catalogue, filtered by sort order, format, year, season and genre. "Show more" loads the next page.
- **Schedule**: everything airing over the next 7 days in the TV's local time, a day at a time. Today opens at what airs next.
- **My List**: your AniList lists (Watching, Planning, Paused, Rewatching, Completed, Dropped) when signed in. Signed out, it holds titles saved on the device with **Add to My List** on a title's page.
- **Search**: AniList search with an on-screen keyboard. On web you can also type.
- **Details** and **Player**: episodes, sub/dub, resume, next episode, and skip buttons.
- **Settings**: theme, sub/dub default, skip behaviour, and AniList sign-in.

## Watch history

Progress is saved per episode on the device. An episode counts as watched once 90% of it has played. Resume buttons pick up the last episode where it stopped, or start the next one if it was finished. History saved by older builds only knows the last episode, so for those shows the earlier episodes still count as watched.

## Skip intro and credits

The player gets intro, recap and credits timestamps from [AniSkip](https://aniskip.com), a community database keyed by MyAnimeList id and episode number. While one of those parts plays, a **Skip intro** (or recap, or credits) button appears and takes focus, so one press of OK skips it. Choose **Skip automatically** in Settings to skip without asking. Episodes nobody has submitted times for just don't show the button.

## AniList sign-in

Signing in shows your AniList lists in My List, lets **Add to My List** write to AniList, and marks episodes watched on AniList as you finish them. Progress only goes up, and the last episode marks the show Completed.

AniList's sign-in for apps without a server ends on a page with the token in its address, so it happens on your phone:

1. In **Settings**, choose **Sign in to AniList**. Scan the QR code, or open the address shown, and approve Viu.
2. Copy the address of the page AniList ends on (or just the `access_token` part).
3. Paste it into the field on the TV. The Google TV app's remote keyboard on your phone can paste into it, or from a computer run `adb shell input text "<token>"`. On web, paste normally.

It uses the same AniList client as the Viu CLI (`client_id=20148`). The token lasts a year and is kept on the device. **Sign out** in Settings removes it. Removing a title from My List while signed in only works for "Planning" entries, so a button press can never erase progress or scores on AniList.

## Run it during development

You need Node 20.19 or newer.

```sh
cd viu-app
npm install
npm run web          # dev server in the browser
```

Use the arrow keys to move focus, Enter to select, and Escape or Backspace to go back. On the Search screen you can also type with a real keyboard.

## Builds

Every target builds on your own machine with one command. There's no cloud CI: nothing is built on GitHub. `npm run build:all` builds everything this machine can: web, Android TV and Android everywhere, plus iOS on a Mac.

| Target | Command | Output in `dist/` | Needs |
| --- | --- | --- | --- |
| Web | `npm run build:web` | `web/` static site | Node |
| Android TV | `npm run build:android-tv` | `viu-android-tv-<version>.apk` | JDK 17, Android SDK, plus Go and the NDK for the first build |
| Android phone/tablet | `npm run build:android` | `viu-android-<version>.apk` | JDK 17, Android SDK |
| Google Play bundle | `npm run build:android:aab` | `viu-android-<version>.aab` | JDK 17, Android SDK |
| iPhone/iPad | `npm run build:ios` | `viu-ios-<version>-unsigned.ipa` | macOS, Xcode |

On Windows, the Android builds need JDK 17 and the Android SDK. Installing Android Studio gives you both. Then set `ANDROID_HOME` to the SDK folder, usually `%LOCALAPPDATA%\Android\Sdk`. The script checks for both and tells you what's missing. To set the version name or build number, set `VIU_VERSION` or `VIU_BUILD_NUMBER` before building. Android only installs a new build over an old one when the build number is higher.

The native `android/` and `ios/` folders aren't committed. Each build generates them from `app.config.ts` and the config plugins (Expo's prebuild). Setting `EXPO_TV=1` switches the generated project to Android TV or Apple TV. The script does that for you.

The Android TV and phone apps have different application IDs (`media.viu.app.tv` and `media.viu.app`), so you can install both on one device. The TV build adds the Android TV launcher entry and banner. It can still be installed on a phone, which is handy for testing.

The Android builds include the WireGuard library from the Go code in `../viu_media/assets/tunnel` (the same code the terminal app runs). It isn't committed. The first Android build runs `npm run build:tunnel` for you, which needs Go 1.24 or newer, the Android NDK (SDK Manager → SDK Tools → NDK), and gomobile:

```sh
go install golang.org/x/mobile/cmd/gomobile@latest
gomobile init
```

After that, run `npm run build:tunnel` again only when the Go code changes.

### Getting the Android TV APK onto a TV

1. On the TV, turn on Developer options, then turn on **USB debugging** (some TVs call it network debugging). Also allow installs from unknown sources.
2. Install the APK with one of these:
   - From a computer: `adb connect <tv-ip>` then `adb install -r dist/viu-android-tv-<version>.apk`.
   - Without a computer: put the APK on a USB stick or in cloud storage and open it with a file manager app on the TV, such as Downloader or X-plore.

### Signing

Android release builds are signed with the debug key unless you provide your own upload key. The debug key is fine for sideloading. You need your own key for Google Play, and Android only installs an update over an existing app when both were signed with the same key. To create a key:

```sh
keytool -genkeypair -v -keystore viu-upload.keystore -alias viu -keyalg RSA -keysize 2048 -validity 10000
```

Keep the file out of the repo. For local builds, set `VIU_UPLOAD_STORE_FILE`, `VIU_UPLOAD_STORE_PASSWORD`, `VIU_UPLOAD_KEY_ALIAS` and `VIU_UPLOAD_KEY_PASSWORD` as environment variables or in `~/.gradle/gradle.properties`.

The iOS IPA is unsigned. Sideload it with AltStore or Sideloadly, which sign it with your Apple ID. TestFlight or the App Store would need an Apple Developer account.

## Proxy and VPN

Settings → Network routes all of Viu's traffic, video included, through a proxy or a WireGuard VPN. Only Viu is affected, there's no system VPN prompt, and other VPN apps keep working.

- **Proxy:** enter `http://host:port` or `socks5://host:port`.
- **WireGuard VPN:** works with any WireGuard `.conf`, for example from Proton VPN (account.protonvpn.com → Downloads → WireGuard configuration), Mullvad or your own server. Pick **Import config from phone**, scan the QR code with a phone on the same Wi-Fi, and upload or paste the file. The page is served by the TV itself and nothing leaves your network. The config is kept in the app's private storage.
- If the proxy or tunnel can't start, Viu blocks its traffic instead of quietly connecting without it. **Check connection** shows the IP address sites see.

How it works: `modules/viu-network` installs an app-wide Java `ProxySelector` when the app starts, so React Native's requests and the video player's HTTP client both use it. In VPN mode it starts a userspace WireGuard client (wireguard-go, through wireproxy) inside the app, listening on `127.0.0.1`, and points the selector at it. On web, the browser's own network settings apply and the section only shows a note.

## Streaming on web

Browsers block the cross-site requests and the `Referer` header that the provider needs. So in a plain browser build you can browse, search and open titles, but playback shows a message instead. To stream on web, run a small pass-through proxy and point the build at it:

```sh
EXPO_PUBLIC_PROVIDER_PROXY=https://your-proxy.example/fetch npm run web
```

The proxy receives the target in a `url` query parameter and the headers to send as `x-forward-<name>` headers. It should return the upstream response with CORS headers added. The Android TV app doesn't need a proxy.

## Layout

```
app.config.ts            app config for every target (TV vs phone, IDs, icons)
plugins/                 config plugins (Android release signing)
scripts/build.mjs        build script for every target
App.tsx                  fonts, providers, screen stack
src/
  api/anilist.ts         AniList GraphQL client (catalogue, schedule, signed-in list calls)
  api/aniskip.ts         AniSkip skip times
  providers/allanime/    AllAnime port (search, episodes, mp4upload streams)
  providers/index.ts     platform fetch, AniList → provider title matching
  theme/                 Theme type, Material Glass and Graphic Realism
  state/                 settings, per-episode watch history, AniList account, My List, saved with AsyncStorage
  nav/                   small stack navigator, back handling, web arrow-key focus
  ui/                    Stage (1920×1080 canvas), Focusable, Button, Chip, Panel, MediaCard, TopNav, QrCode, decor
  screens/               Home, Browse, Schedule, My List, Search, Details, Player, Settings, Sign in
```

Every screen is laid out on a fixed 1920×1080 canvas, the same size as the designs, and scaled to the window. Android TV reports 960×540 dp, so it gets a scale of 0.5, and a browser window scales to fit.

## Known gaps

- Only tested in a browser so far. The Android TV, Android and iOS builds haven't run yet (their native projects generate cleanly). Expect a fix or two on the first Gradle build, then focus-order tuning on a real TV, and a check that AllAnime accepts requests from Android's HTTP client.
- The UI is laid out for a 16:9 TV screen, so phones and tablets run it in landscape, scaled to fit. A touch-first phone layout is a separate piece of work.
- No Windows build yet. `scripts/build.mjs` has a `windows` placeholder, and `npm run build:windows` can be added once it's built.
- Only the mp4upload source is extracted. Other AllAnime servers need their own extractors.
- AniList sign-in and progress sync are checked against AniList's API (queries validate, a bad token is rejected), but haven't been run end to end with a real account yet.
- Watch history stays on the device. It isn't synced between devices, apart from what AniList progress records.
