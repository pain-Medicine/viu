import { View } from 'react-native';

import { displayTitle, Media } from '../api/anilist';
import { useTheme } from '../state/settings';
import { Art } from './Art';
import { Focusable } from './Focusable';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';

interface Props {
  media: Media;
  width: number;
  height: number;
  // Landscape cards use the banner; posters use the cover.
  shape?: 'landscape' | 'poster';
  progress?: number;
  // Right-hand caption, such as "E14".
  tag?: string;
  // Second caption line under posters.
  meta?: string;
  index?: number;
  onFeature?: boolean;
  onPress?: () => void;
  onFocus?: () => void;
  autoFocus?: boolean;
}

export function MediaCard({
  media,
  width,
  height,
  shape = 'landscape',
  progress,
  tag,
  meta,
  index,
  onFeature,
  onPress,
  onFocus,
  autoFocus,
}: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const graphic = theme.panel === 'solid';
  const textColor = onFeature ? c.featureText : c.text;
  const mutedColor = onFeature ? c.featureMuted : c.textMuted;
  const uri =
    shape === 'landscape'
      ? media.bannerImage ?? media.coverImage.extraLarge ?? media.coverImage.large
      : media.coverImage.extraLarge ?? media.coverImage.large;

  return (
    <View style={{ width, gap: graphic ? 10 : 12 }}>
      <Focusable
        onPress={onPress}
        onFocus={onFocus}
        autoFocus={autoFocus}
        radius={shape === 'poster' ? theme.shape.radiusLg - 12 : theme.shape.radiusMd}
        accessibilityLabel={displayTitle(media)}
      >
        <Art
          uri={uri}
          fallback={media.coverImage.color}
          style={{
            width,
            height,
            borderRadius: shape === 'poster' ? Math.max(0, theme.shape.radiusLg - 12) : theme.shape.radiusMd,
            borderWidth: graphic ? 0 : 1,
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          {theme.decor.indexLabels && index !== undefined && (
            <Text variant="labelBold" size={13} color="#E8E4DA" style={{ position: 'absolute', top: 10, left: 12 }}>
              {String(index + 1).padStart(2, '0')}
            </Text>
          )}
          {progress !== undefined && progress > 0 && (
            <ProgressBar
              value={progress}
              height={graphic ? 8 : 6}
              style={
                graphic
                  ? { position: 'absolute', left: 0, right: 0, bottom: 0 }
                  : { position: 'absolute', left: 14, right: 14, bottom: 14 }
              }
            />
          )}
        </Art>
      </Focusable>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingHorizontal: graphic ? 0 : 6 }}>
        <Text
          variant={graphic ? 'title' : 'bodyBold'}
          size={graphic ? 26 : 20}
          color={textColor}
          numberOfLines={shape === 'poster' ? 2 : 1}
          style={{ flex: 1, lineHeight: graphic ? 26 : 25 }}
        >
          {displayTitle(media)}
        </Text>
        {tag && (
          <Text variant="label" size={graphic ? 14 : 18} color={mutedColor}>
            {tag}
          </Text>
        )}
      </View>
      {meta && (
        <Text variant="label" size={graphic ? 13 : 17} color={mutedColor} style={{ paddingHorizontal: graphic ? 0 : 6, marginTop: -4 }}>
          {meta}
        </Text>
      )}
    </View>
  );
}
