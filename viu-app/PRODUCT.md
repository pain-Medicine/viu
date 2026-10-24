# Viu app: product context

This file holds what the Viu app is, who it's for and what it must never do. Design work on the app (themes, screens, polish, audits) starts here. How the app looks lives in the themes (`src/theme/themes.ts`), not in this file.

## What it is

Viu is an open source app for finding and watching anime. It started as a terminal app (the `viu` CLI in this repo). This React Native app brings the same thing to the living room: one codebase that builds an Android TV app, a web version, and Android and iOS builds.

Metadata comes from AniList (search, browse, schedule, lists, sign-in). Streams come from the AllAnime provider, ported from the CLI. Skip times come from AniSkip.

## Main target

Android TV is the product. Everything else is a bonus that comes from sharing the code:

- **Android TV:** the design target. Every screen is laid out on a 1920×1080 canvas and driven by a D-pad remote.
- **Web:** for browsing, searching and development. Streaming needs a separate pass-through proxy, because browsers block what the provider needs.
- **Android phone/tablet and iOS:** today these run the TV layout in landscape, scaled to fit. Phones are to get their own touch-first layout (Dave, 2026-10-24); it is not built yet. That layout restructures for touch and portrait, it doesn't shrink the TV screens.

## Who uses it and where

- One person or a few people on a couch, about 3 metres from a TV, holding a remote with arrows, OK and Back. No mouse, no touch, and typing is painful.
- Usually evening, in a dim room. The screen is the brightest thing there, so the app is dark and avoids big bright surfaces.
- They already know what anime is and usually know what they want: the next episode of a show they're watching, or a title they heard about.
- Some sign in with AniList and expect their lists and progress to follow them. Others never sign in and still expect the app to remember where they stopped.

## What success looks like

- **From opening the app to an episode playing in as few presses as possible.** Continue watching is the first thing on Home, and resume picks the right episode and position.
- **You always know where focus is.** Every focusable thing has an obvious focused state that reads from across the room.
- **Back always does what you expect** and never throws you out of the app by surprise.
- **Nothing gets in the way of the show.** The player overlay stays out of the way; Skip intro takes focus so one press skips.
- **Failures say what happened and what to do,** for example no streams for this episode, provider down, or VPN not connected.

## Voice

In between playful and plain: playful but functional and matter of fact (Dave, 2026-10-24). Copy says what a thing does in short, everyday words first. A little warmth or fan flavour is welcome in empty states, loading and small moments, never in buttons, errors or settings, and never at the cost of clarity.

## Feel

Crunchyroll and Netflix are the basis for how it feels (Dave, 2026-10-24): a big hero for the focused title, horizontal rows of poster art, continue watching up front, a full-screen player with a light overlay. People should feel at home on first use. The themes are what make it Viu's own rather than a copy.

## Surface mode

Operate. The visitor is completing a task (find a show, play an episode). Expression lives in the themes and the details. Scanability, focus and TV conventions come first. The player is the one place where the content is everything and the interface should disappear.

## Themes

Two themes share every screen and component. A theme changes only how the shared pieces look, never the layout or behaviour.

- **Material Glass (default):** Material 3 dark tonal scheme from a coral seed, rounded pill shapes, macOS-style frosted glass panels, white focus ring. Inter.
- **Graphic Realism (optional, in Settings):** ink and bone with acid and magenta accents, condensed caps display type, mono labels, chamfered corners, corner-bracket focus, print-style details (registration marks, halftone, hazard stripes). Inspired by Marathon (2026) and Antireal, without copying Antireal's actual marks.

New themes are one more entry in `src/theme/themes.ts`. Screens use theme tokens and decor flags and never check a theme id.

## Hard rules

These come from Dave and are not up for design trade-offs:

- **Self-contained.** No externally hosted backend or API of our own. The app talks only to AniList, the provider, AniSkip, and whatever proxy or VPN the user sets up.
- **No new providers, servers or extractors** unless Dave asks for one by name.
- **Open source.** Anything shipped in the app must be something we can ship in a public repo (fonts under open licences, no lifted brand marks).
- **Local builds only.** One command per target (`npm run build:android-tv` etc.), no GitHub Actions.
- **Network settings are honest.** If the proxy or VPN can't start, the app blocks its traffic instead of quietly connecting without it.

## Avoid

- Web-shaped UI on TV: hover-only affordances, small click targets, scrollbars, cursor-style menus.
- Anything that needs typing when a choice would do. Typing is a last resort (search, pasting a token).
- Big bright surfaces and pure white backgrounds in a dark room.
- Clutter on the poster rows: badges, ratings and labels piled onto art.
- Copying Crunchyroll's or Netflix's branding, logos, colours or exact screens. Borrow their patterns, not their identity.
- Ads, tracking, analytics, accounts of our own.
