import { useRef } from 'react';
import { View } from 'react-native';

import { HScroll, type HScrollHandle } from './HScroll';

// Leaves room for the focus ring, which draws outside each card. The row
// clips at its own edges, so it scrolls inside its panel and never the page.
const RING_ROOM = 14;

// A horizontal row of equal-width items that keeps the focused item in view,
// one item in from the left edge, the way TV rows scroll.
export function Rail<T>({
  items,
  itemWidth,
  gap,
  renderItem,
  inset = 0,
  artHeight,
}: {
  items: T[];
  itemWidth: number;
  gap: number;
  inset?: number;
  // Height of each item's art, so the web's ‹ › buttons centre on it.
  artHeight?: number;
  renderItem: (item: T, index: number, onFocus: () => void) => React.ReactNode;
}) {
  const scroll = useRef<HScrollHandle>(null);
  const focusAt = (i: number) => scroll.current?.scrollTo(Math.max(0, (i - 1) * (itemWidth + gap)));
  return (
    <HScroll
      ref={scroll}
      itemStep={itemWidth + gap}
      arrowTop={RING_ROOM}
      arrowHeight={artHeight}
      contentContainerStyle={{ gap, paddingHorizontal: inset, paddingVertical: RING_ROOM }}
      style={{ marginVertical: -RING_ROOM }}
    >
      {items.map((item, i) => (
        <View key={i}>{renderItem(item, i, () => focusAt(i))}</View>
      ))}
    </HScroll>
  );
}
