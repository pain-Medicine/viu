import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ANILIST_AUTH_URL } from '../api/anilist';
import { useNav } from '../nav/navigation';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';
import { Button } from '../ui/Button';
import { FrameMarks } from '../ui/Decor';
import { Panel } from '../ui/Panel';
import { useStage } from '../ui/Stage';
import { QrCode } from '../ui/QrCode';
import { Text } from '../ui/Text';

// AniList's sign-in for apps without a server is the implicit grant: the
// browser ends on a page whose address holds the token. A TV can't open that
// page itself, so the sign-in happens on a phone and the token comes back by
// pasting it here: the Google TV app's remote keyboard can paste into this
// field, and so can `adb shell input text`.
export function SignInScreen() {
  const { theme } = useSettings();
  const c = theme.colors;
  const nav = useNav();
  const { signIn } = useAccount();

  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(token);
      nav.back();
    } catch (e) {
      setError(`AniList didn’t accept that token: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const stage = useStage();
  const step = (n: string, title: string, body: string) => (
    <View style={{ flexDirection: 'row', gap: 22 }}>
      <Text variant="numeral" color={c.primary} style={{ width: 52 }}>
        {n}
      </Text>
      <View style={{ flex: 1, gap: 6 }}>
        <Text variant="item">{title}</Text>
        <Text color={c.textMuted}>{body}</Text>
      </View>
    </View>
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <FrameMarks crumb="VIU.TV / SETTINGS / ANILIST" />
      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ paddingTop: stage.short ? 70 : 90, paddingHorizontal: 80, paddingBottom: 64, gap: stage.short ? 40 : 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 14 }}>
          <Text variant="page">Sign in to AniList</Text>
          <Text variant="bodyLg" color={c.textMuted}>
            Viu reads your lists and marks episodes watched. It never sees your password.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: stage.narrow ? 40 : 120, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 36 }}>
            {step('1', 'Open AniList on your phone', 'Scan the code, or go to the address under it. Sign in and approve Viu.')}
            {step(
              '2',
              'Copy the token',
              'AniList ends on a page whose address contains access_token=…. Copy the whole address, or just the token.',
            )}
            {step(
              '3',
              'Paste it here',
              Platform.OS === 'web'
                ? 'Paste into the field below, then choose Sign in.'
                : 'Select the field below, then paste with the Google TV app’s keyboard on your phone. From a computer, adb shell input text "<token>" works too.',
            )}
            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', marginLeft: 74 }}>
              <TextInput
                value={token}
                onChangeText={setToken}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={submit}
                placeholder="Paste the token or address"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!!token && !focused}
                style={{
                  flex: 1,
                  height: 64,
                  paddingHorizontal: 22,
                  fontFamily: theme.fonts.body,
                  fontSize: 24,
                  color: c.text,
                  backgroundColor: c.chrome,
                  borderRadius: Math.min(theme.shape.button, 32),
                  borderWidth: focused ? 4 : 1,
                  borderColor: focused ? c.focus : c.outline,
                }}
              />
              <Button variant="primary" label={busy ? 'Checking…' : 'Sign in'} disabled={busy || !token.trim()} onPress={submit} />
            </View>
            {error && (
              <Text variant="bodyBold" color={c.accent} style={{ marginLeft: 74 }}>
                {error}
              </Text>
            )}
          </View>

          <Panel style={{ width: stage.narrow ? 380 : 560, padding: stage.narrow ? 28 : 40, gap: 24, alignItems: 'center' }}>
            <QrCode value={ANILIST_AUTH_URL} size={stage.narrow ? 280 : 380} />
            <Text variant="label" color={c.featureMuted} style={{ textAlign: 'center' }} selectable>
              {ANILIST_AUTH_URL.replace('https://', '')}
            </Text>
          </Panel>
        </View>
      </ScrollView>
    </View>
  );
}
