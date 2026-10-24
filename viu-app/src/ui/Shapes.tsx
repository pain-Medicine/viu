import { useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';

// A filled box with its top-right corner cut off. React Native has no
// clip-path, so the shape is drawn as an SVG behind the content.
export function ChamferBox({
  color,
  cut,
  style,
  children,
}: {
  color: string;
  cut: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const { w, h } = size;
  return (
    <View style={style} onLayout={onLayout}>
      {w > 0 && (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Polygon points={`0,0 ${w - cut},0 ${w},${cut} ${w},${h} 0,${h}`} fill={color} />
        </Svg>
      )}
      {children}
    </View>
  );
}

// Four L-shaped corner marks, used as the focus indicator in the graphic theme
// and as the screen frame.
export function CornerBrackets({ color, arm = 14, width = 3 }: { color: string; arm?: number; width?: number }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w, h } = size;
  const o = width / 2;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {w > 0 && (
        <Svg width={w} height={h}>
          <Path
            d={`M${o} ${arm}V${o}H${arm} M${w - arm} ${o}H${w - o}V${arm} M${w - o} ${h - arm}V${h - o}H${w - arm} M${arm} ${h - o}H${o}V${h - arm}`}
            stroke={color}
            strokeWidth={width}
            fill="none"
          />
        </Svg>
      )}
    </View>
  );
}
