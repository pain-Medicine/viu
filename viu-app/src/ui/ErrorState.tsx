import { View, ViewStyle } from 'react-native';

import { deviceKind } from '../lib/device';
import { explain } from '../lib/errors';
import { useNetwork } from '../state/network';
import { useTheme } from '../state/settings';
import { Button } from './Button';
import { useSurface } from './Surface';
import { Text } from './Text';

interface Props {
  error: Error;
  // Who was being asked, for errors that don't say: "AniList", "AllAnime".
  service: string;
  // Heading when the error has no better one: "Couldn't load My List".
  title: string;
  onRetry?: () => void;
  // A second way out, such as Back or "Try the dub".
  other?: { label: string; onPress: () => void };
  autoFocus?: boolean;
  // Inside a list or panel rather than filling a screen.
  compact?: boolean;
  style?: ViewStyle;
}

// Every failure says what happened and offers the way out, with the focus
// already on it: one press of OK retries.
export function ErrorState({ error, service, title, onRetry, other, autoFocus = true, compact, style }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const onFeature = useSurface() === 'feature';
  const { status } = useNetwork();
  const text = onFeature ? c.featureText : c.text;
  const muted = onFeature ? c.featureMuted : c.textMuted;

  let { title: heading, body, detail } = explain(error, service, title, deviceKind());
  // A blocked VPN or proxy explains every failure at once.
  if (status.state === 'error') {
    heading = "Viu’s VPN or proxy isn’t connected";
    body = 'Its traffic is blocked until it connects, so nothing leaks. Check it in Settings.';
    detail = status.message;
  }

  return (
    <View style={[{ gap: compact ? 12 : 20, maxWidth: 1100 }, style]}>
      <Text variant={compact ? 'section' : 'headline'} color={text}>
        {heading}
      </Text>
      <Text variant="bodyLg" color={text}>
        {body}
      </Text>
      {detail && detail !== body && (
        <Text variant="meta" color={muted} numberOfLines={2}>
          {detail}
        </Text>
      )}
      {(onRetry || other) && (
        <View style={{ flexDirection: 'row', gap: 16, marginTop: compact ? 4 : 12 }}>
          {onRetry && (
            <Button
              autoFocus={autoFocus}
              variant="primary"
              size={compact ? 'sm' : 'md'}
              icon="refresh"
              optionalIcon
              label="Try again"
              onPress={onRetry}
            />
          )}
          {other && (
            <Button
              autoFocus={autoFocus && !onRetry}
              variant={onRetry ? 'outline' : 'primary'}
              size={compact ? 'sm' : 'md'}
              label={other.label}
              onPress={other.onPress}
            />
          )}
        </View>
      )}
    </View>
  );
}
