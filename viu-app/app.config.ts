import type { ConfigContext, ExpoConfig } from 'expo/config';

// One config builds every target. EXPO_TV=1 switches the native projects to
// Android TV / Apple TV; without it they are the phone and tablet apps.
// The TV build gets its own application id so both can sit on one device.
const isTV = process.env.EXPO_TV === '1' || process.env.EXPO_TV === 'true';
const version = process.env.VIU_VERSION ?? '1.0.0';
// Raise VIU_BUILD_NUMBER for each build you hand out, so Android installs it
// over the previous one.
const buildNumber = Number(process.env.VIU_BUILD_NUMBER ?? 1);

const GROUND = '#1A1110';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Viu',
  slug: 'viu',
  scheme: 'viu',
  version,
  // Phones and tablets are landscape only; the layout adapts to the screen's shape.
  orientation: 'landscape',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#000000',
  ios: {
    bundleIdentifier: isTV ? 'media.viu.app.tv' : 'media.viu.app',
    buildNumber: String(buildNumber),
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ['audio'],
    },
  },
  android: {
    package: isTV ? 'media.viu.app.tv' : 'media.viu.app',
    versionCode: buildNumber,
    // Storage holds the WireGuard private key and the AniList token, which
    // shouldn't end up in cloud or adb backups.
    allowBackup: false,
    adaptiveIcon: {
      backgroundColor: GROUND,
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
    name: 'Viu',
    backgroundColor: '#000000',
  },
  plugins: [
    [
      '@react-native-tvos/config-tv',
      {
        androidTVBanner: './assets/tv-banner.png',
        androidTVIcon: './assets/tv-icon.png',
      },
    ],
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 200, resizeMode: 'contain', backgroundColor: GROUND }],
    'expo-video',
    'expo-font',
    'expo-image',
    './plugins/withReleaseSigning',
    './plugins/withViuTunnel',
  ],
});
