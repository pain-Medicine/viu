import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { type HostInstance, Platform, Pressable, StyleProp, View, ViewStyle } from 'react-native';

import { useTheme } from '../state/settings';
import { CornerBrackets } from './Shapes';

interface Props {
  onPress?: () => void;
  onFocus?: () => void;
  style?: StyleProp<ViewStyle>;
  // Corner radius of the focused content, so the ring can follow it.
  radius?: number;
  // Takes focus when the screen opens (D-pad starting point).
  autoFocus?: boolean;
  // Grows the item slightly while focused.
  lift?: boolean;
  accessibilityLabel?: string;
  children: React.ReactNode | ((focused: boolean) => React.ReactNode);
}

export interface FocusableHandle {
  focus: () => void;
}

// The one place that decides what "focused" looks like. Every interactive
// element goes through here so both themes and both platforms stay consistent.
export const Focusable = forwardRef<FocusableHandle, Props>(function Focusable(
  { onPress, onFocus, style, radius = 0, autoFocus, lift = true, accessibilityLabel, children },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const inner = useRef<HostInstance>(null);

  useImperativeHandle(ref, () => ({ focus: () => (inner.current as unknown as HTMLElement)?.focus?.() }));

  useEffect(() => {
    if (autoFocus && Platform.OS === 'web') {
      const t = setTimeout(() => (inner.current as unknown as HTMLElement)?.focus?.(), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const gap = 8;
  const tvProps = Platform.isTV ? { hasTVPreferredFocus: !!autoFocus } : {};

  return (
    <Pressable
      ref={inner}
      {...tvProps}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      style={[
        style,
        { transform: [{ scale: focused && lift ? 1.06 : 1 }] },
        Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null,
      ]}
    >
      {typeof children === 'function' ? children(focused) : children}
      {focused &&
        (theme.focus === 'ring' ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -gap,
              left: -gap,
              right: -gap,
              bottom: -gap,
              borderRadius: radius >= 999 ? 999 : radius + gap,
              borderWidth: 4,
              borderColor: theme.colors.focus,
            }}
          />
        ) : (
          <View pointerEvents="none" style={{ position: 'absolute', top: -gap, left: -gap, right: -gap, bottom: -gap }}>
            <CornerBrackets color={theme.colors.focus} />
          </View>
        ))}
    </Pressable>
  );
});
