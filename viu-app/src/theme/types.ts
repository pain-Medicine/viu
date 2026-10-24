// Both themes share every screen and component; a theme only decides how the
// shared pieces look. Anything a screen needs to vary goes here, not in an
// `if (theme.id === ...)` inside the screen, and not in a check of some other
// theme field standing in for the id.
export type ThemeId = 'material' | 'graphic';

export type FontRole = 'display' | 'title' | 'body' | 'bodyMedium' | 'bodyBold' | 'label' | 'labelBold';

// What a piece of text is for. Screens pick a role; the theme decides its
// face, size, casing and tracking.
export type TextRole =
  // The focused title on Home.
  | 'hero'
  // Page headings: Settings, Sign in.
  | 'page'
  // A title page heading and big status lines ("Can't play this episode").
  | 'headline'
  // Panel and row headings: "Continue watching", "Episodes".
  | 'section'
  // Titles in lists: episode rows, schedule rows, the player's title.
  | 'item'
  // Caption under a card.
  | 'cardTitle'
  // Top navigation items.
  | 'nav'
  // The "viu" wordmark.
  | 'logo'
  // Big figures: airing times, step numbers, episode tiles.
  | 'numeral'
  | 'button'
  // On-screen keyboard keys and the search query.
  | 'key'
  | 'query'
  | 'bodyLg'
  | 'body'
  | 'bodyBold'
  // Metadata, notes and statuses.
  | 'label'
  | 'labelBold'
  // The smallest text: counts, card meta, crumbs. Still readable from the couch.
  | 'meta'
  | 'metaBold';

export interface TextToken {
  font: FontRole;
  size: number;
  // Multiplier of the size. Defaults to 1.3.
  lineHeight?: number;
  // In em, so it scales with the size.
  tracking?: number;
  upper?: boolean;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  colors: {
    ground: string;
    text: string;
    textMuted: string;
    textOnArt: string;
    primary: string;
    onPrimary: string;
    tonal: string;
    onTonal: string;
    accent: string;
    onAccent: string;
    // Status badges such as "Watching" and "Airing".
    badge: string;
    onBadge: string;
    progress: string;
    progressTrack: string;
    outline: string;
    // Border of tonal and outline buttons.
    buttonOutline: string;
    // Hairline around art.
    artOutline: string;
    focus: string;
    artFallback: string;
    // Placeholder blocks while content loads.
    skeleton: string;
    featureSkeleton: string;
    scrim: string;
    scrimClear: string;
    // The "feature" panel (Continue watching, the episode list).
    featureBg: string;
    featureText: string;
    featureMuted: string;
    featureOutline: string;
    // Emphasis inside the feature panel ("13 min left", "In 2h").
    featureAccent: string;
    // Focus indicator on the feature panel, which can be light.
    featureFocus: string;
    // Fill of a focused list row inside the feature panel.
    rowFocus: string;
    // Selected chip or toggle, on the ground and inside the feature panel.
    selected: string;
    onSelected: string;
    featureSelected: string;
    onFeatureSelected: string;
    // On-screen keyboard key at rest.
    key: string;
    // Unselected top nav label.
    navText: string;
    // Translucent chrome behind nav bars and floating controls.
    chrome: string;
  };
  fonts: Record<FontRole, string>;
  text: Record<TextRole, TextToken>;
  // Button labels are set this much larger than the button size's base.
  buttonScale: number;
  shape: {
    radiusSm: number;
    radiusMd: number;
    radiusLg: number;
    button: number;
    chip: number;
    // Cut corner size for buttons and cards; 0 means none.
    chamfer: number;
    chipHeight: number;
    chipPadding: number;
    // Hairline around art, 0 for none.
    artBorder: number;
    // Space between a card's art and its caption edge.
    captionInset: number;
    // Padding inside the nav pill.
    navPadding: number;
    // Square line caps and joins on icons.
    squareIcons: boolean;
  };
  layout: {
    // Top of the nav bar, and of the content under it.
    navTop: number;
    contentTop: number;
    // Measure of the Home hero's title and text.
    heroWidth: number;
  };
  // "glass": blurred translucent panels. "solid": flat panels with hairlines.
  panel: 'glass' | 'solid';
  // "ring": white outline + lift. "brackets": corner brackets.
  focus: 'ring' | 'brackets';
  // Small stylistic choices that add or drop an element.
  style: {
    // Icons beside button and nav labels.
    buttonIcons: boolean;
    // A check mark on selected chips and badges.
    checkMarks: boolean;
    // Progress bars run along the bottom edge of art rather than inset.
    flushProgress: boolean;
    // Thin dividers between nav items.
    navDividers: boolean;
  };
  decor: {
    frameMarks: boolean;
    dotMatrix: boolean;
    hazard: boolean;
    // Spec-sheet details: index numbers, the readout column, inline genres.
    indexLabels: boolean;
  };
}
