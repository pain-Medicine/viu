import { forwardRef } from 'react';
import { View, ViewStyle } from 'react-native';

import { useTheme } from '../state/settings';
import { Focusable, FocusableHandle } from './Focusable';
import { Icon, IconName } from './Icon';
import { ChamferBox } from './Shapes';
import { useSurface } from './Surface';
import { Text } from './Text';

type Variant = 'primary' | 'tonal' | 'outline' | 'ghost';

interface Props {
  label?: string;
  icon?: IconName;
  // The icon only decorates the label, so themes without button icons drop it.
  optionalIcon?: boolean;
  variant?: Variant;
  size?: 'lg' | 'md' | 'sm';
  onPress?: () => void;
  onFocus?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
  focusable?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

// Heights leave room for labels at Android TV's largest font scale.
const SIZES = {
  lg: { h: 76, pad: 36, font: 26, icon: 26 },
  md: { h: 64, pad: 28, font: 22, icon: 24 },
  sm: { h: 56, pad: 22, font: 20, icon: 22 },
};

export const Button = forwardRef<FocusableHandle, Props>(function Button(
  {
    label,
    icon,
    optionalIcon,
    variant = 'tonal',
    size = 'md',
    onPress,
    onFocus,
    autoFocus,
    disabled,
    focusable,
    accessibilityLabel,
    style,
  },
  ref,
) {
  const theme = useTheme();
  const c = theme.colors;
  const s = SIZES[size];
  const onFeature = useSurface() === 'feature';
  const iconOnly = !label;
  const shownIcon = icon && (iconOnly || !optionalIcon || theme.style.buttonIcons) ? icon : undefined;

  const fg = variant === 'primary' ? c.onPrimary : variant === 'tonal' ? c.onTonal : onFeature ? c.featureText : c.text;
  const bg = variant === 'primary' ? c.primary : variant === 'tonal' ? c.tonal : 'transparent';
  const bordered = variant === 'outline' || variant === 'tonal';

  const box: ViewStyle = {
    minHeight: s.h,
    minWidth: iconOnly ? s.h : undefined,
    paddingHorizontal: iconOnly ? 0 : s.pad,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  };

  const content = (
    <>
      {shownIcon && <Icon name={shownIcon} size={s.icon} color={fg} />}
      {label && (
        <Text variant="button" size={Math.round(s.font * theme.buttonScale)} color={fg} numberOfLines={1}>
          {label}
        </Text>
      )}
    </>
  );

  // A cut corner can't be drawn with borderRadius, so a chamfered filled
  // button gets an SVG background instead.
  const chamfered = theme.shape.chamfer > 0 && variant === 'primary';

  return (
    <Focusable
      ref={ref}
      onPress={onPress}
      onFocus={onFocus}
      autoFocus={autoFocus}
      disabled={disabled}
      focusable={focusable}
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
              borderColor: onFeature && variant === 'outline' ? c.featureOutline : c.buttonOutline,
            },
          ]}
        >
          {content}
        </View>
      )}
    </Focusable>
  );
});
