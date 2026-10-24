import { View } from 'react-native';

import { useNav } from '../nav/navigation';
import { useTheme } from '../state/settings';
import { Focusable } from './Focusable';
import { Icon, IconName } from './Icon';
import { Panel } from './Panel';
import { Text } from './Text';

type Section = 'home' | 'browse' | 'schedule' | 'mylist' | 'search' | 'settings';

const ITEMS: { id: Exclude<Section, 'settings'>; label: string; icon?: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'browse', label: 'Browse', icon: 'grid' },
  { id: 'schedule', label: 'Schedule', icon: 'calendar' },
  { id: 'mylist', label: 'My List', icon: 'bookmark' },
  { id: 'search', label: 'Search', icon: 'search' },
];

export function TopNav({ active }: { active: Section }) {
  const theme = useTheme();
  const c = theme.colors;
  const nav = useNav();
  const graphic = theme.panel === 'solid';

  return (
    <View
      style={{
        position: 'absolute',
        top: graphic ? 60 : 40,
        left: 80,
        right: 80,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ width: 300, flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
        <Text variant="display" size={graphic ? 52 : 36} color={c.primary} style={{ lineHeight: graphic ? 52 : 44, letterSpacing: graphic ? 1 : -1.8 }}>
          viu
        </Text>
        {graphic && (
          <Text variant="label" size={13} color={c.textMuted}>
            Anime / TV
          </Text>
        )}
      </View>

      <Panel kind="chrome" style={{ flexDirection: 'row', alignItems: 'center', gap: graphic ? 0 : 6, padding: graphic ? 0 : 8 }}>
        {ITEMS.map((item, i) => {
          const on = item.id === active;
          return (
            <Focusable key={item.id} onPress={() => nav.goTo({ name: item.id })} radius={theme.shape.button} lift={false}>
              <View
                style={{
                  height: graphic ? 60 : 56,
                  paddingHorizontal: graphic ? 24 : 24,
                  borderRadius: theme.shape.button,
                  backgroundColor: on ? c.selected : 'transparent',
                  borderLeftWidth: graphic && i > 0 ? 1 : 0,
                  borderColor: c.outline,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                {graphic ? (
                  <Text variant={on ? 'labelBold' : 'label'} size={13} color={on ? c.onSelected : c.textMuted}>
                    {String(i + 1).padStart(2, '0')}
                  </Text>
                ) : (
                  item.icon && <Icon name={item.icon} size={24} color={on ? c.onSelected : c.textMuted} />
                )}
                <Text
                  variant={graphic ? 'title' : 'bodyBold'}
                  size={graphic ? 26 : 22}
                  color={on ? c.onSelected : graphic ? c.text : c.textMuted}
                  style={{ letterSpacing: graphic ? 1.5 : -0.2, lineHeight: graphic ? 30 : 28 }}
                >
                  {item.label}
                </Text>
              </View>
            </Focusable>
          );
        })}
      </Panel>

      <View style={{ width: 300, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Focusable onPress={() => nav.goTo({ name: 'settings' })} radius={theme.shape.button} accessibilityLabel="Settings">
          <Panel
            kind="chrome"
            style={{
              width: graphic ? 60 : 64,
              height: graphic ? 60 : 64,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="settings" size={26} color={active === 'settings' ? c.primary : c.textMuted} square={graphic} />
          </Panel>
        </Focusable>
      </View>
    </View>
  );
}
