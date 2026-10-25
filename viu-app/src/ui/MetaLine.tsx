import { useState } from 'react';
import { View, ViewStyle } from 'react-native';

import type { TextRole } from '../theme/types';
import { Text } from './Text';

// "2026 · ONA · 10 episodes · Trigger" that wraps between parts, never inside
// one, and never leaves a dot hanging at the end of a line. Each part carries
// its own trailing dot, which turns invisible (keeping its width, so nothing
// reflows) when the next part starts a new line.
export function MetaLine({
  parts,
  variant = 'label',
  color,
  style,
}: {
  parts: string[];
  variant?: TextRole;
  color?: string;
  style?: ViewStyle;
}) {
  const [tops, setTops] = useState<number[]>([]);
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap' }, style]} accessible accessibilityLabel={parts.join(', ')}>
      {parts.map((part, i) => {
        const last = i === parts.length - 1;
        const wraps = !last && tops[i + 1] !== undefined && tops[i] !== undefined && tops[i + 1] > tops[i] + 1;
        return (
          <View
            key={i}
            style={{ flexDirection: 'row' }}
            onLayout={(e) => {
              const y = e.nativeEvent.layout.y;
              setTops((prev) => (prev[i] === y ? prev : Object.assign([...prev], { [i]: y })));
            }}
          >
            <Text variant={variant} color={color} numberOfLines={1}>
              {part}
            </Text>
            {!last && (
              <Text variant={variant} color={color} style={{ opacity: wraps ? 0 : 1 }}>
                {'  ·  '}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
