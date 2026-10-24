import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { onConfigReceived, ViuNetwork } from '../../modules/viu-network';
import { useNav } from '../nav/navigation';
import { useNetwork, wgEndpoint } from '../state/network';
import { useSettings } from '../state/settings';
import { Button } from '../ui/Button';
import { FrameMarks } from '../ui/Decor';
import { Panel } from '../ui/Panel';
import { useStage } from '../ui/Stage';
import { QrCode } from '../ui/QrCode';
import { Text } from '../ui/Text';

const IMPORT_PORT = 8735;

// A WireGuard config is far too long to type with a remote, so the TV serves a
// small page on the home network while this screen is open, and a phone sends
// the file to it. Nothing goes through the internet.
export function VpnImportScreen() {
  const { theme } = useSettings();
  const c = theme.colors;
  const nav = useNav();
  const { update } = useNetwork();

  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [received, setReceived] = useState<string | null>(null);

  useEffect(() => {
    if (!ViuNetwork) return;
    const subscription = onConfigReceived((config) => {
      setReceived(wgEndpoint(config) ?? 'your VPN');
      update({ wgConfig: config, mode: 'vpn' });
    });
    ViuNetwork.startImportServer(IMPORT_PORT).then(setUrl, (e: Error) => setError(e.message));
    return () => {
      subscription?.remove();
      ViuNetwork?.stopImportServer();
    };
  }, [update]);

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
      <FrameMarks crumb="VIU.TV / SETTINGS / VPN" />
      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ paddingTop: stage.short ? 70 : 90, paddingHorizontal: 80, paddingBottom: 64, gap: stage.short ? 40 : 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 14 }}>
          <Text variant="page">Add a WireGuard VPN</Text>
          <Text variant="bodyLg" color={c.textMuted}>
            Only Viu uses the VPN. Other apps on this TV keep their normal connection.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: stage.narrow ? 40 : 120, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 36 }}>
            {step(
              '1',
              'Get a WireGuard config on your phone',
              'Any WireGuard .conf works. For Proton VPN: account.protonvpn.com → Downloads → WireGuard configuration, then download one.',
            )}
            {step('2', 'Open the page on the right', 'Scan the code with a phone on the same Wi-Fi as this TV, or type the address.')}
            {step('3', 'Send the file', 'Pick the .conf file (or paste its text) and tap Send to TV. Viu connects right away.')}
            {received && (
              <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center', marginLeft: 74 }}>
                <Text variant="bodyBold" color={c.primary}>
                  {`Got it. Viu now connects through ${received}.`}
                </Text>
                <Button variant="primary" size="sm" label="Done" autoFocus onPress={() => nav.back()} />
              </View>
            )}
            {error && (
              <Text variant="bodyBold" color={c.accent} style={{ marginLeft: 74 }}>
                {`Couldn't open the import page: ${error}`}
              </Text>
            )}
          </View>

          <Panel style={{ width: stage.narrow ? 380 : 560, padding: stage.narrow ? 28 : 40, gap: 24, alignItems: 'center' }}>
            {url ? (
              <QrCode value={url} size={stage.narrow ? 280 : 380} />
            ) : (
              <View style={{ width: stage.narrow ? 280 : 380, height: stage.narrow ? 280 : 380 }} />
            )}
            <Text variant="label" color={c.featureMuted} style={{ textAlign: 'center' }} selectable>
              {url ? url.replace('http://', '') : 'Starting…'}
            </Text>
          </Panel>
        </View>
      </ScrollView>
    </View>
  );
}
