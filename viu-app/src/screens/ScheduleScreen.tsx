import { useMemo, useRef, useState } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';

import { Airing, airingBetween, displayTitle } from '../api/anilist';
import { useAsync } from '../lib/useAsync';
import { useNav } from '../nav/navigation';
import { useSettings } from '../state/settings';
import { Art } from '../ui/Art';
import { Chip } from '../ui/Chip';
import { FrameMarks, Hazard } from '../ui/Decor';
import { Focusable } from '../ui/Focusable';
import { Panel } from '../ui/Panel';
import { Text } from '../ui/Text';
import { TopNav } from '../ui/TopNav';
import { formatLabel } from './format';

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
  const graphic = theme.panel === 'solid';
  const nav = useNav();

  // Fixed for the screen's lifetime so the cache key stays stable.
  const [today] = useState(() => startOfDay(new Date()));
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)), [today]);
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

  // Today opens at what's airing next rather than at midnight. The scroll
  // waits for the rows to lay out, since it can't go past the content yet.
  const opened = useRef(false);
  const toUpcoming = () => {
    if (opened.current || dayIndex !== 0 || !list.length) return;
    opened.current = true;
    const upcoming = list.findIndex((a) => a.airingAt > Date.now() / 1000);
    const y = Math.max(0, (upcoming < 0 ? list.length : upcoming) - 1) * ROW_STEP;
    requestAnimationFrame(() => scroll.current?.scrollTo({ y, animated: false }));
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <FrameMarks crumb={`VIU.TV / SCHEDULE / ${dayLabel(days[dayIndex], dayIndex).toUpperCase()}`} />
      <TopNav active="schedule" />

      <View style={{ position: 'absolute', top: graphic ? 160 : 150, left: 80, right: 80, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        {days.map((d, i) => (
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
        ))}
        <View style={{ flex: 1 }} />
        <Text variant="label" size={graphic ? 14 : 18} color={c.textMuted}>
          {schedule.loading ? 'Loading…' : `${list.length} episodes`}
        </Text>
      </View>

      <Panel style={{ position: 'absolute', top: graphic ? 240 : 226, left: 56, right: 56, bottom: 40, padding: 22 }}>
        <ScrollView ref={scroll} onContentSizeChange={toUpcoming} style={{ flex: 1 }} contentContainerStyle={{ gap: 8, padding: 10 }} showsVerticalScrollIndicator={false}>
          {schedule.error && <Text color={c.featureMuted}>{`Couldn't load the schedule: ${schedule.error.message}`}</Text>}
          {!schedule.loading && !schedule.error && !list.length && <Text color={c.featureMuted}>Nothing airs on this day.</Text>}
          {list.map((a, i) => (
            <Focusable
              key={a.id}
              lift={false}
              radius={theme.shape.radiusMd}
              onFocus={() => scroll.current?.scrollTo({ y: Math.max(0, (i - 1) * ROW_STEP), animated: true })}
              onPress={() => nav.push({ name: 'details', mediaId: a.media.id })}
            >
              {(focused) => (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 28,
                    padding: 14,
                    borderRadius: theme.shape.radiusMd,
                    backgroundColor: focused ? (graphic ? 'rgba(12,12,14,0.08)' : 'rgba(255,218,210,0.14)') : 'transparent',
                    opacity: a.airingAt <= now ? 0.7 : 1,
                  }}
                >
                  <Text variant={graphic ? 'display' : 'bodyBold'} size={graphic ? 44 : 32} color={c.featureText} style={{ width: 120 }}>
                    {timeLabel(a.airingAt)}
                  </Text>
                  <Art
                    uri={a.media.bannerImage ?? a.media.coverImage.large}
                    fallback={a.media.coverImage.color}
                    style={{ width: 176, height: 99, borderRadius: Math.max(0, theme.shape.radiusMd - 6) }}
                  />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text variant={graphic ? 'title' : 'bodyBold'} size={graphic ? 28 : 24} color={c.featureText} numberOfLines={1}>
                      {displayTitle(a.media)}
                    </Text>
                    <Text variant="label" size={graphic ? 14 : 18} color={c.featureMuted}>
                      {[`Episode ${a.episode}${a.media.episodes ? ` of ${a.media.episodes}` : ''}`, formatLabel(a.media), a.media.studios.nodes[0]?.name]
                        .filter(Boolean)
                        .join('  ·  ')}
                    </Text>
                  </View>
                  <Hazard color={c.featureText} style={{ width: 120 }} />
                  <Text variant="label" size={graphic ? 14 : 18} color={a.airingAt <= now ? c.featureMuted : graphic ? c.featureText : c.primary} style={{ width: 150, textAlign: 'right', paddingRight: 12 }}>
                    {untilLabel(a.airingAt, now)}
                  </Text>
                </View>
              )}
            </Focusable>
          ))}
        </ScrollView>
      </Panel>
    </View>
  );
}
