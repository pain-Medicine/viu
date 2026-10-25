import { memo } from 'react';
import { View } from 'react-native';

import { CardMedia, displayTitle } from '../api/anilist';
import { useTheme } from '../state/settings';
import { Art, Skeleton } from './Art';
import { Focusable } from './Focusable';
import { ProgressBar } from './ProgressBar';
import { useSurface } from './Surface';
import { Text } from './Text';

interface Props {
  media: CardMedia;
  width: number;
  height: number;
  // Landscape cards use the banner; posters use the cover.
  shape?: 'landscape' | 'poster';
  progress?: number;
  // Short caption, such as "E14" or "84%": beside the title, or at the end
  // of the meta line when there is one, so long titles keep the full width.
  tag?: string;
  // Second caption line under posters.
  meta?: string;
  // Read out after the title, such as "Episode 14, 40% watched".
  spokenDetail?: string;
  index?: number;
  onPress?: () => void;
  onFocus?: () => void;
  autoFocus?: boolean;
}

// Memoised: rows re-render often (the Home hero follows focus), and a card
// only needs to redraw when its own props change.
export const MediaCard = memo(function MediaCard({
  media,
  width,
  height,
  shape = 'landscape',
  progress,
  tag,
  meta,
  spokenDetail,
  index,
  onPress,
  onFocus,
  autoFocus,
}: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const onFeature = useSurface() === 'feature';
  const textColor = onFeature ? c.featureText : c.text;
  const mutedColor = onFeature ? c.featureMuted : c.textMuted;
  const uri =
    shape === 'landscape'
      ? (media.bannerImage ?? media.coverImage.extraLarge ?? media.coverImage.large)
      : (media.coverImage.extraLarge ?? media.coverImage.large);
  const radius = shape === 'poster' ? Math.max(0, theme.shape.radiusLg - 12) : theme.shape.radiusMd;
  const title = displayTitle(media);
  const inset = theme.shape.captionInset;

  return (
    <View style={{ width, gap: 12 }}>
      <Focusable
        onPress={onPress}
        onFocus={onFocus}
        autoFocus={autoFocus}
        radius={radius}
        accessibilityLabel={[title, spokenDetail ?? meta].filter(Boolean).join(', ')}
      >
        <Art
          uri={uri}
          fallback={media.coverImage.color}
          style={{ width, height, borderRadius: radius, borderWidth: theme.shape.artBorder, borderColor: c.artOutline }}
        >
          {theme.decor.indexLabels && index !== undefined && (
            // Backed, so the number reads on light art too.
            <View style={{ position: 'absolute', top: 0, left: 0, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: c.chrome }}>
              <Text variant="metaBold" color={c.text}>
                {String(index + 1).padStart(2, '0')}
              </Text>
            </View>
          )}
          {progress !== undefined && progress > 0 && (
            <ProgressBar
              value={progress}
              height={theme.style.flushProgress ? 8 : 6}
              style={
                theme.style.flushProgress
                  ? { position: 'absolute', left: 0, right: 0, bottom: 0 }
                  : { position: 'absolute', left: 14, right: 14, bottom: 14 }
              }
            />
          )}
        </Art>
      </Focusable>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingHorizontal: inset }}>
        <Text variant="cardTitle" color={textColor} numberOfLines={shape === 'poster' ? 2 : 1} style={{ flex: 1 }}>
          {title}
        </Text>
        {tag && !meta && (
          <Text variant="meta" color={mutedColor}>
            {tag}
          </Text>
        )}
      </View>
      {meta && (
        <Text variant="meta" color={mutedColor} numberOfLines={1} style={{ paddingHorizontal: inset, marginTop: -6 }}>
          {tag ? `${meta}  ·  ${tag}` : meta}
        </Text>
      )}
    </View>
  );
});

// Poster-shaped placeholders for a grid that's loading.
export function PosterSkeletons({ count, width, height }: { count: number; width: number; height: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width, gap: 12 }}>
          <Skeleton style={{ width, height }} />
          <Skeleton style={{ width: width * 0.8, height: 22 }} />
        </View>
      ))}
    </>
  );
}
