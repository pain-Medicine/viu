import { useEffect, useRef, useState } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';

import { currentSeason, GENRES, listMedia, MediaFilter } from '../api/anilist';
import { useAsync } from '../lib/useAsync';
import { useNav } from '../nav/navigation';
import { useSettings } from '../state/settings';
import { Chip } from '../ui/Chip';
import { FrameMarks } from '../ui/Decor';
import { Empty } from '../ui/Empty';
import { ErrorState } from '../ui/ErrorState';
import { MediaCard, PosterSkeletons } from '../ui/MediaCard';
import { Panel } from '../ui/Panel';
import { gridColumns, useCardSize, useStage } from '../ui/Stage';
import { Text } from '../ui/Text';
import { TopNav } from '../ui/TopNav';
import { formatLabel } from './format';

const PER_PAGE = 24;
const CARD_W = 236;
const CARD_H = 336;

type Season = NonNullable<MediaFilter['season']>;

const SORTS: { label: string; sort: string[] }[] = [
  { label: 'Trending', sort: ['TRENDING_DESC', 'POPULARITY_DESC'] },
  { label: 'Popular', sort: ['POPULARITY_DESC'] },
  { label: 'Top rated', sort: ['SCORE_DESC'] },
  { label: 'Newest', sort: ['START_DATE_DESC'] },
];
const FORMATS = ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'TV_SHORT'];
const SEASONS: Season[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
const SEASON_LABELS: Record<Season, string> = { WINTER: 'Winter', SPRING: 'Spring', SUMMER: 'Summer', FALL: 'Fall' };
const FORMAT_LABELS: Record<string, string> = {
  TV: 'TV',
  MOVIE: 'Movie',
  OVA: 'OVA',
  ONA: 'ONA',
  SPECIAL: 'Special',
  TV_SHORT: 'TV short',
};

interface Filters {
  sort: number;
  format?: string;
  year?: number;
  season?: Season;
  genre?: string;
}

// AniList's catalogue with a filter column on the left, laid out like Search
// so the two screens feel the same with a remote.
export function BrowseScreen() {
  const { theme } = useSettings();
  const c = theme.colors;
  const nav = useNav();
  const stage = useStage();
  const { cardW, cardH, rowStep } = useCardSize(CARD_W, CARD_H);
  const panelW = stage.narrow ? 360 : 600;
  const gridLeft = 80 + panelW + 20;
  // As many poster columns as the screen has room for.
  const cols = gridColumns(stage.width - gridLeft - 66, cardW);

  const thisYear = currentSeason().year;
  const years = Array.from({ length: 6 }, (_, i) => thisYear - i);
  const [filters, setFilters] = useState<Filters>({ sort: 0 });
  const [pages, setPages] = useState(1);
  const set = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPages(1);
    grid.current?.scrollTo({ y: 0, animated: false });
  };

  const filter: MediaFilter = {
    sort: SORTS[filters.sort].sort,
    format: filters.format,
    genre: filters.genre,
    // AniList needs a year with a season; a season alone means this year.
    seasonYear: filters.year ?? (filters.season ? thisYear : undefined),
    season: filters.season,
    perPage: PER_PAGE,
  };
  const key = JSON.stringify(filter);
  const grid = useRef<ScrollViewInstance>(null);
  const [lastPage, setLastPage] = useState<{ key: string; page: number; count: number } | null>(null);
  const more = lastPage?.key === key && lastPage.page === pages && lastPage.count === PER_PAGE;

  const group = (label: string, children: React.ReactNode) => (
    <View style={{ gap: 12 }}>
      <Text variant="meta" color={c.featureMuted}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{children}</View>
    </View>
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <FrameMarks crumb="VIU.TV / BROWSE" />
      <TopNav active="browse" />

      <Panel style={{ position: 'absolute', top: theme.layout.contentTop, left: 80, bottom: 56, width: panelW }}>
        <ScrollView contentContainerStyle={{ padding: stage.narrow ? 22 : 28, gap: 26 }} showsVerticalScrollIndicator={false}>
          {group(
            'Sort',
            SORTS.map((s, i) => (
              <Chip key={s.label} label={s.label} selected={filters.sort === i} autoFocus={i === 0} onPress={() => set({ sort: i })} />
            )),
          )}
          {group('Format', [
            <Chip key="any" label="Any" selected={!filters.format} onPress={() => set({ format: undefined })} />,
            ...FORMATS.map((f) => (
              <Chip key={f} label={FORMAT_LABELS[f]} selected={filters.format === f} onPress={() => set({ format: f })} />
            )),
          ])}
          {group('Year', [
            <Chip key="any" label="Any" selected={!filters.year} onPress={() => set({ year: undefined })} />,
            ...years.map((y) => <Chip key={y} label={String(y)} selected={filters.year === y} onPress={() => set({ year: y })} />),
          ])}
          {group('Season', [
            <Chip key="any" label="Any" selected={!filters.season} onPress={() => set({ season: undefined })} />,
            ...SEASONS.map((s) => (
              <Chip key={s} label={SEASON_LABELS[s]} selected={filters.season === s} onPress={() => set({ season: s })} />
            )),
          ])}
          {group('Genre', [
            <Chip key="any" label="Any" selected={!filters.genre} onPress={() => set({ genre: undefined })} />,
            ...GENRES.map((g) => <Chip key={g} label={g} selected={filters.genre === g} onPress={() => set({ genre: g })} />),
          ])}
        </ScrollView>
      </Panel>

      <ScrollView
        ref={grid}
        style={{ position: 'absolute', top: theme.layout.contentTop - 14, left: gridLeft, right: 66, bottom: 0 }}
        contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 32, padding: 14, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {Array.from({ length: pages }, (_, i) => (
          <ResultsPage
            key={`${key}:${i + 1}`}
            filter={filter}
            page={i + 1}
            onLoaded={(count) => setLastPage({ key, page: i + 1, count })}
            onFocusIndex={(n) => {
              grid.current?.scrollTo({ y: Math.max(0, Math.floor((i * PER_PAGE + n) / cols) * rowStep), animated: true });
              // Reaching the last row of what's loaded fetches the next page,
              // so a remote never has to find a "more" button.
              if (more && i + 1 === pages && n >= PER_PAGE - cols) setPages((p) => p + 1);
            }}
            cols={cols}
            onOpen={(id) => nav.push({ name: 'details', mediaId: id })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// One page of results. Pages are separate components so each can load on its
// own while the earlier ones stay on screen.
function ResultsPage({
  filter,
  page,
  onLoaded,
  onFocusIndex,
  cols,
  onOpen,
}: {
  cols: number;
  filter: MediaFilter;
  page: number;
  onLoaded: (count: number) => void;
  onFocusIndex: (index: number) => void;
  onOpen: (mediaId: number) => void;
}) {
  const { cardW, cardH } = useCardSize(CARD_W, CARD_H);
  const result = useAsync(`browse:${JSON.stringify(filter)}:${page}`, () => listMedia({ ...filter, page }));
  const count = result.data?.length;
  useEffect(() => {
    if (count !== undefined) onLoaded(count);
    // Reports once per load; onLoaded is recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (result.error) {
    return (
      <ErrorState
        compact
        autoFocus={page === 1}
        error={result.error}
        service="AniList"
        title="Couldn't load titles"
        onRetry={result.retry}
        style={{ width: '100%', paddingVertical: 8 }}
      />
    );
  }
  if (result.loading) return <PosterSkeletons count={page === 1 ? PER_PAGE : cols} width={cardW} height={cardH} />;
  if (count === 0 && page === 1) {
    return <Empty title="Nothing matches" body="No titles on AniList fit all of these filters. Try setting one back to Any." />;
  }
  return (
    <>
      {(result.data ?? []).map((m, n) => (
        <MediaCard
          key={m.id}
          media={m}
          shape="poster"
          width={cardW}
          height={cardH}
          meta={[m.seasonYear, formatLabel(m)].filter(Boolean).join(' · ')}
          tag={m.averageScore ? `${m.averageScore}%` : undefined}
          onFocus={() => onFocusIndex(n)}
          onPress={() => onOpen(m.id)}
        />
      ))}
    </>
  );
}
