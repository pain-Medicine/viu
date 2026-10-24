import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useNav } from '../nav/navigation';
import { useAccount } from '../state/account';
import { checkExitAddress, useNetwork, wgEndpoint } from '../state/network';
import { useSettings } from '../state/settings';
import { themes } from '../theme/themes';
import type { Theme } from '../theme/types';
import { Art } from '../ui/Art';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { FrameMarks, Hazard } from '../ui/Decor';
import { Focusable } from '../ui/Focusable';
import { Icon } from '../ui/Icon';
import { ChamferBox } from '../ui/Shapes';
import { Text } from '../ui/Text';
import { TopNav } from '../ui/TopNav';

export function SettingsScreen() {
  const { theme, settings, update } = useSettings();
  const c = theme.colors;
  const graphic = theme.panel === 'solid';
  const proxy = process.env.EXPO_PUBLIC_PROVIDER_PROXY;
  const nav = useNav();
  const { account, signOut } = useAccount();
  const note = (text: string) => (
    <Text variant="label" size={graphic ? 14 : 18} color={c.textMuted} style={{ marginLeft: 12, flexShrink: 1 }}>
      {text}
    </Text>
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <FrameMarks crumb="VIU.TV / SETTINGS" />
      <TopNav active="settings" />

      <ScrollView
        style={{ position: 'absolute', top: 170, left: 0, right: 0, bottom: 0 }}
        contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 80, paddingBottom: 120, gap: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="display" size={graphic ? 110 : 72}>
          Settings
        </Text>

        <Section label="Theme" index="01">
          <View style={{ flexDirection: 'row', gap: 32 }}>
            {Object.values(themes).map((t, i) => (
              <ThemeCard
                key={t.id}
                option={t}
                selected={settings.themeId === t.id}
                autoFocus={i === 0}
                onPress={() => update({ themeId: t.id })}
              />
            ))}
          </View>
        </Section>

        <Section label="Playback" index="02">
          <View style={{ gap: 20 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Chip label="Subtitled" selected={settings.translation === 'sub'} onPress={() => update({ translation: 'sub' })} />
              <Chip label="Dubbed" selected={settings.translation === 'dub'} onPress={() => update({ translation: 'dub' })} />
              {note('Used when an episode starts from Home. Each title can switch on its page.')}
            </View>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Chip label="Ask to skip" selected={!settings.autoSkip} onPress={() => update({ autoSkip: false })} />
              <Chip label="Skip automatically" selected={settings.autoSkip} onPress={() => update({ autoSkip: true })} />
              {note('Intros, recaps and credits, using AniSkip’s community timestamps.')}
            </View>
          </View>
        </Section>

        <Section label="AniList" index="03">
          {account ? (
            <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
              <Art uri={account.user.avatar} style={{ width: 64, height: 64, borderRadius: theme.shape.button }} />
              <View style={{ gap: 4 }}>
                <Text variant="bodyBold" size={24}>{account.user.name}</Text>
                <Text variant="label" size={graphic ? 14 : 18} color={c.textMuted}>
                  My List and watched episodes sync to this account.
                </Text>
              </View>
              <View style={{ flex: 1 }} />
              <Button variant="outline" size="sm" label="Sign out" onPress={signOut} />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Button size="sm" label="Sign in to AniList" onPress={() => nav.push({ name: 'signin' })} />
              {note('Shows your AniList lists in My List and marks episodes watched as you finish them.')}
            </View>
          )}
        </Section>

        <NetworkSection />

        <Section label="About" index="05">
          <Text color={c.textMuted} size={20}>
            {`Viu 1.0  ·  Metadata from AniList  ·  Streams from AllAnime  ·  Skip times from AniSkip`}
            {Platform.OS === 'web' ? `  ·  ${proxy ? 'Provider proxy on' : 'No provider proxy, so streaming is off in the browser'}` : ''}
          </Text>
        </Section>
      </ScrollView>
    </View>
  );
}

function NetworkSection() {
  const { theme } = useSettings();
  const c = theme.colors;
  const graphic = theme.panel === 'solid';
  const nav = useNav();
  const { supported, settings, status, update } = useNetwork();
  const [proxy, setProxy] = useState(settings.proxy);
  const [focused, setFocused] = useState(false);
  const [check, setCheck] = useState<string | null>(null);
  const note = (text: string, color = c.textMuted) => (
    <Text variant="label" size={graphic ? 14 : 18} color={color} style={{ marginLeft: 12, flexShrink: 1 }}>
      {text}
    </Text>
  );

  if (!supported) {
    return (
      <Section label="Network" index="04">
        {note('In the browser, your computer’s own network settings apply. Proxy and VPN are in the Android TV app.')}
      </Section>
    );
  }

  const endpoint = wgEndpoint(settings.wgConfig);
  const runCheck = async () => {
    setCheck('Checking…');
    try {
      const { ip, country } = await checkExitAddress();
      setCheck(`Sites see you as ${ip} (${country})`);
    } catch {
      setCheck('No connection. With the VPN or proxy on, that means traffic is blocked, not leaking.');
    }
  };

  return (
    <Section label="Network" index="04">
      <View style={{ gap: 20 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Chip label="Off" selected={settings.mode === 'direct'} onPress={() => update({ mode: 'direct' })} />
          <Chip label="Proxy" selected={settings.mode === 'proxy'} onPress={() => update({ mode: 'proxy', proxy })} />
          <Chip label="WireGuard VPN" selected={settings.mode === 'vpn'} onPress={() => update({ mode: 'vpn' })} />
          {note('Only Viu’s traffic is routed, including video. Other apps are not affected.')}
        </View>

        {settings.mode === 'proxy' && (
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <TextInput
              value={proxy}
              onChangeText={setProxy}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={() => update({ proxy: proxy.trim() })}
              placeholder="http://host:port or socks5://host:port"
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                flex: 1,
                height: 64,
                paddingHorizontal: 22,
                fontFamily: theme.fonts.body,
                fontSize: 22,
                color: c.text,
                backgroundColor: c.chrome,
                borderRadius: Math.min(theme.shape.button, 32),
                borderWidth: focused ? 4 : 1,
                borderColor: focused ? c.focus : c.outline,
              }}
            />
            <Button size="sm" label="Save" onPress={() => update({ proxy: proxy.trim() })} />
          </View>
        )}

        {settings.mode === 'vpn' && (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Button
              size="sm"
              label={settings.wgConfig ? 'Replace config' : 'Import config from phone'}
              onPress={() => nav.push({ name: 'vpnimport' })}
            />
            {settings.wgConfig && (
              <Button variant="outline" size="sm" label="Remove config" onPress={() => update({ wgConfig: null, mode: 'direct' })} />
            )}
            {note(endpoint ? `Server ${endpoint}` : 'Any WireGuard .conf works, for example from Proton VPN, Mullvad or your own server.')}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Button variant="outline" size="sm" label="Check connection" onPress={runCheck} />
          {status.state === 'error'
            ? note(`Blocked: ${status.message}`, c.accent)
            : note(check ?? (status.state === 'direct' ? 'Connecting directly.' : `Routing through ${status.proxy}`))}
        </View>
      </View>
    </Section>
  );
}

function Section({ label, index, children }: { label: string; index: string; children: React.ReactNode }) {
  const { theme } = useSettings();
  const c = theme.colors;
  return (
    <View style={{ flexDirection: 'row', gap: 40 }}>
      <View style={{ width: 260, gap: 10, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {theme.decor.indexLabels && (
            <Text variant="labelBold" size={14} color={c.primary}>
              {index}
            </Text>
          )}
          <Text variant="title" size={theme.panel === 'solid' ? 36 : 28}>
            {label}
          </Text>
        </View>
        <Hazard color={c.outline} style={{ width: 160 }} />
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

// Each card previews its theme in that theme's own colours and type, so the
// choice is visible before it's made.
function ThemeCard({
  option,
  selected,
  autoFocus,
  onPress,
}: {
  option: Theme;
  selected: boolean;
  autoFocus?: boolean;
  onPress: () => void;
}) {
  const { theme } = useSettings();
  const o = option.colors;
  const solid = option.panel === 'solid';
  return (
    <Focusable onPress={onPress} autoFocus={autoFocus} radius={theme.shape.radiusLg} accessibilityLabel={`${option.name} theme`}>
      <View
        style={{
          width: 560,
          height: 300,
          borderRadius: theme.shape.radiusLg,
          backgroundColor: o.ground,
          borderWidth: selected ? 3 : 1,
          borderColor: selected ? o.primary : theme.colors.outline,
          overflow: 'hidden',
          padding: 32,
          gap: 16,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text
            style={{
              fontFamily: option.fonts.display,
              fontSize: solid ? 52 : 44,
              lineHeight: solid ? 50 : 48,
              letterSpacing: solid ? 1 : -1.6,
              textTransform: solid ? 'uppercase' : 'none',
            }}
            color={o.text}
            numberOfLines={1}
          >
            {option.name}
          </Text>
          {selected && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                height: 36,
                borderRadius: option.shape.chip,
                backgroundColor: o.selected,
              }}
            >
              <Icon name="check" size={16} color={o.onSelected} square={solid} />
              <Text style={{ fontFamily: option.fonts.labelBold, fontSize: 15, letterSpacing: option.type.labelTracking }} color={o.onSelected}>
                {solid ? 'IN USE' : 'In use'}
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontFamily: option.fonts.body, fontSize: 20, lineHeight: 28 }} color={o.textMuted}>
          {option.description}
        </Text>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {solid ? (
            <ChamferBox color={o.primary} cut={14} style={{ height: 52, paddingHorizontal: 26, justifyContent: 'center' }}>
              <Text style={{ fontFamily: option.fonts.display, fontSize: 26, letterSpacing: 1.5 }} color={o.onPrimary}>
                PLAY E1
              </Text>
            </ChamferBox>
          ) : (
            <View style={{ height: 52, paddingHorizontal: 26, borderRadius: 999, backgroundColor: o.primary, justifyContent: 'center' }}>
              <Text style={{ fontFamily: option.fonts.title, fontSize: 20 }} color={o.onPrimary}>
                Play E1
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {[o.primary, o.accent, o.featureBg, o.text].map((swatch, i) => (
            <View
              key={i}
              style={{
                width: 36,
                height: 36,
                borderRadius: solid ? 0 : 18,
                backgroundColor: swatch,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.18)',
              }}
            />
          ))}
        </View>
      </View>
    </Focusable>
  );
}
