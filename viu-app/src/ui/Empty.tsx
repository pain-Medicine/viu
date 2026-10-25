import { View, ViewStyle } from 'react-native';

import { useTheme } from '../state/settings';
import { Button } from './Button';
import { useSurface } from './Surface';
import { Text } from './Text';

// A list with nothing in it: what's missing, and how to fill it.
export function Empty({
  title,
  body,
  action,
  style,
}: {
  title: string;
  body: string;
  // The way to fill it, such as "Browse titles".
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const onFeature = useSurface() === 'feature';
  return (
    <View style={[{ gap: 10, maxWidth: 900, paddingVertical: 8 }, style]}>
      <Text variant="item" color={onFeature ? theme.colors.featureText : theme.colors.text}>
        {title}
      </Text>
      <Text color={onFeature ? theme.colors.featureMuted : theme.colors.textMuted}>{body}</Text>
      {action && (
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <Button size="sm" icon="grid" optionalIcon label={action.label} onPress={action.onPress} />
        </View>
      )}
    </View>
  );
}
