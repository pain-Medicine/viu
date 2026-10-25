import { useMemo, useRef, useState } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';

import { Airing, airingBetween, displayTitle } from '../api/anilist';
import { useAsync } from '../lib/useAsync';
import { useNav } from '../nav/navigation';
import { useSettings } from '../state/settings';
import { Art, Skeleton } from '../ui/Art';
import { Chip } from '../ui/Chip';
import { FrameMarks, Hazard } from '../ui/Decor';
import { Empty } from '../ui/Empty';
import { ErrorState } from '../ui/ErrorState';
import { Focusable } from '../ui/Focusable';
import { Panel } from '../ui/Panel';
import { useStage } from '../ui/Stage';
import { Text } from '../ui/Text';
import { TopNav } from '../ui/TopNav';
import { countLabel, formatLabel } from './format';

const DAYS = 7;
const ROW_STEP = 135;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayLabel(day: Date, i: number): string {
  if (i === 0) return 'Today';
  if (i === 1) return 'Tomorrow';
  return WEEKDAYS[day.getDay()];
}

function timeLabel(unix: number): string {
  const d = new Date(unix * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function untilLabel(unix: number, now: number): string {
  const s = unix - now;
  if (s <= 0) return 'Aired';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `In ${h}h ${m}m` : `In ${m}m`;
}

// What airs over the next week, a day at a time, in the TV's local time.
export function ScheduleScreen() {
  const { theme } = useSettings();
  const c = theme.colors;
  const nav = useNav();

  // Fixed for the screen's lifetime so the cache key stays stable.
  const [today] = useState(() => startOfDay(new Date()));
  const days = useMemo(
    () => Array.from({ length: DAYS }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)),
    [today],
  );
  const from = Math.floor(today.getTime() / 1000);
  const to = Math.floor(days[DAYS - 1].getTime() / 1000) + 86400;
  const schedule = useAsync(`schedule:${from}`, () => airingBetween(from, to));

  const [dayIndex, setDayIndex] = useState(0);
  const byDay = useMemo(() => {
    const out: Airing[][] = days.map(() => []);
    for (const a of schedule.data ?? []) {
      // Compared with each local midnight rather than counting 24-hour
      // steps, so a daylight saving change doesn't shift a day.
      const t = a.airingAt * 1000;
      const day = days.findLastIndex((d) => t >= d.getTime());
      if (day >= 0) out[day].push(a);
    }
    return out;
  }, [schedule.data, days]);
  const list = byDay[dayIndex];
  const now = Date.now() / 1000;
  const scroll = useRef<ScrollViewInstance>(null);
  // Where the rows start inside the scroll view: 0 on a TV, below the nav and
  // days when the whole page scrolls.
  const rowsTop = useRef(0);
  // Height of the day chips, which stay pinned to the top while the page
  // scrolls, so the rows they cover are left out of scroll targets.
  const daysH = useRef(0);
  const flow = useStage().mode === 'flow';

  // Today opens at what's airing next rather than at midnight. The scroll
  // waits for the rows to lay out, since it can't go past the content yet.
  const opened = useRef(false);
  const toUpcoming = () => {
    if (opened.current || dayIndex !== 0 || !list.length) return;
    opened.current = true;
    const upcoming = list.findIndex((a) => a.airingAt > Date.now() / 1000);
    const y = Math.max(0, (upcoming < 0 ? list.length : upcoming) - 1) * ROW_STEP + rowsTop.current - daysH.current;
    requestAnimationFrame(() => scroll.current?.scrollTo({ y, animated: false }));
  };

  const chips = days.map((d, i) => (
    <Chip
      key={i}
      label={dayLabel(d, i)}
      selected={dayIndex === i}
      autoFocus={i === 0}
      onPress={() => {
        setDayIndex(i);
        scroll.current?.scrollTo({ y: 0, animated: false });
      }}
    />
  ));
  const count = (
    <Text variant="label" color={c.textMuted}>
      {schedule.loading ? 'Loading…' : countLabel(list.length, 'episode')}
    </Text>
  );
  const rows = (
    <>
      {schedule.error && (
        <ErrorState
          compact
          autoFocus={false}
          error={schedule.error}
          service="AniList"
          title="Couldn’t load the schedule"
          onRetry={schedule.retry}
        />
      )}
      {schedule.loading && Array.from({ length: 6 }, (_, i) => <Skeleton key={i} style={{ height: 112, marginBottom: 8 }} />)}
      {!schedule.loading && !schedule.error && !list.length && (
        <Empty title="A quiet day" body="Nothing on AniList airs on this day. Try another one." />
      )}
      {list.map((a, i) => (
        <Focusable
          key={a.id}
          lift={false}
          radius={theme.shape.radiusMd}
          onFocus={() => scroll.current?.scrollTo({ y: Math.max(0, rowsTop.current - daysH.current + (i - 1) * ROW_STEP), animated: true })}
          onPress={() => nav.push({ name: 'details', mediaId: a.media.id })}
          accessibilityLabel={`${timeLabel(a.airingAt)}, ${displayTitle(a.media)}, episode ${a.episode}, ${untilLabel(a.airingAt, now)}`}
        >
          {(focused) => (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 28,
                padding: 14,
                borderRadius: theme.shape.radiusMd,
                backgroundColor: focused ? c.rowFocus : 'transparent',
                opacity: a.airingAt <= now ? 0.7 : 1,
              }}
            >
              <Text variant="numeral" color={c.featureText} style={{ width: 120 }}>
                {timeLabel(a.airingAt)}
              </Text>
              <Art
                uri={a.media.bannerImage ?? a.media.coverImage.large}
                fallback={a.media.coverImage.color}
                style={{ width: 176, height: 99, borderRadius: Math.max(0, theme.shape.radiusMd - 6) }}
              />
              <View style={{ flex: 1, gap: 6 }}>
                <Text variant="item" color={c.featureText} numberOfLines={1}>
                  {displayTitle(a.media)}
                </Text>
                <Text variant="label" color={c.featureMuted} numberOfLines={1}>
                  {[
                    `Episode ${a.episode}${a.media.episodes ? ` of ${a.media.episodes}` : ''}`,
                    formatLabel(a.media),
                    a.media.studios.nodes[0]?.name,
                  ]
                    .filter(Boolean)
                    .join('  ·  ')}
                </Text>
              </View>
              <Hazard color={c.featureText} style={{ width: 120 }} />
              <Text
                variant="label"
                color={a.airingAt <= now ? c.featureMuted : c.featureAccent}
                style={{ width: 170, textAlign: 'right', paddingRight: 12 }}
              >
                {untilLabel(a.airingAt, now)}
              </Text>
            </View>
          )}
        </Focusable>
      ))}
    </>
  );

  // Off the TV the whole page scrolls so a short phone isn't left with a
  // sliver of list under fixed headers. The nav scrolls away; the day chips
  // stay pinned, so the list never loses which day it shows.
  if (flow) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <ScrollView
          ref={scroll}
          onContentSizeChange={toUpcoming}
          style={StyleSheet.absoluteFill}
          contentContainerStyle={{ paddingTop: theme.layout.contentTop, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[1]}
        >
          <TopNav active="schedule" />
          <View
            onLayout={(e) => (daysH.current = e.nativeEvent.layout.height)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 20, paddingRight: 80, backgroundColor: c.ground }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={{ gap: 12, paddingLeft: 80, paddingVertical: 10, paddingRight: 20 }}
            >
              {chips}
            </ScrollView>
            {count}
          </View>
          <View onLayout={(e) => (rowsTop.current = e.nativeEvent.layout.y)}>
            <Panel style={{ marginHorizontal: 56, marginTop: 10, padding: 22 }}>
              <View style={{ gap: 8, padding: 10 }}>{rows}</View>
            </Panel>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <FrameMarks crumb={`VIU.TV / SCHEDULE / ${dayLabel(days[dayIndex], dayIndex).toUpperCase()}`} />
      <TopNav active="schedule" />

      <View
        style={{
          position: 'absolute',
          top: theme.layout.contentTop,
          left: 80,
          right: 80,
          flexDirection: 'row',
          gap: 12,
          alignItems: 'center',
        }}
      >
        {chips}
        <View style={{ flex: 1 }} />
        {count}
      </View>

      <Panel style={{ position: 'absolute', top: theme.layout.contentTop + 80, left: 56, right: 56, bottom: 40, padding: 22 }}>
        <ScrollView
          ref={scroll}
          onContentSizeChange={toUpcoming}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 8, padding: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {rows}
        </ScrollView>
      </Panel>
    </View>
  );
}
