import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';

import { listMedia, Media, trending } from '../api/anilist';
import { useAsync } from '../lib/useAsync';
import { useNav, useScreenActive } from '../nav/navigation';
import { useSettings } from '../state/settings';
import { FrameMarks } from '../ui/Decor';
import { Focusable } from '../ui/Focusable';
import { Empty } from '../ui/Empty';
import { ErrorState } from '../ui/ErrorState';
import { MediaCard, PosterSkeletons } from '../ui/MediaCard';
import { Panel } from '../ui/Panel';
import { Text } from '../ui/Text';
import { formatLabel } from './format';

const KEYS = 'abcdefghijklmnopqrstuvwxyz1234567890'.split('');
const COLS = 5;
const CARD_W = 218;
const CARD_H = 310;
const ROW_STEP = CARD_H + 120;

// A remote has no keyboard, so search uses an on-screen key grid. The web
// build also accepts typing on a real keyboard.
export function SearchScreen() {
  const { theme } = useSettings();
  const c = theme.colors;
  const nav = useNav();
  const active = useScreenActive();

  const [query, setQuery] = useState('');
  const queryRef = useRef(query);
  queryRef.current = query;
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1 && /[\w !'.:-]/.test(e.key)) {
        setQuery((q) => q + e.key.toLowerCase());
        e.preventDefault();
      } else if (e.key === 'Backspace') {
        // Runs before the navigator's Backspace-to-go-back, and stops it
        // while there is text to delete.
        if (queryRef.current) {
          e.stopPropagation();
          e.preventDefault();
          setQuery((q) => q.slice(0, -1));
        }
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [active]);

  const results = useAsync(debounced ? `search:${debounced}` : 'trending', () =>
    debounced ? listMedia({ search: debounced, perPage: 25 }) : trending(),
  );
  const items: Media[] = results.data ?? [];
  const scroll = useRef<ScrollViewInstance>(null);

  const key = (label: string, onPress: () => void, opts: { wide?: boolean; autoFocus?: boolean; mono?: boolean } = {}) => (
    <Focusable
      key={label}
      onPress={onPress}
      autoFocus={opts.autoFocus}
      radius={Math.min(theme.shape.radiusMd, 18)}
      accessibilityLabel={label === ' ' ? 'Space' : label}
      style={{ width: opts.wide ? 226 : 68 }}
    >
      {(focused) => (
        <View
          style={{
            height: 64,
            borderRadius: Math.min(theme.shape.radiusMd, 18),
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: focused ? c.featureSelected : c.key,
            borderWidth: 1,
            borderColor: c.key === 'transparent' ? c.featureOutline : 'transparent',
          }}
        >
          <Text variant={opts.wide ? 'labelBold' : 'key'} color={focused ? c.onFeatureSelected : c.featureText}>
            {label}
          </Text>
        </View>
      )}
    </Focusable>
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <FrameMarks crumb="VIU.TV / SEARCH" />

      <Panel
        kind="chrome"
        radius={28}
        style={{
          position: 'absolute',
          top: 56,
          left: 80,
          right: 80,
          height: 96,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 20,
          paddingHorizontal: 32,
        }}
      >
        <Text variant="query" color={query ? c.text : c.textMuted} style={{ flex: 1 }} numberOfLines={1}>
          {query || 'Search anime'}
          {query ? (
            <Text variant="query" color={c.primary}>
              |
            </Text>
          ) : null}
        </Text>
        <Text variant="label" color={c.textMuted}>
          {results.loading ? 'Searching…' : debounced ? `${items.length} results` : 'Trending now'}
        </Text>
      </Panel>

      <Panel style={{ position: 'absolute', top: 192, left: 80, bottom: 56, width: 520, padding: 28, gap: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {KEYS.map((k, i) => key(k, () => setQuery((q) => q + k), { autoFocus: i === 0 }))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {key('Space', () => setQuery((q) => (q && !q.endsWith(' ') ? `${q} ` : q)), { wide: true })}
          {key('Delete', () => setQuery((q) => q.slice(0, -1)), { wide: true })}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>{key('Clear', () => setQuery(''), { wide: true })}</View>
        <View style={{ flex: 1 }} />
        <Text variant="meta" color={c.featureMuted}>
          {Platform.OS === 'web' ? 'Type on your keyboard or use the keys above.' : 'Titles come from AniList.'}
        </Text>
      </Panel>

      <ScrollView
        ref={scroll}
        style={{ position: 'absolute', top: 178, left: 634, right: 66, bottom: 0 }}
        contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 32, padding: 14, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {results.error && (
          <ErrorState
            compact
            autoFocus={false}
            error={results.error}
            service="AniList"
            title="Search didn't work"
            onRetry={results.retry}
          />
        )}
        {results.loading && !items.length && <PosterSkeletons count={10} width={CARD_W} height={CARD_H} />}
        {!results.loading && debounced && !items.length && !results.error && (
          <Empty
            title={`Nothing called “${debounced}”`}
            body="AniList matches whole words, so keep typing, or try the English or Japanese title."
          />
        )}
        {items.map((m, i) => (
          <MediaCard
            key={m.id}
            media={m}
            shape="poster"
            width={CARD_W}
            height={CARD_H}
            meta={[m.seasonYear, formatLabel(m)].filter(Boolean).join(' · ')}
            onFocus={() => scroll.current?.scrollTo({ y: Math.max(0, Math.floor(i / COLS) * ROW_STEP - 0), animated: true })}
            onPress={() => nav.push({ name: 'details', mediaId: m.id })}
          />
        ))}
      </ScrollView>
    </View>
  );
}
