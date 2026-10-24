import { createContext, useContext, useMemo } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../state/settings';

// The design canvas the screens were drawn on. Sizes in the app are canvas
// pixels, and the stage scales the canvas to the screen.
export const STAGE_W = 1920;
export const STAGE_H = 1080;

// Away from a TV the screen is closer, but often much smaller: a phone in
// landscape would shrink the TV canvas until 18 px text became 6 dp. Below
// this many screen points per canvas pixel the canvas stops shrinking and
// gets smaller instead, and the screens reflow to fit.
const MIN_SCALE_OFF_TV = 0.66;

export interface StageLayout {
  // Canvas size. One side matches the design (1920 or 1080) on a 16:9 TV;
  // other shapes get a wider or taller canvas instead of black bars.
  width: number;
  height: number;
  // "tv": the D-pad layout with paged rows. "flow": pages that scroll, for
  // touch, mouse and keyboard.
  mode: 'tv' | 'flow';
  // Less room than the 1920×1080 design: a landscape phone, a 4:3 tablet.
  // Screens stack, shrink or drop decoration to fit.
  narrow: boolean;
  short: boolean;
}

// Below these canvas sizes a screen switches to its compact layout.
const NARROW_W = 1500;
const SHORT_H = 900;

const StageContext = createContext<StageLayout>({ width: STAGE_W, height: STAGE_H, mode: 'tv', narrow: false, short: false });
export const useStage = () => useContext(StageContext);

// Screens lay out on the canvas, which is scaled to fill the window inside
// its safe area (notches, cutouts, the gesture bar). Android TV reports
// 960×540 dp and a 4K TV the same, so the TV design's pixel values work
// unchanged; any other shape gets a canvas of its own shape.
export function Stage({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const w = window.width - insets.left - insets.right;
  const h = window.height - insets.top - insets.bottom;
  const tv = Platform.isTV;
  const fit = Math.min(w / STAGE_W, h / STAGE_H);
  const scale = tv ? fit : Math.max(fit, MIN_SCALE_OFF_TV);
  const layout = useMemo<StageLayout>(() => {
    const width = Math.round(w / scale);
    const height = Math.round(h / scale);
    return { width, height, mode: tv ? 'tv' : 'flow', narrow: width < NARROW_W, short: height < SHORT_H };
  }, [w, h, scale, tv]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.ground, overflow: 'hidden' }]}>
      <View
        style={{
          position: 'absolute',
          width: layout.width,
          height: layout.height,
          left: insets.left,
          top: insets.top,
          overflow: 'hidden',
          transformOrigin: 'top left',
          transform: [{ scale }],
        }}
      >
        <StageContext.Provider value={layout}>{children}</StageContext.Provider>
      </View>
    </View>
  );
}

// How many cards of this width fit across a grid, counting the 24 px gaps
// and the 14 px padding that leaves room for focus rings.
export function gridColumns(gridWidth: number, cardWidth: number, gap = 24): number {
  return Math.max(1, Math.floor((gridWidth - 28 + gap) / (cardWidth + gap)));
}

// Poster cards shrink on short screens, so a grid shows more than one row.
export function useCardSize(width: number, height: number) {
  const { short } = useStage();
  const k = short ? 0.8 : 1;
  const cardW = Math.round(width * k);
  const cardH = Math.round(height * k);
  // One grid row: the card, its caption lines and the row gap.
  return { cardW, cardH, rowStep: cardH + 120 };
}
