import { useMemo, useRef, useState } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';

import { allTimePopular, displayTitle, getMany, Media, plainDescription, popularThisSeason, trending } from '../api/anilist';
import { useAsync } from '../lib/useAsync';
import { useNav } from '../nav/navigation';
import { HistoryEntry, progressOf, upNext, useHistory } from '../state/history';
import { useSettings } from '../state/settings';
import { Art, HeroScrim } from '../ui/Art';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Barcode, DotMatrix, FrameMarks, Hazard } from '../ui/Decor';
import { MediaCard } from '../ui/MediaCard';
import { Panel } from '../ui/Panel';
import { ProgressBar } from '../ui/ProgressBar';
import { Rail } from '../ui/Rail';
import { Text } from '../ui/Text';
import { TopNav } from '../ui/TopNav';
import { formatLabel, metaLine, minutesLeft } from './format';

const ROW_H = 337;

interface Row {
  key: string;
  title: string;
  items: Media[];
}

export function HomeScreen() {
  const { theme, settings } = useSettings();
  const c = theme.colors;
  const graphic = theme.panel === 'solid';
  const nav = useNav();
  const history = useHistory();

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
  const all = rows.flatMap((r) => r.items);
  const hero = all.find((m) => m.id === heroId) ?? rows[0]?.items[0];
  const entry = hero ? history.get(hero.id) : undefined;

  const vertical = useRef<ScrollViewInstance>(null);
  const [activeRow, setActiveRow] = useState(0);
  const focusRow = (r: number) => {
    setActiveRow(r);
    vertical.current?.scrollTo({ y: r * ROW_H, animated: true });
  };

  const play = (m: Media, e?: HistoryEntry) =>
    nav.push({ name: 'player', mediaId: m.id, episode: e ? upNext(e, undefined, m.episodes).episode : '1', translation: settings.translation });
  const heroNext = hero && entry ? upNext(entry, undefined, hero.episodes) : null;

  const failed = !rows.length && (trend.error || season.error);

  return (
    <View style={StyleSheet.absoluteFill}>
      {hero && <Art uri={hero.bannerImage ?? hero.coverImage.extraLarge} fallback={hero.coverImage.color} style={StyleSheet.absoluteFill} />}
      <DotMatrix />
      <HeroScrim />
      <FrameMarks crumb={`VIU.TV / HOME / ROW ${String(activeRow + 1).padStart(2, '0')}`} />
      <TopNav active="home" />

      {failed && (
        <View style={{ position: 'absolute', top: 260, left: 80, width: 900, gap: 16 }}>
          <Text variant="display" size={64}>Can't reach AniList</Text>
          <Text color={c.textMuted}>Check the TV's connection, then open Home again.</Text>
        </View>
      )}

      {hero && (
        <View style={{ position: 'absolute', top: graphic ? 158 : 169, left: 80, width: graphic ? 1000 : 880, gap: graphic ? 20 : 22 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {entry ? (
              <>
                <Chip badge check={!graphic} label="Watching" />
                <Chip label={`Episode ${entry.episode}${hero.episodes ? ` of ${hero.episodes}` : ''}`} />
              </>
            ) : (
              <>
                {hero.status === 'RELEASING' && <Chip badge label="Airing" />}
                {!theme.decor.indexLabels && <Chip label={formatLabel(hero)} />}
              </>
            )}
            {theme.decor.indexLabels && (
              <Text variant="label" size={16} color={c.textOnArt} style={{ marginLeft: 4 }}>
                {metaLine(hero, { genres: false }).replace(/ {2}· {2}/g, ' — ')}
              </Text>
            )}
          </View>
          <Text
            variant="display"
            size={sizeFor(displayTitle(hero), graphic ? 128 : 92)}
            numberOfLines={2}
          >
            {displayTitle(hero)}
          </Text>
          {!theme.decor.indexLabels && (
            <Text variant="label" size={22} color={c.textMuted}>
              {metaLine(hero)}
            </Text>
          )}
          {graphic && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {hero.genres.slice(0, 3).map((g) => (
                <Chip key={g} size="sm" label={g} />
              ))}
            </View>
          )}
          <Text size={graphic ? 23 : 24} color={c.textOnArt} numberOfLines={2} style={{ maxWidth: 740 }}>
            {plainDescription(hero)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 22, marginTop: 12, alignItems: 'center' }}>
            <Button
              autoFocus
              variant="primary"
              size="lg"
              icon={graphic ? undefined : 'play'}
              label={heroNext ? `${heroNext.resume ? 'Resume' : 'Play'} E${heroNext.episode}` : 'Play E1'}
              onPress={() => play(hero, entry)}
            />
            <Button size="lg" label="Details" onPress={() => nav.push({ name: 'details', mediaId: hero.id })} />
            {theme.decor.indexLabels && entry && (
              <View style={{ marginLeft: 18, width: 220, gap: 6 }}>
                <ProgressBar value={progressOf(entry)} color={c.accent} track="rgba(232,228,218,0.2)" />
                <Text variant="label" size={14} color={c.textMuted}>
                  {`${Math.round(progressOf(entry) * 100)}% — ${minutesLeft(entry)}`}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {hero && theme.decor.indexLabels && <Readout media={hero} entry={entry} rank={all.indexOf(hero) + 1} />}

      {rows.length > 0 && (
        <Panel style={{ position: 'absolute', left: 56, right: 56, bottom: 40, height: ROW_H }}>
          <ScrollView ref={vertical} scrollEnabled={false} showsVerticalScrollIndicator={false}>
            {rows.map((row, r) => (
              <View key={row.key} style={{ height: ROW_H, paddingTop: graphic ? 24 : 28, gap: graphic ? 18 : 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: graphic ? 28 : 32, height: 40 }}>
                  {theme.decor.indexLabels && (
                    <Text variant="labelBold" size={14} color={c.featureText}>
                      {`A/${String(r + 1).padStart(2, '0')}`}
                    </Text>
                  )}
                  <Text variant="title" size={graphic ? 40 : 30} color={c.featureText} style={{ letterSpacing: graphic ? 1.6 : -0.6 }}>
                    {row.title}
                  </Text>
                  <Hazard color={c.featureText} style={{ flex: 1, marginRight: 40 }} />
                  {!theme.decor.hazard && <View style={{ flex: 1 }} />}
                  <Text variant="label" size={graphic ? 14 : 18} color={c.featureMuted} style={{ marginRight: graphic ? 24 : 0 }}>
                    {`${row.items.length} titles`}
                  </Text>
                </View>
                <Rail
                  items={row.items}
                  itemWidth={graphic ? 334 : 326}
                  gap={graphic ? 20 : 24}
                  inset={graphic ? 28 : 24}
                  renderItem={(m, i, onFocus) => {
                    const e = row.key === 'continue' ? history.get(m.id) : undefined;
                    return (
                      <MediaCard
                        media={m}
                        width={graphic ? 334 : 326}
                        height={graphic ? 189 : 183}
                        index={i}
                        onFeature
                        progress={e ? progressOf(e) : undefined}
                        tag={e ? `E${e.episode}` : m.averageScore ? `${m.averageScore}%` : m.seasonYear?.toString()}
                        onFocus={() => {
                          onFocus();
                          setHeroId(m.id);
                          if (r !== activeRow) focusRow(r);
                        }}
                        onPress={() => (e ? play(m, e) : nav.push({ name: 'details', mediaId: m.id }))}
                      />
                    );
                  }}
                />
              </View>
            ))}
          </ScrollView>
        </Panel>
      )}
    </View>
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
function Readout({ media, entry, rank }: { media: Media; entry?: HistoryEntry; rank: number }) {
  const { theme } = useSettings();
  const c = theme.colors;
  const big = entry ? entry.episode : String(rank).padStart(2, '0');
  const lines: [string, string][] = [
    ['Source', 'AllAnime'],
    ['Episodes', media.episodes ? String(media.episodes) : media.nextAiringEpisode ? `${media.nextAiringEpisode.episode - 1}+` : '—'],
    ['Score', media.averageScore ? `${media.averageScore}%` : '—'],
    ['Status', (media.status ?? '—').replace(/_/g, ' ')],
  ];
  return (
    <View style={{ position: 'absolute', top: 190, right: 76, width: 340, gap: 14, padding: 20, backgroundColor: c.chrome }}>
      <Svg width={300} height={124}>
        <SvgText
          x={0}
          y={112}
          fontFamily={theme.fonts.display}
          fontSize={140}
          fill="none"
          stroke={c.text}
          strokeWidth={2}
        >
          {big}
        </SvgText>
      </Svg>
      <View style={{ height: 1, backgroundColor: c.outline }} />
      {lines.map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="label" size={14} color={c.textMuted}>
            {k}
          </Text>
          <Text variant="label" size={14} color={c.textOnArt}>
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
