import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Native shell for the App Store and Google Play builds. The web app is built into dist-native
 * with a root base path (scripts/build-native.mjs) and copied in by `cap sync`.
 */
const config: CapacitorConfig = {
  appId: 'com.jordanyoerger.rutline',
  appName: 'Rutline',
  webDir: 'dist-native',
  android: {
    backgroundColor: '#0f1110',
    allowMixedContent: false,
  },
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
      // 'native' shrinks the whole web view to the space above the keyboard. Every screen
      // and sheet is sized to the viewport (fixed / 100dvh), so 'body' (only document.body
      // shrinks) left sign-in and sheet fields under the keyboard. lib/native.ts then
      // scrolls the focused field into the middle of what is left.
      resize: 'native',
      // Android: the status bar overlays the web view (full screen), where the stock
      // adjustResize does nothing; this makes the plugin resize the view itself
      resizeOnFullScreen: true,
    },
  },
}

export default config
