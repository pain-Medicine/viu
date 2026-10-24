import { forwardRef } from 'react';
import { View, ViewStyle } from 'react-native';

import { useTheme } from '../state/settings';
import { Focusable, FocusableHandle } from './Focusable';
import { Icon, IconName } from './Icon';
import { ChamferBox } from './Shapes';
import { Text } from './Text';

type Variant = 'primary' | 'tonal' | 'outline' | 'ghost';

interface Props {
  label?: string;
  icon?: IconName;
  variant?: Variant;
  size?: 'lg' | 'md' | 'sm';
  onPress?: () => void;
  onFocus?: () => void;
  autoFocus?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

const SIZES = {
  lg: { h: 76, pad: 36, font: 26, icon: 26 },
  md: { h: 64, pad: 26, font: 22, icon: 24 },
  sm: { h: 52, pad: 20, font: 19, icon: 20 },
};

export const Button = forwardRef<FocusableHandle, Props>(function Button(
  { label, icon, variant = 'tonal', size = 'md', onPress, onFocus, autoFocus, accessibilityLabel, style },
  ref,
) {
  const theme = useTheme();
  const c = theme.colors;
  const s = SIZES[size];
  const graphic = theme.panel === 'solid';
  const iconOnly = !label;

  const fg = variant === 'primary' ? c.onPrimary : variant === 'tonal' ? c.onTonal : c.text;
  const bg = variant === 'primary' ? c.primary : variant === 'tonal' ? c.tonal : 'transparent';
  const bordered = variant === 'outline' || variant === 'tonal';

  const box: ViewStyle = {
    height: s.h,
    minWidth: iconOnly ? s.h : undefined,
    paddingHorizontal: iconOnly ? 0 : s.pad,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  };

  const content = (
    <>
      {icon && <Icon name={icon} size={s.icon} color={fg} square={graphic} />}
      {label && (
        <Text
          variant="title"
          size={graphic ? s.font + 6 : s.font}
          color={fg}
          style={{ letterSpacing: graphic ? 1.5 : -0.2 }}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </>
  );

  // A cut corner can't be drawn with borderRadius, so the graphic theme's
  // filled button gets an SVG background instead.
  const chamfered = graphic && variant === 'primary';

  return (
    <Focusable
      ref={ref}
      onPress={onPress}
      onFocus={onFocus}
      autoFocus={autoFocus}
      radius={theme.shape.button}
      accessibilityLabel={accessibilityLabel ?? label}
      style={style}
    >
      {chamfered ? (
        <ChamferBox color={bg} cut={theme.shape.chamfer} style={box}>
          {content}
        </ChamferBox>
      ) : (
        <View
          style={[
            box,
            {
              backgroundColor: bg,
              borderRadius: theme.shape.button,
              borderWidth: bordered ? 1 : 0,
              borderColor: graphic ? 'rgba(232,228,218,0.6)' : 'rgba(255,255,255,0.16)',
            },
          ]}
        >
          {content}
        </View>
      )}
    </Focusable>
  );
});
