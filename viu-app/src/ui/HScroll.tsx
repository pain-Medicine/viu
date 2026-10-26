import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, type ScrollViewInstance, StyleProp, View, ViewStyle } from 'react-native';

import { useTheme } from '../state/settings';
import { Icon } from './Icon';

export interface HScrollHandle {
  scrollTo: (x: number) => void;
}

interface Props {
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  // Width of one item plus the gap, so a page lands on an item's edge.
  // Without it a page is most of the visible width.
  itemStep?: number;
  // The band the buttons centre in, such as the art of a card row rather
  // than its captions. The whole row when not given.
  arrowTop?: number;
  arrowHeight?: number;
  // Buttons beside the row instead of over it, for rows of small items such
  // as chips that a button would hide. They stay while the row overflows, and
  // dim at either end, so the row doesn't shift as they come and go.
  beside?: boolean;
  children: React.ReactNode;
}

const ARROW = 52;

// react-native-web adds hovered to Pressable's state; native leaves it out.
const isHovered = (state: object) => (state as { hovered?: boolean }).hovered === true;

// A horizontal row that a remote moves by focus and a finger swipes. A mouse
// can do neither easily, so on the web it gets ‹ › buttons at each end that
// page it, shown only while there's more to see that way.
export const HScroll = forwardRef<HScrollHandle, Props>(function HScroll(
  { style, contentContainerStyle, itemStep, arrowTop = 0, arrowHeight, beside, children },
  ref,
) {
  const theme = useTheme();
  const c = theme.colors;
  const scroll = useRef<ScrollViewInstance>(null);
  const [x, setX] = useState(0);
  const [view, setView] = useState(0);
  const [content, setContent] = useState(0);
  const max = Math.max(0, content - view);
  // Sticky, so the buttons taking room can't make the row fit and hide them.
  const [overflowed, setOverflowed] = useState(false);
  useEffect(() => {
    if (max > 1) setOverflowed(true);
  }, [max]);
  const go = (to: number) => scroll.current?.scrollTo({ x: Math.min(max, Math.max(0, to)), animated: true });
  useImperativeHandle(ref, () => ({ scrollTo: go }));

  const page = (dir: 1 | -1) => {
    if (!itemStep) return go(x + dir * view * 0.8);
    // Whole items per page, and the result snapped to an item's edge.
    const items = Math.max(1, Math.floor(view / itemStep) - 1);
    go(Math.round((x + dir * items * itemStep) / itemStep) * itemStep);
  };

  const arrows = Platform.OS === 'web';
  const button = (dir: 1 | -1, enabled = true) => (
    <Pressable
      focusable={false}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={dir < 0 ? 'Scroll left' : 'Scroll right'}
      accessibilityState={{ disabled: !enabled }}
      onPress={() => page(dir)}
      style={(state) => ({
        width: ARROW,
        height: ARROW,
        borderRadius: Math.min(theme.shape.button, ARROW / 2),
        borderWidth: 1,
        borderColor: c.outline,
        backgroundColor: enabled && isHovered(state) ? c.accent : c.ground,
        opacity: enabled ? 1 : 0.35,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      {(state) => (
        <Icon name={dir < 0 ? 'chevronLeft' : 'chevronRight'} size={28} color={enabled && isHovered(state) ? c.onAccent : c.text} />
      )}
    </Pressable>
  );
  const overlay = (dir: 1 | -1) => (
    <View
      pointerEvents="box-none"
      style={[
        { position: 'absolute', top: arrowTop, justifyContent: 'center' },
        arrowHeight === undefined ? { bottom: 0 } : { height: arrowHeight },
        dir < 0 ? { left: 6 } : { right: 6 },
      ]}
    >
      {button(dir)}
    </View>
  );

  const row = (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={beside ? { flex: 1 } : undefined}
      contentContainerStyle={contentContainerStyle}
      scrollEventThrottle={50}
      onScroll={(e) => setX(e.nativeEvent.contentOffset.x)}
      onLayout={(e) => setView(e.nativeEvent.layout.width)}
      onContentSizeChange={(w) => setContent(w)}
    >
      {children}
    </ScrollView>
  );

  if (beside) {
    const show = arrows && overflowed;
    return (
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: show ? 10 : 0 }, style]}>
        {show && button(-1, x > 1)}
        {row}
        {show && button(1, x < max - 1)}
      </View>
    );
  }
  return (
    <View style={style}>
      {row}
      {arrows && x > 1 && overlay(-1)}
      {arrows && x < max - 1 && overlay(1)}
    </View>
  );
});
