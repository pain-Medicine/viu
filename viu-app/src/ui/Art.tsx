import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '../state/settings';

// Cover or banner art with a flat fallback colour while it loads, or when
// AniList has no image.
export function Art({
  uri,
  fallback,
  style,
  children,
}: {
  uri?: string | null;
  fallback?: string | null;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[{ backgroundColor: fallback ?? theme.colors.artFallback, overflow: 'hidden' }, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} recyclingKey={uri} />
      ) : null}
      {children}
    </View>
  );
}

// The left-to-right and bottom fades that keep hero text readable over art.
export function HeroScrim({ strength = 'hero' }: { strength?: 'hero' | 'details' }) {
  const theme = useTheme();
  const { scrim, scrimClear } = theme.colors;
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

// Swaps the alpha of an rgba() colour.
export function withAlpha(rgba: string, alpha: number): string {
  return rgba.replace(/rgba\(([^)]+),\s*[\d.]+\)/, `rgba($1, ${alpha})`);
}
