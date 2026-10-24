import { View, ViewStyle } from 'react-native';

import { useTheme } from '../state/settings';
import { Focusable } from './Focusable';
import { Icon } from './Icon';
import { Text } from './Text';

interface Props {
  label: string;
  selected?: boolean;
  // Inside the feature panel, which is light in the graphic theme.
  onFeature?: boolean;
  // Strong fill for status badges such as "Watching".
  badge?: boolean;
  check?: boolean;
  size?: 'md' | 'sm';
  onPress?: () => void;
  onFocus?: () => void;
  autoFocus?: boolean;
  style?: ViewStyle;
}

export function Chip({ label, selected, onFeature, badge, check, size = 'md', onPress, onFocus, autoFocus, style }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const graphic = theme.panel === 'solid';

  let bg = 'transparent';
  let fg = onFeature ? c.featureText : c.text;
  let border = onFeature ? c.featureOutline : c.outline;
  if (badge) {
    bg = graphic ? c.accent : '#7B2E1E';
    fg = graphic ? c.onAccent : c.accent;
    border = bg;
  } else if (selected) {
    bg = onFeature ? c.featureSelected : c.selected;
    fg = onFeature ? c.onFeatureSelected : c.onSelected;
    border = bg;
  }

  const h = size === 'md' ? 44 : 38;
  const body = (
    <View
      style={[
        {
          height: graphic ? h - 8 : h,
          paddingHorizontal: graphic ? 12 : 16,
          borderRadius: theme.shape.chip,
          borderWidth: graphic && onFeature ? 1.5 : 1,
          borderColor: border,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        onPress ? null : style,
      ]}
    >
      {check && <Icon name="check" size={16} color={fg} square={graphic} />}
      <Text variant={selected || badge ? 'labelBold' : 'label'} size={graphic ? 15 : 18} color={fg}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body;
  return (
    <Focusable onPress={onPress} onFocus={onFocus} autoFocus={autoFocus} radius={theme.shape.chip} lift={false} style={style}>
      {body}
    </Focusable>
  );
}
