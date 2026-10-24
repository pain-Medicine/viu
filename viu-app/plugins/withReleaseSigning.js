// Signs Android release builds with your own upload key when one is set up,
// and falls back to the debug key otherwise, so a release APK can always be
// built and sideloaded. The key is read at build time from Gradle properties
// or environment variables, never stored in the repo:
//
//   VIU_UPLOAD_STORE_FILE      path to the .jks / .keystore file
//   VIU_UPLOAD_STORE_PASSWORD
//   VIU_UPLOAD_KEY_ALIAS
//   VIU_UPLOAD_KEY_PASSWORD
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// viu-release-signing';

const SIGNING_CONFIG = `
        release { ${MARKER}
            def viuProp = { String name -> project.findProperty(name) ?: System.getenv(name) }
            if (viuProp('VIU_UPLOAD_STORE_FILE')) {
                storeFile file(viuProp('VIU_UPLOAD_STORE_FILE'))
                storePassword viuProp('VIU_UPLOAD_STORE_PASSWORD')
                keyAlias viuProp('VIU_UPLOAD_KEY_ALIAS')
                keyPassword viuProp('VIU_UPLOAD_KEY_PASSWORD')
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`;

function addSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;
  // Add a release signing config next to the template's debug one.
  const withConfig = gradle.replace(/signingConfigs\s*\{/, (m) => `${m}${SIGNING_CONFIG}`);
  if (withConfig === gradle) throw new Error('withReleaseSigning: signingConfigs block not found in app/build.gradle');
  // Point the release build type at it (the template signs release with debug).
  const releaseBlock = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
  const withRelease = withConfig.replace(releaseBlock, '$1signingConfig signingConfigs.release');
  if (withRelease === withConfig) throw new Error('withReleaseSigning: release buildType signingConfig not found in app/build.gradle');
  return withRelease;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addSigning(cfg.modResults.contents);
    return cfg;
  });
};
