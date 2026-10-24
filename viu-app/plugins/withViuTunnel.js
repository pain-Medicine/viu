// Links the WireGuard library into the Android app. The viu-network module
// only compiles against it, because Android libraries can't bundle a local
// .aar; the app has to include it itself.
const { withAppBuildGradle } = require('expo/config-plugins');

const LINE =
  '    implementation files("${rootProject.projectDir}/../modules/viu-network/android/libs/viutunnel.aar") // viu-tunnel';

module.exports = function withViuTunnel(config) {
  return withAppBuildGradle(config, (config) => {
    const gradle = config.modResults.contents;
    if (!gradle.includes('// viu-tunnel')) {
      config.modResults.contents = gradle.replace(/dependencies\s*\{/, (m) => `${m}\n${LINE}`);
    }
    return config;
  });
};
