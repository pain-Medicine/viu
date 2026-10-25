import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, type ScrollViewInstance, StyleSheet, TextInput, View } from 'react-native';

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
import { gridColumns, gridGap, useCardSize, useStage } from '../ui/Stage';
import { Text, textStyle } from '../ui/Text';
import { TopNav } from '../ui/TopNav';
import { formatLabel } from './format';

const KEYS = 'abcdefghijklmnopqrstuvwxyz1234567890'.split('');
const CARD_W = 218;
const CARD_H = 310;

// A remote has no keyboard, so on a TV search uses an on-screen key grid.
// Phones, tablets and the web get a real text field and their own keyboard.
export function SearchScreen() {
  const { theme } = useSettings();
  const c = theme.colors;
  const nav = useNav();
  const active = useScreenActive();
  const stage = useStage();
  const { cardW, cardH, rowStep } = useCardSize(CARD_W, CARD_H);
  const keyGrid = Platform.isTV;
  const flow = stage.mode === 'flow';
  const gridLeft = keyGrid ? 634 : 66;
  const gridW = stage.width - gridLeft - 66;
  const cols = gridColumns(gridW, cardW);
  const colGap = gridGap(gridW, cardW);

  const [query, setQuery] = useState('');
  const queryRef = useRef(query);
  queryRef.current = query;
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !active || !keyGrid) return;
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
  }, [active, keyGrid]);

  const results = useAsync(debounced ? `search:${debounced}` : 'trending', () =>
    debounced ? listMedia({ search: debounced, perPage: 25 }) : trending(),
  );
  const items: Media[] = results.data ?? [];
  const scroll = useRef<ScrollViewInstance>(null);
  // Where the results start inside the scroll view.
  const gridTop = useRef(0);

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

  const searchBar = (style: object) => (
    <Panel
      kind="chrome"
      radius={28}
      style={{ height: 96, flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 32, ...style }}
    >
      {keyGrid ? (
        <Text variant="query" color={query ? c.text : c.textMuted} style={{ flex: 1 }} numberOfLines={1}>
          {query || 'Search anime'}
          {query ? (
            <Text variant="query" color={c.primary}>
              |
            </Text>
          ) : null}
        </Text>
      ) : (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search anime"
          placeholderTextColor={c.textMuted}
          selectionColor={c.primary}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search anime"
          autoFocus={Platform.OS === 'web'}
          style={[
            textStyle(theme, 'query'),
            // Positioned, so the web build paints it above the panel's blur layer.
            { flex: 1, color: c.text, padding: 0, position: 'relative' },
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
          ]}
        />
      )}
      <Text variant="label" color={c.textMuted}>
        {results.loading ? 'Searching…' : debounced ? `${items.length} results` : 'Trending now'}
      </Text>
    </Panel>
  );

  const cards = (
    <>
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
      {results.loading && !items.length && <PosterSkeletons count={10} width={cardW} height={cardH} />}
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
          width={cardW}
          height={cardH}
          meta={[m.seasonYear, formatLabel(m)].filter(Boolean).join(' · ')}
          onFocus={() =>
            scroll.current?.scrollTo({ y: Math.max(0, gridTop.current + Math.floor(i / cols) * rowStep - (flow ? 160 : 0)), animated: true })
          }
          onPress={() => nav.push({ name: 'details', mediaId: m.id })}
        />
      ))}
    </>
  );
  const gridStyle = { flexDirection: 'row', flexWrap: 'wrap', columnGap: colGap, rowGap: 32, padding: 14 } as const;

  // Off the TV, Search is one of the sections like any other: the nav stays
  // on top, and the field and results scroll as one page.
  if (flow) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <ScrollView
          ref={scroll}
          style={StyleSheet.absoluteFill}
          contentContainerStyle={{ paddingTop: theme.layout.contentTop, paddingHorizontal: 66, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TopNav active="search" />
          {searchBar({ marginHorizontal: 14 })}
          <View style={[gridStyle, { marginTop: 12 }]} onLayout={(e) => (gridTop.current = e.nativeEvent.layout.y)}>
            {cards}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <FrameMarks crumb="VIU.TV / SEARCH" />

      {searchBar({ position: 'absolute', top: 56, left: 80, right: 80 })}

      {keyGrid && (
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
            Titles come from AniList.
          </Text>
        </Panel>
      )}

      <ScrollView
        ref={scroll}
        style={{ position: 'absolute', top: 178, left: gridLeft, right: 66, bottom: 0 }}
        contentContainerStyle={[gridStyle, { paddingBottom: 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {cards}
      </ScrollView>
    </View>
  );
}
