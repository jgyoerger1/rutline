import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Native shell for the App Store build. The web app is built into dist-native
 * with a root base path (scripts/build-native.mjs) and copied in by `cap sync`.
 */
const config: CapacitorConfig = {
  appId: 'com.jordanyoerger.rutline',
  appName: 'Rutline',
  webDir: 'dist-native',
  ios: {
    scheme: 'Rutline',
    contentInset: 'automatic',
    backgroundColor: '#0f1110',
    preferredContentMode: 'mobile',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0f1110',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f1110',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'body',
    },
  },
}

export default config
