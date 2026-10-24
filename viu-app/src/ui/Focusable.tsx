import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Animated, Easing, type HostInstance, Platform, Pressable, StyleProp, View, ViewStyle } from 'react-native';

import { noteKeyFocus, useInputMode } from '../lib/inputMode';
import { useReduceMotion } from '../lib/useReduceMotion';
import { useTheme } from '../state/settings';
import { CornerBrackets } from './Shapes';
import { useSurface } from './Surface';

interface Props {
  onPress?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: StyleProp<ViewStyle>;
  // Corner radius of the focused content, so the ring can follow it.
  radius?: number;
  // Takes focus when the screen opens (D-pad starting point), and again
  // whenever this turns from false to true.
  autoFocus?: boolean;
  // Grows the item slightly while focused.
  lift?: boolean;
  // Chosen option in a group (a chip, a tab, a theme).
  selected?: boolean;
  // Still focusable, so a remote can land on it and read why, but does nothing.
  disabled?: boolean;
  // False takes it out of D-pad focus entirely, such as hidden player controls.
  focusable?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  children: React.ReactNode | ((focused: boolean) => React.ReactNode);
}

export interface FocusableHandle {
  focus: () => void;
}

type Focusing = { focus?: (options?: { preventScroll?: boolean }) => void; requestTVFocus?: () => void };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const nativeDriver = Platform.OS !== 'web';
const LIFT = 1.06;
const DURATION = 160;

// The one place that decides what "focused" looks like. Every interactive
// element goes through here so both themes and both platforms stay consistent.
// Focus is the app's one animated moment: the item lifts and the ring fades in
// with a short ease-out, or snaps when the system asks for less motion.
export const Focusable = forwardRef<FocusableHandle, Props>(function Focusable(
  {
    onPress,
    onFocus,
    onBlur,
    style,
    radius = 0,
    autoFocus,
    lift = true,
    selected,
    disabled,
    focusable = true,
    accessibilityLabel,
    accessibilityHint,
    children,
  },
  ref,
) {
  const theme = useTheme();
  const surface = useSurface();
  const reduceMotion = useReduceMotion();
  const [hasFocus, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  // A tap or click focuses too, but only a remote or keyboard needs to see
  // where focus is.
  const keys = useInputMode() === 'keys';
  const focused = hasFocus && keys;
  // The ring stays mounted while it fades out, and not at all otherwise, so
  // a screen full of keys or cards doesn't carry hundreds of idle rings.
  const [ringOn, setRingOn] = useState(false);
  const inner = useRef<HostInstance>(null);
  const progress = useRef(new Animated.Value(0)).current;

  const focusNow = () => {
    const el = inner.current as unknown as Focusing | null;
    // The page shouldn't jump to a starting point the viewer may never use.
    if (Platform.OS === 'web') el?.focus?.({ preventScroll: true });
    else (el?.requestTVFocus ?? el?.focus)?.call(el);
  };
  useImperativeHandle(ref, () => ({ focus: focusNow }));

  useEffect(() => {
    // A phone or tablet starts with nothing focused, the way touch apps do;
    // a keyboard picks up from wherever it first lands.
    if (!autoFocus || !focusable || (Platform.OS !== 'web' && !Platform.isTV)) return;
    // Native TV builds take the first focus from hasTVPreferredFocus; later
    // ones, and the web, need asking.
    const t = setTimeout(focusNow, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, focusable]);

  useEffect(() => {
    const to = focused ? 1 : 0;
    if (focused) setRingOn(true);
    if (reduceMotion) {
      progress.setValue(to);
      if (!focused) setRingOn(false);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: to,
      duration: DURATION,
      easing: Easing.out(Easing.exp),
      useNativeDriver: nativeDriver,
    });
    anim.start(({ finished }) => {
      if (finished && !focused) setRingOn(false);
    });
    return () => anim.stop();
  }, [focused, reduceMotion, progress]);

  const gap = 8;
  const tvProps = Platform.isTV ? { hasTVPreferredFocus: !!autoFocus && focusable } : {};
  const color = surface === 'feature' ? theme.colors.featureFocus : theme.colors.focus;
  const scale = lift ? progress.interpolate({ inputRange: [0, 1], outputRange: [1, LIFT] }) : 1;

  return (
    <AnimatedPressable
      ref={inner}
      {...tvProps}
      focusable={focusable}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}
      onPress={disabled ? undefined : onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onFocus={() => {
        if (Platform.OS !== 'web' && !Platform.isTV) noteKeyFocus();
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
      style={[
        style,
        { transform: [{ scale }] },
        disabled ? { opacity: 0.45 } : pressed && !keys ? { opacity: 0.7 } : null,
        Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null,
      ]}
    >
      {typeof children === 'function' ? children(focused) : children}
      {ringOn && (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: -gap, left: -gap, right: -gap, bottom: -gap, opacity: progress }}
        >
          {theme.focus === 'ring' ? (
            <View
              style={{
                flex: 1,
                borderRadius: radius >= 999 ? 999 : radius + gap,
                borderWidth: 4,
                borderColor: color,
              }}
            />
          ) : (
            <CornerBrackets color={color} arm={20} width={4} />
          )}
        </Animated.View>
      )}
    </AnimatedPressable>
  );
});
