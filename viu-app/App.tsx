// Per-weight imports, so only these files end up in the app bundle.
import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_500Medium } from '@expo-google-fonts/archivo/500Medium';
import { Archivo_600SemiBold } from '@expo-google-fonts/archivo/600SemiBold';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { type HostInstance, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NavigationProvider, Route, ScreenActiveContext, useNav } from './src/nav/navigation';
import { installSpatialNavigation } from './src/nav/spatialWeb';
import { BrowseScreen } from './src/screens/BrowseScreen';
import { DetailsScreen } from './src/screens/DetailsScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MyListScreen } from './src/screens/MyListScreen';
import { PlayerScreen } from './src/screens/PlayerScreen';
import { ScheduleScreen } from './src/screens/ScheduleScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { VpnImportScreen } from './src/screens/VpnImportScreen';
import { AccountProvider } from './src/state/account';
import { HistoryProvider } from './src/state/history';
import { LocalListProvider } from './src/state/mylist';
import { NetworkProvider, useNetwork } from './src/state/network';
import { SettingsProvider, useSettings } from './src/state/settings';
import { Panel } from './src/ui/Panel';
import { Stage } from './src/ui/Stage';
import { Text } from './src/ui/Text';

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    // This package has no per-weight entry points, so the files are required directly.
    BigShouldersDisplay_800ExtraBold: require('@expo-google-fonts/big-shoulders-display/BigShouldersDisplay_800ExtraBold.ttf'),
    BigShouldersDisplay_900Black: require('@expo-google-fonts/big-shoulders-display/BigShouldersDisplay_900Black.ttf'),
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    if (Platform.OS === 'web') return installSpatialNavigation();
  }, []);

  return (
    <SafeAreaProvider style={{ backgroundColor: '#000' }}>
      <NetworkProvider>
        <NetworkGate>
          <SettingsProvider>
            <AccountProvider>
              <HistoryProvider>
                <LocalListProvider>
                  <NavigationProvider>
                    <StatusBar hidden style="light" />
                    <Root ready={fontsLoaded} />
                  </NavigationProvider>
                </LocalListProvider>
              </HistoryProvider>
            </AccountProvider>
          </SettingsProvider>
        </NetworkGate>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}

// Holds every provider back until the proxy or VPN is in place, so the first
// AniList request can't leave without it.
function NetworkGate({ children }: { children: React.ReactNode }) {
  const { ready } = useNetwork();
  return ready ? children : <View style={{ flex: 1, backgroundColor: '#000' }} />;
}

function Root({ ready }: { ready: boolean }) {
  const settings = useSettings();
  const { stack, exitArmed } = useNav();
  if (!ready || !settings.ready) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  return (
    <Stage>
      {/* Screens under the top one stay mounted but hidden, so going back
          returns to the same scroll position and focused item. */}
      {stack.map((route, i) => (
        <ScreenHost key={`${i}:${route.name}`} active={i === stack.length - 1}>
          {renderRoute(route)}
        </ScreenHost>
      ))}
      {exitArmed && <ExitHint />}
    </Stage>
  );
}

function ExitHint() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 72, alignItems: 'center' }}>
      <Panel kind="chrome" style={{ paddingHorizontal: 36, paddingVertical: 18 }}>
        <Text variant="bodyBold">Press Back again to leave Viu</Text>
      </Panel>
    </View>
  );
}

function renderRoute(route: Route) {
  switch (route.name) {
    case 'home':
      return <HomeScreen />;
    case 'browse':
      return <BrowseScreen />;
    case 'schedule':
      return <ScheduleScreen />;
    case 'mylist':
      return <MyListScreen />;
    case 'search':
      return <SearchScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'signin':
      return <SignInScreen />;
    case 'vpnimport':
      return <VpnImportScreen />;
    case 'details':
      return <DetailsScreen mediaId={route.mediaId} />;
    case 'player':
      return <PlayerScreen key={route.episode} mediaId={route.mediaId} episode={route.episode} translation={route.translation} />;
  }
}

function ScreenHost({ active, children }: { active: boolean; children: React.ReactNode }) {
  const host = useRef<HostInstance>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  // Browsers drop focus from hidden elements, so remember it and put it back.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = host.current as unknown as HTMLElement | null;
    if (!el) return;
    const onFocusIn = (e: FocusEvent) => {
      lastFocused.current = e.target as HTMLElement;
    };
    el.addEventListener('focusin', onFocusIn);
    return () => el.removeEventListener('focusin', onFocusIn);
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web' || !active || !lastFocused.current) return;
    const t = setTimeout(() => lastFocused.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <View ref={host} style={[StyleSheet.absoluteFill, !active && { display: 'none' }]}>
      <ScreenActiveContext.Provider value={active}>{children}</ScreenActiveContext.Provider>
    </View>
  );
}
