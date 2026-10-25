// Graphic-theme ornaments: the screen frame, the halftone dot screen over
// art, hazard stripes and the barcode strip. Each is drawn only when the
// active theme turns its decor flag on.
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '../state/settings';
import { useStage } from './Stage';
import { Text } from './Text';

export function FrameMarks({ crumb }: { crumb?: string }) {
  const theme = useTheme();
  // Pages that scroll would slide under a fixed crumb, so it's TV-only.
  const flow = useStage().mode === 'flow';
  if (!theme.decor.frameMarks) return null;
  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          right: 24,
          bottom: 24,
          borderWidth: 1,
          borderColor: theme.colors.outline,
          opacity: 0.4,
        }}
      />
      {crumb && !flow && (
        <Text variant="meta" color={theme.colors.textMuted} style={{ position: 'absolute', top: 30, left: 80 }}>
          {crumb}
        </Text>
      )}
    </>
  );
}

export function DotMatrix({ opacity = 0.55 }: { opacity?: number }) {
  const theme = useTheme();
  if (!theme.decor.dotMatrix) return null;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="dots" width={8} height={8} patternUnits="userSpaceOnUse">
          <Circle cx={4} cy={4} r={1.3} fill={`rgba(12,12,14,${opacity})`} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#dots)" />
    </Svg>
  );
}

export function Hazard({ color, style }: { color: string; style?: ViewStyle }) {
  const theme = useTheme();
  if (!theme.decor.hazard) return null;
  return (
    <View style={[{ height: 14, overflow: 'hidden', opacity: 0.85 }, style]} pointerEvents="none">
      <Svg width="100%" height={14}>
        <Defs>
          <Pattern id="hazard" width={12} height={14} patternUnits="userSpaceOnUse">
            <Line x1={-2} y1={16} x2={10} y2={-2} stroke={color} strokeWidth={4.5} />
            <Line x1={10} y1={16} x2={22} y2={-2} stroke={color} strokeWidth={4.5} />
          </Pattern>
        </Defs>
        <Rect width="100%" height={14} fill="url(#hazard)" />
      </Svg>
    </View>
  );
}

const BARS = [3, 1, 1, 2, 4, 1, 2, 1, 1, 3, 2, 2, 1, 4, 1, 1, 2, 3, 1, 2, 1, 1, 4, 2, 1, 3, 1, 2, 2, 1, 3, 1];

export function Barcode({ color, width = 300, height = 36 }: { color: string; width?: number; height?: number }) {
  const theme = useTheme();
  if (!theme.decor.hazard) return null;
  const rects: { x: number; w: number }[] = [];
  let x = 0;
  for (let i = 0; x < width; i++) {
    const w = BARS[i % BARS.length];
    if (i % 2 === 0) rects.push({ x, w });
    x += w + (i % 3 === 0 ? 2 : 1);
  }
  return (
    <Svg width={width} height={height} pointerEvents="none">
      {rects.map((r, i) => (
        <Rect key={i} x={r.x} y={0} width={r.w} height={height} fill={color} />
      ))}
    </Svg>
  );
}
