// Both themes share every screen and component; a theme only decides how the
// shared pieces look. Anything a screen needs to vary goes here, not in an
// `if (theme.id === ...)` inside the screen.
export type ThemeId = 'material' | 'graphic';

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
    progress: string;
    progressTrack: string;
    outline: string;
    focus: string;
    artFallback: string;
    scrim: string;
    scrimClear: string;
    // The "feature" panel (Continue watching, the episode list).
    featureBg: string;
    featureText: string;
    featureMuted: string;
    featureOutline: string;
    // Selected chip or toggle, on the ground and inside the feature panel.
    selected: string;
    onSelected: string;
    featureSelected: string;
    onFeatureSelected: string;
    // Translucent chrome behind nav bars and floating controls.
    chrome: string;
  };
  fonts: {
    display: string;
    title: string;
    body: string;
    bodyMedium: string;
    bodyBold: string;
    label: string;
    labelBold: string;
  };
  type: {
    displayUppercase: boolean;
    labelUppercase: boolean;
    labelTracking: number;
    displayTracking: number;
    displayLineHeight: number;
  };
  shape: {
    radiusSm: number;
    radiusMd: number;
    radiusLg: number;
    button: number;
    chip: number;
    // Cut corner size for buttons and cards; 0 means none.
    chamfer: number;
  };
  // "glass": blurred translucent panels. "solid": flat panels with hairlines.
  panel: 'glass' | 'solid';
  // "ring": white outline + lift. "brackets": corner brackets.
  focus: 'ring' | 'brackets';
  decor: {
    frameMarks: boolean;
    dotMatrix: boolean;
    hazard: boolean;
    indexLabels: boolean;
  };
}
