import { BlurView } from 'expo-blur';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '../state/settings';
import { ChamferBox } from './Shapes';

interface Props {
  // "feature": the large content panel (Continue watching, episode list).
  // "chrome": small floating bars such as the nav and player pills.
  kind?: 'feature' | 'chrome';
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

// Real blur is costly on TV GPUs and Android's BlurView needs an experimental
// path, so Android draws the same tint without the blur.
const canBlur = Platform.OS !== 'android';

export function Panel({ kind = 'feature', radius, style, children }: Props) {
  const theme = useTheme();
  const c = theme.colors;

  if (theme.panel === 'solid') {
    if (kind === 'feature') {
      return (
        <ChamferBox color={c.featureBg} cut={theme.shape.chamfer * 2} style={style}>
          {children}
        </ChamferBox>
      );
    }
    return (
      <View style={[{ backgroundColor: c.chrome, borderWidth: 1, borderColor: c.outline }, style]}>{children}</View>
    );
  }

  const r = radius ?? (kind === 'feature' ? theme.shape.radiusLg : 999);
  const tint = kind === 'feature' ? c.featureBg : c.chrome;
  return (
    <View
      style={[
        {
          borderRadius: r,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: kind === 'feature' ? c.featureOutline : 'rgba(255,255,255,0.14)',
          backgroundColor: canBlur ? tint : 'rgba(36,25,23,0.9)',
        },
        style,
      ]}
    >
      {canBlur && <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />}
      {canBlur && <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} pointerEvents="none" />}
      {children}
    </View>
  );
}
