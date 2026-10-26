import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, type ScrollViewInstance, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';

import { allTimePopular, displayTitle, getMany, Media, plainDescription, popularThisSeason, trending } from '../api/anilist';
import { useAsync } from '../lib/useAsync';
import { useNav } from '../nav/navigation';
import { providerFor } from '../providers';
import { HistoryEntry, progressOf, upNext, useHistory } from '../state/history';
import { useSettings } from '../state/settings';
import { Backdrop, HeroScrim, Skeleton } from '../ui/Art';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Barcode, DotMatrix, FrameMarks, Hazard } from '../ui/Decor';
import { ErrorState } from '../ui/ErrorState';
import { MediaCard } from '../ui/MediaCard';
import { Panel } from '../ui/Panel';
import { ProgressBar } from '../ui/ProgressBar';
import { Rail } from '../ui/Rail';
import { useStage } from '../ui/Stage';
import { Text } from '../ui/Text';
import { TopNav } from '../ui/TopNav';
import { countLabel, formatLabel, metaLine, minutesLeft } from './format';

const ROW_H = 318;
// The next row's heading shows under the current one, so it's clear there's
// more below.
const PEEK = 70;
const CARD_W = 330;
const CARD_H = 186;
const CARD_GAP = 22;
const ROW_INSET = 28;
// The hero waits this long after focus settles before swapping art, so
// running along a row doesn't load a banner per press.
const HERO_DELAY_MS = 150;

interface Row {
  key: string;
  title: string;
  items: Media[];
}

export function HomeScreen() {
  const { theme, settings } = useSettings();
  const c = theme.colors;
  const nav = useNav();
  const history = useHistory();
  const stage = useStage();
  // TV: a fixed hero over a panel of rows that pages with the D-pad. Elsewhere
  // the page scrolls, hero first and then every row, like a phone app.
  const flow = stage.mode === 'flow';
  const compact = stage.short;

  const historyIds = history.entries.slice(0, 20).map((e) => e.mediaId);
  const watching = useAsync(historyIds.length ? `many:${historyIds.join(',')}` : null, () => getMany(historyIds));
  const trend = useAsync('trending', trending);
  const season = useAsync('season', popularThisSeason);
  const popular = useAsync('popular', allTimePopular);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (watching.data?.length) out.push({ key: 'continue', title: 'Continue watching', items: watching.data });
    if (trend.data?.length) out.push({ key: 'trending', title: 'Trending now', items: trend.data });
    if (season.data?.length) out.push({ key: 'season', title: 'Popular this season', items: season.data });
    if (popular.data?.length) out.push({ key: 'popular', title: 'All-time popular', items: popular.data });
    return out;
  }, [watching.data, trend.data, season.data, popular.data]);

  // The hero follows whichever card has focus, like a Netflix row.
  const [heroId, setHeroId] = useState<number | null>(null);
  const all = useMemo(() => rows.flatMap((r) => r.items), [rows]);
  const hero = all.find((m) => m.id === heroId) ?? rows[0]?.items[0];
  const entry = hero ? history.get(hero.id) : undefined;

  const vertical = useRef<ScrollViewInstance>(null);
  const [activeRow, setActiveRow] = useState(0);
  const activeRowRef = useRef(0);
  const heroTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(heroTimer.current), []);

  // Stable, so focusing a card re-renders the hero but not every row.
  const onCardFocus = useCallback(
    (m: Media, r: number) => {
      clearTimeout(heroTimer.current);
      heroTimer.current = setTimeout(() => setHeroId(m.id), HERO_DELAY_MS);
      if (r !== activeRowRef.current) {
        activeRowRef.current = r;
        setActiveRow(r);
        if (!flow) vertical.current?.scrollTo({ y: r * ROW_H, animated: true });
      }
    },
    [flow],
  );

  const translation = settings.translation;
  const play = useCallback(
    (m: Media, e?: HistoryEntry) =>
      nav.push({ name: 'player', mediaId: m.id, episode: e ? upNext(e, undefined, m.episodes).episode : '1', translation }),
    [nav, translation],
  );
  const onCardPress = useCallback(
    (m: Media, e?: HistoryEntry) => (e ? play(m, e) : nav.push({ name: 'details', mediaId: m.id })),
    [play, nav],
  );
  const heroNext = hero && entry ? upNext(entry, undefined, hero.episodes) : null;

  const loading = !rows.length && (trend.loading || season.loading);
  const failure = !rows.length && !loading ? (trend.error ?? season.error ?? popular.error) : undefined;
  const retryAll = () => {
    trend.retry();
    season.retry();
    popular.retry();
  };

  const rowList = rows.map((row, r) => (
    <HomeRow
      key={row.key}
      row={row}
      index={r}
      history={row.key === 'continue' ? history.get : undefined}
      onCardFocus={onCardFocus}
      onCardPress={onCardPress}
    />
  ));
  const wide = !stage.narrow;
  const heroContent = (heroPlace: StyleProp<ViewStyle>) =>
    hero && (
      <View style={[{ width: Math.min(theme.layout.heroWidth, stage.width - 160), gap: compact ? 14 : 18 }, heroPlace]}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {entry ? (
            <>
              <Chip badge check label="Watching" />
              <Chip label={`Episode ${entry.episode}${hero.episodes ? ` of ${hero.episodes}` : ''}`} />
            </>
          ) : (
            <>
              {hero.status === 'RELEASING' && <Chip badge label="Airing" />}
              {!theme.decor.indexLabels && <Chip label={formatLabel(hero)} />}
            </>
          )}
          {theme.decor.indexLabels && (
            <Text variant="label" color={c.textOnArt} style={{ marginLeft: 4 }}>
              {metaLine(hero, { genres: false }).replace(/ {2}· {2}/g, ' — ')}
            </Text>
          )}
        </View>
        <Text variant="hero" size={sizeFor(displayTitle(hero), theme.text.hero.size * (compact ? 0.62 : 1))} numberOfLines={2}>
          {displayTitle(hero)}
        </Text>
        {theme.decor.indexLabels ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {hero.genres.slice(0, 3).map((g) => (
              <Chip key={g} size="sm" label={g} />
            ))}
          </View>
        ) : (
          <Text variant="label" color={c.textMuted}>
            {metaLine(hero)}
          </Text>
        )}
        {!compact && (
          <Text color={c.textOnArt} numberOfLines={2} style={{ maxWidth: 760 }}>
            {plainDescription(hero)}
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: compact ? 16 : 22, marginTop: compact ? 4 : 8, alignItems: 'center' }}>
          <Button
            autoFocus
            variant="primary"
            size={compact ? 'md' : 'lg'}
            icon="play"
            optionalIcon
            label={heroNext ? `${heroNext.resume ? 'Resume' : 'Play'} E${heroNext.episode}` : 'Play E1'}
            onPress={() => play(hero, entry)}
          />
          <Button size={compact ? 'md' : 'lg'} label="Details" onPress={() => nav.push({ name: 'details', mediaId: hero.id })} />
          {theme.decor.indexLabels && entry && (
            <View style={{ marginLeft: 18, gap: 6 }}>
              <ProgressBar value={progressOf(entry)} color={c.accent} track={c.outline} style={{ width: 240 }} />
              <Text variant="meta" color={c.textMuted} numberOfLines={1}>
                {`${Math.round(progressOf(entry) * 100)}% — ${minutesLeft(entry)}`}
              </Text>
            </View>
          )}
        </View>
      </View>
    );

  return (
    <View style={StyleSheet.absoluteFill}>
      {hero && <Backdrop media={hero} poster={wide} posterRight={theme.decor.indexLabels ? 456 : 120} />}
      <DotMatrix />
      <HeroScrim />
      <FrameMarks crumb={`VIU.TV / HOME / ROW ${String(activeRow + 1).padStart(2, '0')}`} />

      {flow ? (
        <ScrollView style={StyleSheet.absoluteFill} showsVerticalScrollIndicator={false}>
          <View style={{ minHeight: stage.height - ROW_H - PEEK - 22, paddingTop: theme.layout.contentTop - 6, paddingBottom: 40 }}>
            <TopNav active="home" />
            {loading && <HomeSkeleton />}
            {failure && (
              <ErrorState
                error={failure}
                service="AniList"
                title="Couldn’t load Home"
                onRetry={retryAll}
                style={{ marginLeft: 80, marginTop: 110 }}
              />
            )}
            {heroContent({ marginLeft: 80 })}
            {hero && wide && theme.decor.indexLabels && <Readout media={hero} entry={entry} />}
          </View>
          {rows.length > 0 && <Panel style={{ marginHorizontal: 56, marginBottom: 22, paddingBottom: 22 }}>{rowList}</Panel>}
        </ScrollView>
      ) : (
        <>
          <TopNav active="home" />
          {failure && (
            <ErrorState
              error={failure}
              service="AniList"
              title="Couldn’t load Home"
              onRetry={retryAll}
              style={{ position: 'absolute', top: 260, left: 80 }}
            />
          )}
          {loading && <HomeSkeleton />}
          {heroContent({ position: 'absolute', top: theme.layout.contentTop - 6, left: 80 })}
          {hero && wide && theme.decor.indexLabels && <Readout media={hero} entry={entry} />}
          {rows.length > 0 && (
            <Panel style={{ position: 'absolute', left: 56, right: 56, bottom: 22, height: ROW_H + PEEK }}>
              <ScrollView ref={vertical} scrollEnabled={false} showsVerticalScrollIndicator={false}>
                {rowList}
                {/* Room for the last row to scroll fully into place. */}
                <View style={{ height: PEEK }} />
              </ScrollView>
            </Panel>
          )}
        </>
      )}
    </View>
  );
}

// One row of the rows panel. Memoised with stable callbacks, so moving focus
// re-renders the hero and leaves the rows alone.
const HomeRow = memo(function HomeRow({
  row,
  index: r,
  history,
  onCardFocus,
  onCardPress,
}: {
  row: Row;
  index: number;
  // Watch progress, for the Continue watching row only.
  history?: (mediaId: number) => HistoryEntry | undefined;
  onCardFocus: (m: Media, row: number) => void;
  onCardPress: (m: Media, e?: HistoryEntry) => void;
}) {
  const { theme } = useSettings();
  const c = theme.colors;
  return (
    <View style={{ height: ROW_H, paddingTop: 22, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: ROW_INSET + 4, height: 46 }}>
        {theme.decor.indexLabels && (
          <Text variant="metaBold" color={c.featureText}>
            {`A/${String(r + 1).padStart(2, '0')}`}
          </Text>
        )}
        <Text variant="section" color={c.featureText}>
          {row.title}
        </Text>
        <Hazard color={c.featureText} style={{ flex: 1, marginRight: 24 }} />
        {!theme.decor.hazard && <View style={{ flex: 1 }} />}
        <Text variant="meta" color={c.featureMuted}>
          {countLabel(row.items.length, 'title')}
        </Text>
      </View>
      <Rail
        items={row.items}
        itemWidth={CARD_W}
        gap={CARD_GAP}
        inset={ROW_INSET}
        artHeight={CARD_H}
        renderItem={(m, i, scrollTo) => {
          const e = history?.(m.id);
          const progress = e ? progressOf(e) : undefined;
          return (
            <MediaCard
              media={m}
              width={CARD_W}
              height={CARD_H}
              index={i}
              progress={progress}
              tag={e ? `E${e.episode}` : m.averageScore ? `${m.averageScore}%` : m.seasonYear?.toString()}
              spokenDetail={e ? `Episode ${e.episode}, ${Math.round((progress ?? 0) * 100)}% watched` : undefined}
              onFocus={() => {
                scrollTo();
                onCardFocus(m, r);
              }}
              onPress={() => onCardPress(m, e)}
            />
          );
        }}
      />
    </View>
  );
});

// Placeholders in the shape of the hero and the first row while Home loads.
function HomeSkeleton() {
  const { theme } = useSettings();
  return (
    <>
      <View style={{ position: 'absolute', top: theme.layout.contentTop + 10, left: 80, gap: 22 }}>
        <Skeleton style={{ width: 200, height: 44 }} />
        <Skeleton style={{ width: 760, height: 88 }} />
        <Skeleton style={{ width: 520, height: 88 }} />
        <Skeleton style={{ width: 640, height: 28, marginTop: 8 }} />
        <View style={{ flexDirection: 'row', gap: 22, marginTop: 20 }}>
          <Skeleton style={{ width: 240, height: 76, borderRadius: theme.shape.button }} />
          <Skeleton style={{ width: 180, height: 76, borderRadius: theme.shape.button }} />
        </View>
      </View>
      <Panel
        style={{
          position: 'absolute',
          left: 56,
          right: 56,
          bottom: 22,
          height: ROW_H + PEEK,
          paddingTop: 30,
          paddingHorizontal: ROW_INSET,
        }}
      >
        <Skeleton style={{ width: 320, height: 34 }} />
        <View style={{ flexDirection: 'row', gap: CARD_GAP, marginTop: 24 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} style={{ width: CARD_W, height: CARD_H }} />
          ))}
        </View>
      </Panel>
    </>
  );
}

// Long titles step down so they still fit in two lines.
function sizeFor(title: string, base: number): number {
  if (title.length > 40) return Math.round(base * 0.66);
  if (title.length > 26) return Math.round(base * 0.8);
  return base;
}

// The graphic theme's spec-sheet column: an outlined index number and a few
// data lines, set beside the hero like a game's loadout screen.
function Readout({ media, entry }: { media: Media; entry?: HistoryEntry }) {
  const { theme, settings } = useSettings();
  const c = theme.colors;
  // The big figure is the episode you're on, or the year it came out; a
  // title's place in the rows would mean nothing to the viewer.
  const big = entry ? entry.episode : media.seasonYear ? String(media.seasonYear) : '—';
  const bigLabel = entry ? 'Your episode' : 'Year';
  const lines: [string, string][] = [
    ['Source', providerFor(settings.provider).name],
    ['Episodes', media.episodes ? String(media.episodes) : media.nextAiringEpisode ? `${media.nextAiringEpisode.episode - 1}+` : '—'],
    ['Score', media.averageScore ? `${media.averageScore}%` : '—'],
    ['Status', (media.status ?? '—').replace(/_/g, ' ')],
  ];
  return (
    <View style={{ position: 'absolute', top: 190, right: 76, width: 340, gap: 14, padding: 20, backgroundColor: c.chrome }}>
      <Svg width={300} height={124}>
        <SvgText x={0} y={112} fontFamily={theme.fonts.display} fontSize={140} fill="none" stroke={c.text} strokeWidth={2}>
          {big}
        </SvgText>
      </Svg>
      <Text variant="meta" color={c.textMuted}>
        {bigLabel}
      </Text>
      <View style={{ height: 1, backgroundColor: c.outline }} />
      {lines.map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="meta" color={c.textMuted}>
            {k}
          </Text>
          <Text variant="meta" color={c.textOnArt}>
            {v}
          </Text>
        </View>
      ))}
      <View style={{ marginTop: 6 }}>
        <Barcode color={c.text} />
      </View>
    </View>
  );
}
