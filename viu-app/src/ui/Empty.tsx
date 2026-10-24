import { View, ViewStyle } from 'react-native';

import { useTheme } from '../state/settings';
import { useSurface } from './Surface';
import { Text } from './Text';

// A list with nothing in it: what's missing, and how to fill it.
export function Empty({ title, body, style }: { title: string; body: string; style?: ViewStyle }) {
  const theme = useTheme();
  const onFeature = useSurface() === 'feature';
  return (
    <View style={[{ gap: 10, maxWidth: 900, paddingVertical: 8 }, style]}>
      <Text variant="item" color={onFeature ? theme.colors.featureText : theme.colors.text}>
        {title}
      </Text>
      <Text color={onFeature ? theme.colors.featureMuted : theme.colors.textMuted}>{body}</Text>
    </View>
  );
}
