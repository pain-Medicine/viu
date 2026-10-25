import { useEvent, useEventListener } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoSource, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as RN from 'react-native';
import { ActivityIndicator, Animated, Easing, type HostInstance, Platform, Pressable, StyleSheet, View } from 'react-native';

import { displayTitle, getMedia } from '../api/anilist';
import { SkipInterval, skipTimes } from '../api/aniskip';
import { useAsync } from '../lib/useAsync';
import { useReduceMotion } from '../lib/useReduceMotion';
import { useNav, useScreenActive } from '../nav/navigation';
import { findShow, playableUrl, provider, showKey, TranslationType } from '../providers';
import { isWatched, useHistory } from '../state/history';
import { useProgressSync } from '../state/mylist';
import { useSettings } from '../state/settings';
import { Art, HeroScrim, withAlpha } from '../ui/Art';
import { Button } from '../ui/Button';
import { FrameMarks } from '../ui/Decor';
import { ErrorState } from '../ui/ErrorState';
import type { FocusableHandle } from '../ui/Focusable';
import { Panel } from '../ui/Panel';
import { ProgressBar } from '../ui/ProgressBar';
import { Text } from '../ui/Text';
import { clock } from './format';

const HIDE_AFTER_MS = 4000;
// How long the bar stays up after seeking with the controls hidden.
const SEEK_PEEK_MS = 1500;
const SEEK_S = 10;
const LONG_SEEK_S = 30;
const UP_NEXT_S = 10;
const SAVE_EVERY_S = 10;
// The overlay fades in the same rhythm as the focus lift.
const FADE_MS = 160;

interface TVRemoteEvent {
  eventType: string;
}

// react-native-tvos reports every remote key press, including ones that don't
// move focus. The web build's react-native-web has no such hook.
const useTVEventHandler: (handler: (e: TVRemoteEvent) => void) => void =
  (RN as unknown as { useTVEventHandler?: (handler: (e: TVRemoteEvent) => void) => void }).useTVEventHandler ?? (() => {});

interface Option {
  label: string;
  source: VideoSource;
}

// What the screen shows over the video:
// - hidden: just the video. Left and right seek; any other key brings the controls.
// - seeking: the progress bar alone, briefly, after a seek from hidden.
// - controls: everything, with focus on Play.
type Overlay = 'hidden' | 'seeking' | 'controls';

export function PlayerScreen({ mediaId, episode, translation }: { mediaId: number; episode: string; translation: TranslationType }) {
  const { theme, settings } = useSettings();
  const c = theme.colors;
  const nav = useNav();
  const active = useScreenActive();
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
    if (!options.length) throw new Error('AllAnime has no playable stream for this episode yet.');
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
  // Waiting for data mid-episode. The player reports this as not playing, but
  // the viewer didn't pause, so it gets a spinner rather than the paused look.
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const buffering = status === 'loading';
  // A stream that won't load (expired, refused) moves on to the next server,
  // and shows an error once none is left.
  const [playError, setPlayError] = useState<Error>();
  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status !== 'error') return;
    if (optionIndex < (streams.data?.options.length ?? 0) - 1) setOptionIndex(optionIndex + 1);
    else setPlayError(new Error(error?.message ?? "The video didn’t load from any server."));
  });
  const time = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });
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

  const episodes = show.data?.episodes[translation] ?? [];
  const next = useMemo(() => {
    const i = episodes.indexOf(episode);
    return i >= 0 && i < episodes.length - 1 ? episodes[i + 1] : null;
  }, [episodes, episode]);
  // From Details, the episode list is one step back. From Home's Continue
  // watching it isn't there yet, so the player gives way to it.
  const toEpisodes = () => {
    const below = nav.stack[nav.stack.length - 2];
    if (below?.name === 'details' && below.mediaId === mediaId) nav.back();
    else nav.replace({ name: 'details', mediaId });
  };
  const goNext = () => {
    save();
    if (next) nav.replace({ name: 'player', mediaId, episode: next, translation });
  };

  // At the end, the next episode counts down instead of starting unasked.
  const [upNextIn, setUpNextIn] = useState<number | null>(null);
  useEventListener(player, 'playToEnd', () => {
    if (next) setUpNextIn(UP_NEXT_S);
  });
  useEffect(() => {
    if (upNextIn === null) return;
    if (upNextIn <= 0) {
      goNext();
      return;
    }
    const t = setTimeout(() => setUpNextIn((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upNextIn]);

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

  // The overlay.
  const [overlay, setOverlay] = useState<Overlay>('controls');
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showControls = useCallback(() => {
    setOverlay('controls');
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOverlay('hidden'), HIDE_AFTER_MS);
  }, []);
  const peekSeek = useCallback(() => {
    setOverlay((o) => (o === 'controls' ? o : 'seeking'));
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOverlay('hidden'), SEEK_PEEK_MS);
  }, []);
  useEffect(() => {
    showControls();
    return () => clearTimeout(hideTimer.current);
  }, [showControls]);

  const seek = useCallback(
    (delta: number) => {
      player.seekBy(delta);
    },
    [player],
  );
  const togglePlay = useCallback(() => {
    if (player.playing) player.pause();
    else player.play();
  }, [player]);

  // Paused, the controls stay up.
  const controlsUp = overlay === 'controls' || (!isPlaying && !buffering);
  const upNextShown = upNextIn !== null;
  const skipShown = !!option && !playError && !!skip && !settings.autoSkip && !upNextShown;
  // Which part of the screen holds the remote's focus.
  const focusOn = upNextShown ? 'upNext' : controlsUp ? 'controls' : skipShown ? 'skip' : 'catcher';

  // Remote keys while the controls are hidden. With focus on the invisible
  // catcher there's nothing for the D-pad to move to, so left and right are
  // free to seek.
  const onKey = useCallback(
    (key: string): boolean => {
      if (key === 'playPause' || key === 'play' || key === 'pause') {
        togglePlay();
        showControls();
        return true;
      }
      if (key === 'fastForward' || key === 'rewind') {
        seek(key === 'rewind' ? -SEEK_S : SEEK_S);
        if (!controlsUp) peekSeek();
        return true;
      }
      if (upNextShown) return false;
      if (controlsUp) {
        showControls();
        return false;
      }
      if (key === 'left' || key === 'right' || key === 'longLeft' || key === 'longRight') {
        const step = key.startsWith('long') ? LONG_SEEK_S : SEEK_S;
        seek(key.endsWith('eft') ? -step : step);
        peekSeek();
        return true;
      }
      if (key === 'select' && skipShown) return false;
      showControls();
      return true;
    },
    [togglePlay, showControls, seek, peekSeek, controlsUp, upNextShown, skipShown],
  );
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;
  useTVEventHandler((e) => {
    if (active) onKeyRef.current(e.eventType);
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || !active) return;
    const keys: Record<string, string> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
      Enter: 'select',
      ' ': 'playPause',
      MediaPlayPause: 'playPause',
    };
    // Captures before the arrow-key focus mover, so hidden-controls seeking
    // doesn't also move focus.
    const onKeyDown = (e: KeyboardEvent) => {
      const key = keys[e.key];
      if (key && onKeyRef.current(key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onMouse = () => onKeyRef.current('mouse');
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('mousemove', onMouse);
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('mousemove', onMouse);
    };
  }, [active]);

  // Focus goes where the screen's state says it should, including back to
  // Play or the catcher when the skip button goes away.
  const playButton = useRef<FocusableHandle>(null);
  const catcher = useRef<HostInstance>(null);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      if (focusOn === 'controls') playButton.current?.focus();
      else if (focusOn === 'catcher') {
        const el = catcher.current as unknown as { focus?: () => void; requestTVFocus?: () => void } | null;
        if (Platform.OS === 'web') el?.focus?.();
        else el?.requestTVFocus?.();
      }
    }, 30);
    return () => clearTimeout(t);
  }, [focusOn, active]);

  const m = media.data;
  const notListed =
    show.data === null ? new Error(`AllAnime doesn’t list this title with ${translation === 'dub' ? 'a dub' : 'subtitles'}.`) : undefined;
  const error = media.error ?? show.error ?? notListed ?? streams.error ?? playError;
  const retry = media.error
    ? media.retry
    : show.error
      ? show.retry
      : notListed
        ? undefined
        : () => {
            setPlayError(undefined);
            setOptionIndex(0);
            streams.retry();
          };
  const remaining = Math.max(0, duration - time.currentTime);
  const barShown = controlsUp || overlay === 'seeking';

  // The overlay fades rather than snapping, and its controls stay drawn until
  // the fade ends.
  const reduceMotion = useReduceMotion();
  const fade = useRef(new Animated.Value(1)).current;
  const [lingering, setLingering] = useState(true);
  useEffect(() => {
    if (controlsUp) setLingering(true);
    const to = barShown ? 1 : 0;
    if (reduceMotion) {
      fade.setValue(to);
      if (!controlsUp) setLingering(false);
      return;
    }
    const anim = Animated.timing(fade, {
      toValue: to,
      duration: FADE_MS,
      easing: Easing.out(Easing.exp),
      useNativeDriver: Platform.OS !== 'web',
    });
    anim.start(({ finished }) => {
      if (finished && !controlsUp) setLingering(false);
    });
    return () => anim.stop();
  }, [barShown, controlsUp, reduceMotion, fade]);
  const controlsDrawn = controlsUp || lingering;

  return (
    // Black behind the video, for letterboxing, in every theme.
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
      {option ? (
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
      ) : (
        m && (
          <Art
            uri={m.bannerImage ?? m.coverImage.extraLarge}
            fallback={m.coverImage.color}
            blur={m.bannerImage ? undefined : 30}
            style={[StyleSheet.absoluteFill, { opacity: 0.35 }]}
          />
        )
      )}

      {/* Holds focus while the controls are hidden, so the D-pad seeks
          instead of moving between invisible buttons. */}
      <Pressable
        ref={catcher}
        focusable={focusOn === 'catcher'}
        accessibilityLabel="Show controls"
        onPress={showControls}
        style={[StyleSheet.absoluteFill, Platform.OS === 'web' ? ({ outlineStyle: 'none', cursor: 'default' } as object) : null]}
        {...(Platform.isTV ? { hasTVPreferredFocus: focusOn === 'catcher' } : {})}
      />

      {(error || !option) && (
        <>
          <HeroScrim strength="full" />
          <View style={{ position: 'absolute', left: 80, right: 80, top: 0, bottom: 0, justifyContent: 'center' }}>
            {error ? (
              <ErrorState
                error={error}
                service="AllAnime"
                title="Can’t play this episode"
                onRetry={retry}
                other={{ label: 'Back', onPress: nav.back }}
              />
            ) : (
              <View style={{ gap: 16 }}>
                <Text variant="headline">{`Loading episode ${episode}…`}</Text>
                {m && (
                  <Text variant="bodyLg" color={c.textMuted}>
                    {displayTitle(m)}
                  </Text>
                )}
              </View>
            )}
          </View>
        </>
      )}

      {option && !error && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]} pointerEvents={controlsUp ? 'box-none' : 'none'}>
          <FrameMarks crumb={`VIU.TV / PLAY / E${episode}`} />
          <LinearGradient
            pointerEvents="none"
            colors={[withAlpha(c.scrim, 0), withAlpha(c.scrim, 0.7)]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 420 }}
          />

          {controlsDrawn && (
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
                <Text variant="item">{`Episode ${episode}`}</Text>
                <Text variant="label" color={c.textMuted}>
                  {m ? displayTitle(m) : ''}
                </Text>
              </View>
            </Panel>
          )}

          <Panel
            kind="chrome"
            radius={40}
            style={{ position: 'absolute', left: 80, right: 80, bottom: 56, paddingVertical: 30, paddingHorizontal: 36, gap: 24 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
              <Text variant="label" color={c.text} style={{ fontVariant: ['tabular-nums'] }}>
                {clock(time.currentTime)}
              </Text>
              <View style={{ flex: 1 }}>
                <ProgressBar
                  value={duration ? time.bufferedPosition / duration : 0}
                  height={10}
                  color={withAlpha(c.outline, 0.5)}
                  track={c.outline}
                />
                <ProgressBar
                  value={duration ? time.currentTime / duration : 0}
                  height={10}
                  track="transparent"
                  color={c.progress}
                  style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
                />
              </View>
              <Text variant="label" color={c.text} style={{ fontVariant: ['tabular-nums'] }}>
                {`−${clock(remaining)}`}
              </Text>
            </View>
            {controlsDrawn && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Button
                  variant="ghost"
                  icon="back10"
                  accessibilityLabel="Back 10 seconds"
                  focusable={focusOn === 'controls'}
                  onPress={() => {
                    seek(-SEEK_S);
                    showControls();
                  }}
                  onFocus={showControls}
                />
                <Button
                  ref={playButton}
                  autoFocus={focusOn === 'controls'}
                  focusable={focusOn === 'controls'}
                  variant="primary"
                  icon={isPlaying || buffering ? 'pause' : 'play'}
                  accessibilityLabel={isPlaying || buffering ? 'Pause' : 'Play'}
                  onPress={() => {
                    togglePlay();
                    showControls();
                  }}
                  onFocus={showControls}
                />
                <Button
                  variant="ghost"
                  icon="forward10"
                  accessibilityLabel="Forward 10 seconds"
                  focusable={focusOn === 'controls'}
                  onPress={() => {
                    seek(SEEK_S);
                    showControls();
                  }}
                  onFocus={showControls}
                />
                <View style={{ flex: 1 }} />
                {streams.data && streams.data.options.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    label={`Switch server · ${option.label}`}
                    focusable={focusOn === 'controls'}
                    onPress={() => {
                      resumeAt.current = player.currentTime;
                      setOptionIndex((i) => (i + 1) % streams.data!.options.length);
                      showControls();
                    }}
                    onFocus={showControls}
                  />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  icon="list"
                  label="Episodes"
                  focusable={focusOn === 'controls'}
                  onPress={toEpisodes}
                  onFocus={showControls}
                />
                {next && (
                  <Button
                    size="sm"
                    icon="next"
                    label="Next episode"
                    focusable={focusOn === 'controls'}
                    onPress={goNext}
                    onFocus={showControls}
                  />
                )}
              </View>
            )}
          </Panel>
        </Animated.View>
      )}

      {option && !error && buffering && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={c.text} accessibilityLabel="Loading video" style={{ transform: [{ scale: 2 }] }} />
        </View>
      )}

      {/* Stays up while the rest of the controls fade, and takes focus so
          one press of OK skips. */}
      {skipShown && (
        <View style={{ position: 'absolute', right: 80, bottom: controlsUp ? 300 : 80 }}>
          <Button
            key={`${skip!.kind}:${skip!.start}`}
            autoFocus={focusOn === 'skip'}
            focusable={focusOn === 'skip' || focusOn === 'controls'}
            variant="primary"
            icon="next"
            label={SKIP_LABELS[skip!.kind]}
            onPress={() => {
              player.currentTime = skip!.end;
            }}
          />
        </View>
      )}

      {upNextShown && next && (
        <Panel kind="chrome" radius={36} style={{ position: 'absolute', right: 80, bottom: 80, width: 620, padding: 32, gap: 20 }}>
          <Text variant="label" color={c.textMuted}>{`Up next in ${upNextIn}`}</Text>
          <Text variant="item">{`Episode ${next}`}</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Button autoFocus variant="primary" icon="play" optionalIcon label="Play now" onPress={goNext} />
            <Button
              variant="outline"
              label="Cancel"
              onPress={() => {
                setUpNextIn(null);
                showControls();
              }}
            />
          </View>
        </Panel>
      )}
    </View>
  );
}

const SKIP_LABELS: Record<SkipInterval['kind'], string> = {
  intro: 'Skip intro',
  recap: 'Skip recap',
  credits: 'Skip credits',
};
