import { View, ViewStyle } from 'react-native';

import { useTheme } from '../state/settings';

export function ProgressBar({
  value,
  height = 6,
  color,
  track,
  style,
}: {
  value: number;
  height?: number;
  color?: string;
  track?: string;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const r = theme.shape.radiusSm > 0 ? height / 2 : 0;
  return (
    <View style={[{ height, borderRadius: r, backgroundColor: track ?? theme.colors.progressTrack, overflow: 'hidden' }, style]}>
      <View
        style={{
          width: `${Math.round(Math.max(0, Math.min(1, value)) * 1000) / 10}%`,
          height,
          borderRadius: r,
          backgroundColor: color ?? theme.colors.progress,
        }}
      />
    </View>
  );
}
