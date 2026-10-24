import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../state/settings';

export const STAGE_W = 1920;
export const STAGE_H = 1080;

// Every screen is laid out on a fixed 1920×1080 canvas, the same one the
// designs use, and scaled to fit the window. Android TV reports 960×540 dp,
// a browser reports whatever the window is; either way the design's pixel
// values work unchanged.
export function Stage({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const scale = Math.min(width / STAGE_W, height / STAGE_H);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', overflow: 'hidden' }]}>
      <View
        style={{
          position: 'absolute',
          width: STAGE_W,
          height: STAGE_H,
          left: (width - STAGE_W * scale) / 2,
          top: (height - STAGE_H * scale) / 2,
          backgroundColor: theme.colors.ground,
          overflow: 'hidden',
          transformOrigin: 'top left',
          transform: [{ scale }],
        }}
      >
        {children}
      </View>
    </View>
  );
}
