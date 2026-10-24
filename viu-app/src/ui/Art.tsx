import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import type { CardMedia } from '../api/anilist';
import { useTheme } from '../state/settings';
import { useSurface } from './Surface';

// Cover or banner art with a flat fallback colour while it loads, or when
// AniList has no image.
export function Art({
  uri,
  fallback,
  blur,
  style,
  children,
}: {
  uri?: string | null;
  fallback?: string | null;
  // Softens the image, for backdrops made from small art.
  blur?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[{ backgroundColor: fallback ?? theme.colors.artFallback, overflow: 'hidden' }, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} recyclingKey={uri} blurRadius={blur} />
      ) : null}
      {children}
    </View>
  );
}

// Full-screen art behind a title. AniList banners are about 1900 px wide, so
// they fill the screen; covers are about 460 px, and stretched to 4K they turn
// to mush. Without a banner the cover becomes a soft backdrop, with the sharp
// cover shown near its real size beside the text.
export function Backdrop({
  media,
  poster = true,
  posterRight = 120,
  opacity = 1,
}: {
  media: CardMedia;
  // Shows the sharp cover beside the text when there's no banner. Off where
  // the page shows the cover itself.
  poster?: boolean;
  posterRight?: number;
  opacity?: number;
}) {
  if (media.bannerImage) {
    return <Art uri={media.bannerImage} fallback={media.coverImage.color} style={[StyleSheet.absoluteFill, { opacity }]} />;
  }
  const cover = media.coverImage.extraLarge ?? media.coverImage.large;
  return (
    <>
      <Art uri={cover} fallback={media.coverImage.color} blur={40} style={[StyleSheet.absoluteFill, { opacity: 0.6 * opacity }]} />
      {cover && poster && (
        <Art
          uri={cover}
          fallback={media.coverImage.color}
          style={{ position: 'absolute', top: 150, right: posterRight, width: 400, height: 568 }}
        />
      )}
    </>
  );
}

// The left-to-right and bottom fades that keep hero text readable over art.
export function HeroScrim({ strength = 'hero' }: { strength?: 'hero' | 'details' | 'full' }) {
  const theme = useTheme();
  const { scrim, scrimClear } = theme.colors;
  if (strength === 'full') {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(scrim, 0.82) }]} />;
  }
  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[scrim, scrim, strength === 'hero' ? withAlpha(scrim, 0.45) : withAlpha(scrim, 0.6), scrimClear]}
        locations={strength === 'hero' ? [0, 0.24, 0.56, 0.84] : [0, 0.32, 0.62, 1.4]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[scrimClear, scrim]}
        locations={[0, 0.7]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 540 }}
      />
    </>
  );
}

// A placeholder block in the shape of what's loading, so the layout holds
// still while content arrives.
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const onFeature = useSurface() === 'feature';
  return (
    <View
      style={[
        { backgroundColor: onFeature ? theme.colors.featureSkeleton : theme.colors.skeleton, borderRadius: theme.shape.radiusMd },
        style,
      ]}
    />
  );
}

// Swaps the alpha of an rgba() colour.
export function withAlpha(rgba: string, alpha: number): string {
  return rgba.replace(/rgba\(([^)]+),\s*[\d.]+\)/, `rgba($1, ${alpha})`);
}
