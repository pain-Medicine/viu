import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoSource, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as RN from 'react-native';
import { Platform, StyleSheet, View } from 'react-native';

import { displayTitle, getMedia } from '../api/anilist';
import { SkipInterval, skipTimes } from '../api/aniskip';
import { useAsync } from '../lib/useAsync';
import { useNav } from '../nav/navigation';
import { findShow, playableUrl, provider, showKey, TranslationType } from '../providers';
import { isWatched, useHistory } from '../state/history';
import { useProgressSync } from '../state/mylist';
import { useSettings } from '../state/settings';
import { Art } from '../ui/Art';
import { Button } from '../ui/Button';
import { FrameMarks } from '../ui/Decor';
import { Panel } from '../ui/Panel';
import { ProgressBar } from '../ui/ProgressBar';
import { Text } from '../ui/Text';
import { clock } from './format';

const HIDE_AFTER_MS = 4000;

// react-native-tvos reports every remote key press, including ones that don't
// move focus. The web build's react-native-web has no such hook.
const useTVEventHandler: (handler: () => void) => void =
  (RN as unknown as { useTVEventHandler?: (handler: () => void) => void }).useTVEventHandler ?? (() => {});
const SAVE_EVERY_S = 10;

interface Option {
  label: string;
  source: VideoSource;
}

export function PlayerScreen({ mediaId, episode, translation }: { mediaId: number; episode: string; translation: TranslationType }) {
  const { theme, settings } = useSettings();
  const c = theme.colors;
  const graphic = theme.panel === 'solid';
  const nav = useNav();
  const history = useHistory();
  const syncProgress = useProgressSync();

  const media = useAsync(`media:${mediaId}`, () => getMedia(mediaId));
  // Usually already cached by the details page.
  const show = useAsync(media.data ? showKey(mediaId, translation) : null, () => findShow(media.data!, translation));
  const showId = show.data?.id;
  const streams = useAsync(showId ? `streams:${showId}:${episode}:${translation}` : null, async () => {
    const servers = await provider.episodeStreams(showId!, episode, translation);
    const options: Option[] = servers.flatMap((s) =>
      s.links.map((l) => ({ label: `${l.quality} · ${s.name}`, source: { uri: playableUrl(l.url, s.headers), headers: s.headers } })),
    );
    if (!options.length) throw new Error('No playable stream for this episode yet.');
    return { options };
  });

  const [optionIndex, setOptionIndex] = useState(0);
  const option = streams.data?.options[optionIndex];
  const player = useVideoPlayer(option?.source ?? null, (p) => {
    p.timeUpdateEventInterval = 1;
  });

  // Picks up where the last session of this episode stopped.
  const last = history.get(mediaId);
  const saved = last?.episodes?.[episode] ?? (last?.episode === episode ? last : undefined);
  const resumeAt = useRef(saved && saved.duration - saved.position > 30 ? saved.position : 0);
  useEventListener(player, 'sourceLoad', () => {
    if (resumeAt.current > 0) player.currentTime = resumeAt.current;
    resumeAt.current = 0;
    player.play();
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const time = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const duration = player.duration || 0;

  const lastSaved = useRef(0);
  const synced = useRef(false);
  const save = useCallback(() => {
    const position = player.currentTime;
    const total = player.duration;
    if (!(total > 0 && position > 5)) return;
    history.record({ mediaId, episode, position, duration: total });
    // Once per episode, when it counts as watched.
    if (!synced.current && media.data && isWatched({ position, duration: total })) {
      synced.current = true;
      syncProgress(media.data, episode).catch(() => {
        synced.current = false;
      });
    }
  }, [player, history, mediaId, episode, media.data, syncProgress]);
  useEffect(() => {
    if (Math.abs(time.currentTime - lastSaved.current) >= SAVE_EVERY_S) {
      lastSaved.current = time.currentTime;
      save();
    }
  }, [time.currentTime, save]);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => () => saveRef.current(), []);

  // Controls fade after a few seconds without input and come back on any key.
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const poke = useCallback(() => {
    setVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), HIDE_AFTER_MS);
  }, []);
  useEffect(() => {
    poke();
    if (Platform.OS !== 'web') return () => clearTimeout(hideTimer.current);
    window.addEventListener('keydown', poke);
    window.addEventListener('mousemove', poke);
    return () => {
      clearTimeout(hideTimer.current);
      window.removeEventListener('keydown', poke);
      window.removeEventListener('mousemove', poke);
    };
  }, [poke]);
  useTVEventHandler(poke);
  const shown = visible || !isPlaying;

  const episodes = show.data?.episodes[translation] ?? [];
  const next = useMemo(() => {
    const i = episodes.indexOf(episode);
    return i >= 0 && i < episodes.length - 1 ? episodes[i + 1] : null;
  }, [episodes, episode]);
  const goNext = () => {
    save();
    if (next) nav.replace({ name: 'player', mediaId, episode: next, translation });
  };
  useEventListener(player, 'playToEnd', () => {
    if (next) goNext();
  });

  // Skip times from AniSkip. Missing times just mean no skip button.
  const malId = media.data?.idMal;
  const skips = useAsync<SkipInterval[]>(malId ? `skip:${malId}:${episode}` : null, () => skipTimes(malId!, episode).catch(() => []));
  const skip = skips.data?.find((s) => time.currentTime >= s.start && time.currentTime < s.end - 1);
  const autoSkipped = useRef(new Set<SkipInterval>());
  useEffect(() => {
    if (!skip || !settings.autoSkip || autoSkipped.current.has(skip)) return;
    autoSkipped.current.add(skip);
    player.currentTime = skip.end;
  }, [skip, settings.autoSkip, player]);

  const seek = (delta: number) => {
    player.seekBy(delta);
    poke();
  };

  const m = media.data;
  const notListed = show.data === null ? new Error(`AllAnime doesn't list this title (${translation}).`) : undefined;
  const error = media.error ?? show.error ?? notListed ?? streams.error;
  const remaining = Math.max(0, duration - time.currentTime);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
      {option ? (
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
      ) : (
        m && <Art uri={m.bannerImage ?? m.coverImage.extraLarge} fallback={m.coverImage.color} style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} />
      )}

      {(error || !option) && (
        <View style={{ position: 'absolute', left: 80, right: 80, top: 0, bottom: 0, justifyContent: 'center', gap: 24 }}>
          <Text variant="display" size={graphic ? 96 : 64}>
            {error ? "Can't play this episode" : `Loading episode ${episode}…`}
          </Text>
          {error && (
            <>
              <Text size={26} color={c.textMuted} style={{ maxWidth: 1100 }}>
                {error.message}
              </Text>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
                <Button autoFocus variant="primary" label="Back" icon="chevronLeft" onPress={nav.back} />
              </View>
            </>
          )}
        </View>
      )}

      {option && !error && (
        <View style={[StyleSheet.absoluteFill, { opacity: shown ? 1 : 0 }]} pointerEvents={shown ? 'auto' : 'box-none'}>
          <FrameMarks crumb={`VIU.TV / PLAY / E${episode}`} />
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 360, backgroundColor: 'rgba(0,0,0,0.35)' }}
          />

          <Panel
            kind="chrome"
            style={{
              position: 'absolute',
              top: 56,
              left: 80,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 18,
              paddingVertical: 14,
              paddingLeft: 14,
              paddingRight: 28,
            }}
          >
            {m && (
              <Art
                uri={m.coverImage.large}
                fallback={m.coverImage.color}
                style={{ width: 56, height: 56, borderRadius: theme.shape.button }}
              />
            )}
            <View style={{ gap: 2 }}>
              <Text variant="title" size={graphic ? 30 : 24}>{`Episode ${episode}`}</Text>
              <Text variant="label" size={graphic ? 14 : 18} color={c.textMuted}>
                {m ? displayTitle(m) : ''}
              </Text>
            </View>
          </Panel>

          <Panel
            kind="chrome"
            radius={40}
            style={{ position: 'absolute', left: 80, right: 80, bottom: 56, paddingVertical: 30, paddingHorizontal: 36, gap: 24 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
              <Text variant="label" size={graphic ? 16 : 20} color={c.text}>
                {clock(time.currentTime)}
              </Text>
              <View style={{ flex: 1 }}>
                <ProgressBar
                  value={duration ? time.bufferedPosition / duration : 0}
                  height={10}
                  color="rgba(255,255,255,0.3)"
                  track="rgba(255,255,255,0.2)"
                />
                <ProgressBar
                  value={duration ? time.currentTime / duration : 0}
                  height={10}
                  track="transparent"
                  color={c.progress}
                  style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
                />
              </View>
              <Text variant="label" size={graphic ? 16 : 20} color={c.text}>
                {`−${clock(remaining)}`}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Button variant="ghost" icon="back10" accessibilityLabel="Back 10 seconds" onPress={() => seek(-10)} onFocus={poke} />
              <Button
                autoFocus
                variant="primary"
                icon={isPlaying ? 'pause' : 'play'}
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                onPress={() => {
                  if (isPlaying) player.pause();
                  else player.play();
                  poke();
                }}
                onFocus={poke}
              />
              <Button variant="ghost" icon="forward10" accessibilityLabel="Forward 10 seconds" onPress={() => seek(10)} onFocus={poke} />
              <View style={{ flex: 1 }} />
              {streams.data && streams.data.options.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  label={option.label}
                  onPress={() => {
                    resumeAt.current = player.currentTime;
                    setOptionIndex((i) => (i + 1) % streams.data!.options.length);
                  }}
                  onFocus={poke}
                />
              )}
              <Button variant="outline" size="sm" icon="list" label="Episodes" onPress={nav.back} onFocus={poke} />
              {next && <Button size="sm" icon="next" label="Next episode" onPress={goNext} onFocus={poke} />}
            </View>
          </Panel>
        </View>
      )}

      {/* Stays up while the rest of the controls fade, and takes focus so
          one press of OK skips. */}
      {option && !error && skip && !settings.autoSkip && (
        <View style={{ position: 'absolute', right: 80, bottom: shown ? 300 : 80 }}>
          <Button
            key={`${skip.kind}:${skip.start}`}
            autoFocus
            variant="primary"
            icon="next"
            label={SKIP_LABELS[skip.kind]}
            onPress={() => {
              player.currentTime = skip.end;
              poke();
            }}
          />
        </View>
      )}
    </View>
  );
}

const SKIP_LABELS: Record<SkipInterval['kind'], string> = {
  intro: 'Skip intro',
  recap: 'Skip recap',
  credits: 'Skip credits',
};
