import { useRef } from 'react';
import { ScrollView, type ScrollViewInstance, View } from 'react-native';

// A horizontal row of equal-width items that keeps the focused item in view,
// one item in from the left edge, the way TV rows scroll.
export function Rail<T>({
  items,
  itemWidth,
  gap,
  renderItem,
  inset = 0,
}: {
  items: T[];
  itemWidth: number;
  gap: number;
  inset?: number;
  renderItem: (item: T, index: number, onFocus: () => void) => React.ReactNode;
}) {
  const scroll = useRef<ScrollViewInstance>(null);
  const focusAt = (i: number) => scroll.current?.scrollTo({ x: Math.max(0, (i - 1) * (itemWidth + gap)), animated: true });
  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      // Leaves room for the focus ring, which draws outside each card.
      contentContainerStyle={{ gap, paddingHorizontal: inset, paddingVertical: 14 }}
      style={{ marginVertical: -14, overflow: 'visible' }}
    >
      {items.map((item, i) => (
        <View key={i}>{renderItem(item, i, () => focusAt(i))}</View>
      ))}
    </ScrollView>
  );
}
