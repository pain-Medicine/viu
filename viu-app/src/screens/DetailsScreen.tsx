import { useMemo, useRef, useState } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';

import { airedEpisodes, displayTitle, getMedia, Media, plainDescription } from '../api/anilist';
import { useAsync } from '../lib/useAsync';
import { useNav } from '../nav/navigation';
import { findShow, ProviderUnavailableError, showKey, TranslationType } from '../providers';
import { episodeProgress, HistoryEntry, isWatched, progressOf, upNext, useHistory } from '../state/history';
import { useListMembership } from '../state/mylist';
import { useSettings } from '../state/settings';
import { Art, HeroScrim } from '../ui/Art';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { DotMatrix, FrameMarks, Hazard } from '../ui/Decor';
import { Focusable } from '../ui/Focusable';
import { Icon } from '../ui/Icon';
import { Panel } from '../ui/Panel';
import { ProgressBar } from '../ui/ProgressBar';
import { Text } from '../ui/Text';
import { metaLine, minutesLeft } from './format';

const EP_STEP = 135;

export function DetailsScreen({ mediaId }: { mediaId: number }) {
  const { theme, settings } = useSettings();
  const c = theme.colors;
  const graphic = theme.panel === 'solid';
  const nav = useNav();
  const history = useHistory();
  const entry = history.get(mediaId);

  const media = useAsync(`media:${mediaId}`, () => getMedia(mediaId));
  const membership = useListMembership(mediaId);
  const [translation, setTranslation] = useState<TranslationType>(settings.translation);
  const show = useAsync(media.data ? showKey(mediaId, translation) : null, () => findShow(media.data!, translation));

  // Episode names from the provider, or a count from AniList when the
  // provider can't be reached (the web build without a proxy).
  const episodes = useMemo(() => {
    if (show.data) return show.data.episodes[translation];
    const n = media.data ? airedEpisodes(media.data) : 0;
    return Array.from({ length: n }, (_, i) => String(i + 1));
  }, [show.data, media.data, translation]);

  const chunk = episodes.length > 60 ? 50 : 12;
  const ranges = useMemo(() => {
    const out: { from: number; to: number }[] = [];
    for (let i = 0; i < episodes.length; i += chunk) out.push({ from: i, to: Math.min(episodes.length, i + chunk) });
    return out;
  }, [episodes.length, chunk]);
  const next = entry ? upNext(entry, show.data ? episodes : undefined, media.data?.episodes) : null;
  const resumeIndex = next ? Math.max(0, episodes.indexOf(next.episode)) : 0;
  const [rangeIndex, setRangeIndex] = useState<number | null>(null);
  const activeRange = rangeIndex ?? Math.floor(resumeIndex / chunk);
  const range = ranges[activeRange];

  const list = useRef<ScrollViewInstance>(null);
  const play = (episode: string) => nav.push({ name: 'player', mediaId, episode, translation });

  const m = media.data;
  if (!m) {
    return (
      <View style={[StyleSheet.absoluteFill, { padding: 80, justifyContent: 'center' }]}>
        <Text variant="title" color={c.textMuted}>
          {media.error ? `Couldn't load this title: ${media.error.message}` : 'Loading…'}
        </Text>
      </View>
    );
  }

  const unavailable = show.error instanceof ProviderUnavailableError;
  const notFound = !show.loading && !show.error && show.data === null;
  const status = show.loading
    ? 'Finding streams…'
    : unavailable
      ? show.error!.message
      : notFound
        ? `AllAnime doesn't list a ${translation === 'dub' ? 'dub' : 'sub'} for this title.`
        : show.error
          ? `Couldn't reach AllAnime: ${show.error.message}`
          : null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Art uri={m.bannerImage ?? m.coverImage.extraLarge} fallback={m.coverImage.color} style={StyleSheet.absoluteFill} />
      <DotMatrix />
      <HeroScrim strength="details" />
      <FrameMarks crumb={`VIU.TV / TITLE / ${m.id}`} />

      <View style={{ position: 'absolute', top: graphic ? 70 : 80, left: 80, width: 760, gap: 22 }}>
        <Focusable onPress={nav.back} lift={false} radius={theme.shape.radiusSm} style={{ alignSelf: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, paddingRight: 8 }}>
            <Icon name="chevronLeft" size={22} color={c.textMuted} square={graphic} />
            <Text variant="label" size={graphic ? 15 : 20} color={c.textMuted}>
              Back
            </Text>
          </View>
        </Focusable>
        <Art
          uri={m.coverImage.extraLarge ?? m.coverImage.large}
          fallback={m.coverImage.color}
          style={{ width: 220, height: 330, borderRadius: theme.shape.radiusMd, borderWidth: graphic ? 0 : 1, borderColor: 'rgba(255,255,255,0.12)' }}
        />
        <Text variant="display" size={displayTitle(m).length > 34 ? 52 : graphic ? 84 : 64} numberOfLines={2} style={{ marginTop: 6 }}>
          {displayTitle(m)}
        </Text>
        <Text variant="label" size={graphic ? 15 : 21} color={c.textMuted}>
          {metaLine(m, { episodes: true, status: true })}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {m.genres.slice(0, 4).map((g) => (
            <Chip key={g} label={g} size={graphic ? 'sm' : 'md'} />
          ))}
        </View>
        <Text size={22} color={c.textOnArt} numberOfLines={4}>
          {plainDescription(m)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
          <Button
            autoFocus
            variant="primary"
            icon={graphic ? undefined : 'play'}
            label={next ? `${next.resume ? 'Resume' : 'Play'} E${next.episode}` : `Play E${episodes[0] ?? 1}`}
            onPress={() => play(next?.episode ?? episodes[0] ?? '1')}
          />
          <Button
            icon={membership.inList ? 'check' : 'plus'}
            label={listLabel(membership)}
            onPress={membership.canToggle ? membership.toggle : undefined}
          />
        </View>
        {membership.error && (
          <Text variant="label" size={graphic ? 14 : 18} color={c.accent}>
            {`AniList: ${membership.error.message}`}
          </Text>
        )}
      </View>

      <Panel style={{ position: 'absolute', top: 64, bottom: 64, left: 920, right: 64, padding: 36, gap: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Text variant="title" size={graphic ? 40 : 30} color={c.featureText}>
            Episodes
          </Text>
          <Hazard color={c.featureText} style={{ flex: 1 }} />
          {!theme.decor.hazard && <View style={{ flex: 1 }} />}
          <View style={{ flexDirection: 'row', gap: 8, marginRight: graphic ? 24 : 0 }}>
            {(['sub', 'dub'] as const).map((t) => (
              <Chip
                key={t}
                onFeature
                label={t === 'sub' ? 'Sub' : 'Dub'}
                selected={translation === t}
                onPress={() => {
                  setTranslation(t);
                  setRangeIndex(null);
                }}
              />
            ))}
          </View>
        </View>

        {ranges.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginVertical: -10 }} contentContainerStyle={{ gap: 10, padding: 10 }}>
            {ranges.map((r, i) => (
              <Chip
                key={r.from}
                onFeature
                check={i === activeRange && !graphic}
                selected={i === activeRange}
                label={`${episodes[r.from]}–${episodes[r.to - 1]}`}
                onPress={() => {
                  setRangeIndex(i);
                  list.current?.scrollTo({ y: 0, animated: false });
                }}
              />
            ))}
          </ScrollView>
        )}

        <ScrollView ref={list} style={{ flex: 1, marginHorizontal: -14 }} contentContainerStyle={{ gap: 8, padding: 14 }} showsVerticalScrollIndicator={false}>
          {range &&
            episodes.slice(range.from, range.to).map((ep, i) => (
              <EpisodeRow
                key={ep}
                media={m}
                episode={ep}
                entry={entry}
                order={episodes.indexOf(ep)}
                resumeOrder={entry ? episodes.indexOf(entry.episode) : -1}
                onFocus={() => list.current?.scrollTo({ y: Math.max(0, (i - 1) * EP_STEP), animated: true })}
                onPress={() => play(ep)}
              />
            ))}
        </ScrollView>

        <Text variant="label" size={graphic ? 13 : 17} color={c.featureMuted}>
          {status ?? `Streams from AllAnime  ·  mp4upload  ·  ${episodes.length} episodes`}
        </Text>
      </Panel>
    </View>
  );
}

const STATUS_LABELS: Record<string, string> = {
  CURRENT: 'Watching',
  PLANNING: 'In My List',
  COMPLETED: 'Completed',
  DROPPED: 'Dropped',
  PAUSED: 'Paused',
  REPEATING: 'Rewatching',
};

function listLabel(m: ReturnType<typeof useListMembership>): string {
  if (m.loading) return 'My List…';
  if (!m.inList) return 'Add to My List';
  if (!m.entry) return 'In My List';
  const label = STATUS_LABELS[m.entry.status] ?? 'In My List';
  return m.entry.progress && m.entry.status !== 'COMPLETED' ? `${label} · E${m.entry.progress}` : label;
}

function EpisodeRow({
  media,
  episode,
  entry,
  order,
  resumeOrder,
  onFocus,
  onPress,
}: {
  media: Media;
  episode: string;
  entry?: HistoryEntry;
  order: number;
  resumeOrder: number;
  onFocus: () => void;
  onPress: () => void;
}) {
  const { theme } = useSettings();
  const c = theme.colors;
  const graphic = theme.panel === 'solid';
  const own = episodeProgress(entry, episode, order, resumeOrder);
  const watched = isWatched(own);
  const current = !!own && !watched;
  const progress = progressOf(own);
  const state = watched ? 'Watched' : current ? minutesLeft(own!) : 'Not started';

  return (
    <Focusable onPress={onPress} onFocus={onFocus} lift={false} radius={theme.shape.radiusMd}>
      {(focused) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 24,
            padding: 14,
            borderRadius: theme.shape.radiusMd,
            backgroundColor: focused ? (graphic ? 'rgba(12,12,14,0.08)' : 'rgba(255,218,210,0.14)') : 'transparent',
          }}
        >
          <Art
            uri={media.bannerImage ?? media.coverImage.large}
            fallback={media.coverImage.color}
            style={{ width: 176, height: 99, borderRadius: Math.max(0, theme.shape.radiusMd - 6) }}
          >
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
            <Text variant="display" size={36} color="rgba(255,255,255,0.75)" style={{ position: 'absolute', top: 8, left: 14 }}>
              {episode}
            </Text>
            {progress > 0 && (
              <ProgressBar value={progress} height={5} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: 0 }} />
            )}
          </Art>
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant={graphic ? 'title' : 'bodyBold'} size={graphic ? 28 : 24} color={c.featureText} style={{ lineHeight: graphic ? 30 : 30 }}>
              {`Episode ${episode}`}
            </Text>
            <Text variant="label" size={graphic ? 14 : 18} color={current ? (graphic ? c.featureText : c.primary) : c.featureMuted}>
              {state}
            </Text>
          </View>
          {media.duration ? (
            <Text variant="label" size={graphic ? 14 : 18} color={c.featureMuted} style={{ paddingRight: 12 }}>
              {`${media.duration} min`}
            </Text>
          ) : null}
        </View>
      )}
    </Focusable>
  );
}
