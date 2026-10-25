import { View } from 'react-native';

import { useNav } from '../nav/navigation';
import { useTheme } from '../state/settings';
import { Focusable } from './Focusable';
import { Icon, IconName } from './Icon';
import { Panel } from './Panel';
import { useStage } from './Stage';
import { Text } from './Text';

type Section = 'home' | 'browse' | 'schedule' | 'mylist' | 'search' | 'settings';

const ITEMS: { id: Exclude<Section, 'settings'>; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'browse', label: 'Browse', icon: 'grid' },
  { id: 'schedule', label: 'Schedule', icon: 'calendar' },
  { id: 'mylist', label: 'My List', icon: 'bookmark' },
  { id: 'search', label: 'Search', icon: 'search' },
];

const ITEM_H = 60;

export function TopNav({ active }: { active: Section }) {
  const theme = useTheme();
  const c = theme.colors;
  const nav = useNav();
  // Short of the full design width the labels stay and the icons go, which
  // keeps every item one tap or press away.
  const { narrow } = useStage();
  const side = narrow ? undefined : 300;

  return (
    <View
      style={{
        position: 'absolute',
        top: theme.layout.navTop,
        left: 80,
        right: 80,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ width: side, flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
        <Text variant="logo" color={c.primary}>
          viu
        </Text>
        {theme.decor.indexLabels && !narrow && (
          <Text variant="meta" color={c.textMuted}>
            Anime / TV
          </Text>
        )}
      </View>

      <Panel
        kind="chrome"
        style={{ flexDirection: 'row', alignItems: 'center', gap: theme.shape.navPadding ? 6 : 0, padding: theme.shape.navPadding }}
      >
        {ITEMS.map((item, i) => {
          const on = item.id === active;
          const fg = on ? c.onSelected : c.navText;
          return (
            <Focusable
              key={item.id}
              onPress={() => nav.goTo({ name: item.id })}
              radius={theme.shape.button}
              lift={false}
              selected={on}
              role="tab"
              accessibilityLabel={item.label}
            >
              <View
                style={{
                  minHeight: ITEM_H,
                  paddingHorizontal: narrow ? 18 : 24,
                  borderRadius: theme.shape.button,
                  backgroundColor: on ? c.selected : 'transparent',
                  borderLeftWidth: theme.style.navDividers && i > 0 ? 1 : 0,
                  borderColor: c.outline,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                {narrow ? null : theme.decor.indexLabels ? (
                  <Text variant={on ? 'metaBold' : 'meta'} color={on ? c.onSelected : c.textMuted}>
                    {String(i + 1).padStart(2, '0')}
                  </Text>
                ) : (
                  <Icon name={item.icon} size={24} color={fg} />
                )}
                <Text variant="nav" color={fg}>
                  {item.label}
                </Text>
              </View>
            </Focusable>
          );
        })}
      </Panel>

      <View style={{ width: side, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Focusable
          onPress={() => nav.goTo({ name: 'settings' })}
          radius={theme.shape.button}
          selected={active === 'settings'}
          accessibilityLabel="Settings"
        >
          <Panel kind="chrome" style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="settings" size={28} color={active === 'settings' ? c.primary : c.navText} />
          </Panel>
        </Focusable>
      </View>
    </View>
  );
}
