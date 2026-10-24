import { useMemo, useRef, useState } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';

import { airedEpisodes, displayTitle, getMedia, Media, plainDescription } from '../api/anilist';
import { useAsync } from '../lib/useAsync';
import { useNav } from '../nav/navigation';
import { findShow, ProviderUnavailableError, showKey, TranslationType } from '../providers';
import { episodeProgress, HistoryEntry, isWatched, progressOf, upNext, useHistory } from '../state/history';
import { useListMembership } from '../state/mylist';
import { useSettings } from '../state/settings';
import { Art, Backdrop, HeroScrim, Skeleton } from '../ui/Art';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { DotMatrix, FrameMarks, Hazard } from '../ui/Decor';
import { ErrorState } from '../ui/ErrorState';
import { Focusable } from '../ui/Focusable';
import { Icon } from '../ui/Icon';
import { Panel } from '../ui/Panel';
import { ProgressBar } from '../ui/ProgressBar';
import { Text } from '../ui/Text';
import { metaLine, minutesLeft } from './format';

// One episode row plus the gap between rows.
const EP_STEP = 124;

export function DetailsScreen({ mediaId }: { mediaId: number }) {
  const { theme, settings } = useSettings();
  const c = theme.colors;
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
    if (media.error) {
      return (
        <View style={[StyleSheet.absoluteFill, { padding: 80, justifyContent: 'center' }]}>
          <ErrorState
            error={media.error}
            service="AniList"
            title="Couldn't load this title"
            onRetry={media.retry}
            other={{ label: 'Back', onPress: nav.back }}
          />
        </View>
      );
    }
    return <DetailsSkeleton />;
  }

  const unavailable = show.error instanceof ProviderUnavailableError;
  const notFound = !show.loading && !show.error && show.data === null;
  const other: TranslationType = translation === 'dub' ? 'sub' : 'dub';
  const otherLabel = other === 'dub' ? 'Dub' : 'Sub';
  // Rows only for episodes that can play, except where streaming is off
  // altogether (the web build without a proxy), where the list still helps
  // browsing and the status line says why.
  const showRows = !notFound && !(show.error && !unavailable);
  const status = show.loading ? 'Finding streams…' : unavailable ? show.error!.message : null;
  const switchTranslation = (t: TranslationType) => {
    setTranslation(t);
    setRangeIndex(null);
  };
  const playLabel = next ? `${next.resume ? 'Resume' : 'Play'} E${next.episode}` : `Play E${episodes[0] ?? 1}`;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Backdrop media={m} poster={false} />
      <DotMatrix />
      <HeroScrim strength="details" />
      <FrameMarks crumb={`VIU.TV / TITLE / ${m.id}`} />

      <View style={{ position: 'absolute', top: theme.layout.navTop + 20, left: 80, width: 760, gap: 22 }}>
        <Focusable
          onPress={nav.back}
          lift={false}
          radius={theme.shape.radiusSm}
          accessibilityLabel="Back"
          style={{ alignSelf: 'flex-start' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, paddingRight: 8 }}>
            <Icon name="chevronLeft" size={24} color={c.textMuted} />
            <Text variant="label" color={c.textMuted}>
              Back
            </Text>
          </View>
        </Focusable>
        <Art
          uri={m.coverImage.extraLarge ?? m.coverImage.large}
          fallback={m.coverImage.color}
          style={{
            width: 220,
            height: 330,
            borderRadius: theme.shape.radiusMd,
            borderWidth: theme.shape.artBorder,
            borderColor: c.artOutline,
          }}
        />
        <Text
          variant="headline"
          size={displayTitle(m).length > 34 ? Math.round(theme.text.headline.size * 0.75) : undefined}
          numberOfLines={2}
          style={{ marginTop: 6 }}
        >
          {displayTitle(m)}
        </Text>
        <Text variant="label" color={c.textMuted}>
          {metaLine(m, { episodes: true, status: true })}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {m.genres.slice(0, 4).map((g) => (
            <Chip key={g} label={g} size="sm" />
          ))}
        </View>
        <Text color={c.textOnArt} numberOfLines={4}>
          {plainDescription(m)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
          {notFound ? (
            <Button autoFocus variant="primary" label={`Try the ${otherLabel.toLowerCase()}`} onPress={() => switchTranslation(other)} />
          ) : (
            <Button
              autoFocus
              variant="primary"
              icon="play"
              optionalIcon
              label={playLabel}
              disabled={!!show.error && !unavailable}
              onPress={() => play(next?.episode ?? episodes[0] ?? '1')}
            />
          )}
          <Button
            icon={membership.inList ? 'check' : 'plus'}
            label={listLabel(membership)}
            disabled={membership.loading || !membership.canToggle}
            onPress={membership.toggle}
          />
        </View>
        {membership.error && (
          <Text variant="label" color={c.accent}>
            {`AniList: ${membership.error.message}`}
          </Text>
        )}
        {!membership.canToggle && !membership.loading && (
          <Text variant="meta" color={c.textMuted}>
            Change this title's status on AniList; removing it here would erase your progress.
          </Text>
        )}
      </View>

      <Panel style={{ position: 'absolute', top: 64, bottom: 64, left: 920, right: 64, padding: 36, gap: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Text variant="section" color={c.featureText}>
            Episodes
          </Text>
          <Hazard color={c.featureText} style={{ flex: 1 }} />
          {!theme.decor.hazard && <View style={{ flex: 1 }} />}
          <View style={{ flexDirection: 'row', gap: 8, marginRight: theme.shape.chamfer }}>
            {(['sub', 'dub'] as const).map((t) => (
              <Chip
                key={t}
                label={t === 'sub' ? 'Sub' : 'Dub'}
                accessibilityLabel={t === 'sub' ? 'Subtitled' : 'Dubbed'}
                selected={translation === t}
                onPress={() => switchTranslation(t)}
              />
            ))}
          </View>
        </View>

        {notFound && (
          <View style={{ flex: 1, gap: 14, paddingTop: 12 }}>
            <Text variant="item" color={c.featureText}>
              {`No ${translation === 'dub' ? 'dub' : 'subtitled version'} on AllAnime`}
            </Text>
            <Text
              color={c.featureMuted}
            >{`AllAnime doesn't list this title in ${translation === 'dub' ? 'English dub' : 'subtitles'}. The ${otherLabel.toLowerCase()} may be there.`}</Text>
          </View>
        )}

        {show.error && !unavailable && (
          <View style={{ flex: 1, paddingTop: 12 }}>
            <ErrorState
              compact
              autoFocus={false}
              error={show.error}
              service="AllAnime"
              title="Couldn't find streams"
              onRetry={show.retry}
            />
          </View>
        )}

        {showRows && ranges.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginVertical: -10 }}
            contentContainerStyle={{ gap: 10, padding: 10 }}
          >
            {ranges.map((r, i) => (
              <Chip
                key={r.from}
                check={i === activeRange}
                selected={i === activeRange}
                label={`${episodes[r.from]}–${episodes[r.to - 1]}`}
                accessibilityLabel={`Episodes ${episodes[r.from]} to ${episodes[r.to - 1]}`}
                onPress={() => {
                  setRangeIndex(i);
                  list.current?.scrollTo({ y: 0, animated: false });
                }}
              />
            ))}
          </ScrollView>
        )}

        {showRows && (
          <ScrollView
            ref={list}
            style={{ flex: 1, marginHorizontal: -14 }}
            contentContainerStyle={{ gap: 8, padding: 14 }}
            showsVerticalScrollIndicator={false}
          >
            {range &&
              episodes
                .slice(range.from, range.to)
                .map((ep, i) => (
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
        )}

        <Text variant="meta" color={c.featureMuted}>
          {status ?? (showRows ? `Streams from AllAnime  ·  mp4upload  ·  ${episodes.length} episodes` : 'Streams from AllAnime')}
        </Text>
      </Panel>
    </View>
  );
}

// The page's shape while AniList answers.
function DetailsSkeleton() {
  const { theme } = useSettings();
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', top: theme.layout.navTop + 70, left: 80, gap: 22 }}>
        <Skeleton style={{ width: 220, height: 330 }} />
        <Skeleton style={{ width: 640, height: 64 }} />
        <Skeleton style={{ width: 460, height: 28 }} />
        <Skeleton style={{ width: 700, height: 120 }} />
      </View>
      <Panel style={{ position: 'absolute', top: 64, bottom: 64, left: 920, right: 64, padding: 36, gap: 18 }}>
        <Skeleton style={{ width: 220, height: 36 }} />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} style={{ height: 110 }} />
        ))}
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
  const own = episodeProgress(entry, episode, order, resumeOrder);
  const watched = isWatched(own);
  const current = !!own && !watched;
  const progress = progressOf(own);
  const state = watched ? 'Watched' : current ? minutesLeft(own!) : 'Not started';

  return (
    <Focusable
      onPress={onPress}
      onFocus={onFocus}
      lift={false}
      radius={theme.shape.radiusMd}
      accessibilityLabel={`Episode ${episode}, ${state}`}
    >
      {(focused) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 24,
            padding: 14,
            borderRadius: theme.shape.radiusMd,
            backgroundColor: focused ? c.rowFocus : 'transparent',
          }}
        >
          {/* AniList has no per-episode stills, so a numbered tile stands in
              rather than the same banner twelve times over. */}
          <View
            style={{
              width: 132,
              height: 88,
              borderRadius: Math.max(0, theme.shape.radiusMd - 6),
              backgroundColor: c.tonal,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <Text variant="numeral" color={c.onTonal}>
              {episode}
            </Text>
            {progress > 0 && (
              <ProgressBar value={progress} height={6} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: 0 }} />
            )}
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="item" color={c.featureText}>
              {`Episode ${episode}`}
            </Text>
            <Text variant="label" color={current ? c.featureAccent : c.featureMuted}>
              {state}
            </Text>
          </View>
          {media.duration ? (
            <Text variant="meta" color={c.featureMuted} style={{ paddingRight: 12 }}>
              {`${media.duration} min`}
            </Text>
          ) : null}
        </View>
      )}
    </Focusable>
  );
}
