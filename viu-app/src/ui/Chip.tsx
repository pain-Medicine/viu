import { View, ViewStyle } from 'react-native';

import { useTheme } from '../state/settings';
import { Focusable } from './Focusable';
import { Icon } from './Icon';
import { useSurface } from './Surface';
import { Text } from './Text';

interface Props {
  label: string;
  selected?: boolean;
  // Strong fill for status badges such as "Watching".
  badge?: boolean;
  // A check mark, in themes that use them.
  check?: boolean;
  size?: 'md' | 'sm';
  onPress?: () => void;
  onFocus?: () => void;
  autoFocus?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function Chip({ label, selected, badge, check, size = 'md', onPress, onFocus, autoFocus, accessibilityLabel, style }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const onFeature = useSurface() === 'feature';

  let bg = 'transparent';
  let fg = onFeature ? c.featureText : c.text;
  let border = onFeature ? c.featureOutline : c.outline;
  if (badge) {
    bg = c.badge;
    fg = c.onBadge;
    border = bg;
  } else if (selected) {
    bg = onFeature ? c.featureSelected : c.selected;
    fg = onFeature ? c.onFeatureSelected : c.onSelected;
    border = bg;
  }

  const h = size === 'md' ? theme.shape.chipHeight : theme.shape.chipHeight - 6;
  const body = (
    <View
      style={[
        {
          minHeight: h,
          paddingHorizontal: theme.shape.chipPadding,
          borderRadius: theme.shape.chip,
          borderWidth: onFeature ? 1.5 : 1,
          borderColor: border,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        onPress ? null : style,
      ]}
    >
      {check && theme.style.checkMarks && <Icon name="check" size={18} color={fg} />}
      <Text variant={size === 'md' ? (selected || badge ? 'labelBold' : 'label') : selected || badge ? 'metaBold' : 'meta'} color={fg}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body;
  return (
    <Focusable
      onPress={onPress}
      onFocus={onFocus}
      autoFocus={autoFocus}
      selected={selected}
      radius={theme.shape.chip}
      lift={false}
      accessibilityLabel={accessibilityLabel ?? label}
      style={style}
    >
      {body}
    </Focusable>
  );
}
