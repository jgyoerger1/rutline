/**
 * Native-shell glue. Every call is a no-op in the browser so the web app and
 * the App Store build share one code base.
 */
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { Keyboard } from '@capacitor/keyboard'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() // 'ios' | 'android' | 'web'

/** A short tap, used when the blood light finds something */
export async function hapticHit(): Promise<void> {
  if (isNative) {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium })
      return
    } catch {
      /* fall through */
    }
  }
  try {
    navigator.vibrate?.(35)
  } catch {
    /* unsupported */
  }
}

export async function hapticSuccess(): Promise<void> {
  if (!isNative) return
  try {
    await Haptics.notification({ type: NotificationType.Success })
  } catch {
    /* ignore */
  }
}

/** Called once the first screen has rendered */
export async function initNative(onOpenUrl: (url: string) => void): Promise<void> {
  if (!isNative) return
  try {
    await StatusBar.setStyle({ style: Style.Dark })
    if (platform === 'android') await StatusBar.setBackgroundColor({ color: '#0f1110' })
  } catch {
    /* ignore */
  }
  try {
    await Keyboard.setAccessoryBarVisible({ isVisible: false })
  } catch {
    /* ios only */
  }
  // The view has shrunk to the space above the keyboard (capacitor.config.ts, resize
  // 'native'); bring the field being typed in to the middle of what is left
  void Keyboard.addListener('keyboardDidShow', () => {
    const el = document.activeElement
    if (!(el instanceof HTMLElement) || !el.matches('input, textarea, select, [contenteditable="true"]')) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' })
  })
  try {
    const launch = await CapApp.getLaunchUrl()
    if (launch?.url) onOpenUrl(launch.url)
  } catch {
    /* ignore */
  }
  void CapApp.addListener('appUrlOpen', ({ url }) => onOpenUrl(url))
  if (platform === 'android') {
    // Hardware back: an open sheet closes (components/ui.tsx), then a non-map view
    // returns to the map (App.tsx), then the app goes to the background
    void CapApp.addListener('backButton', () => {
      const ev = new Event('rutline:back', { cancelable: true })
      window.dispatchEvent(ev)
      if (!ev.defaultPrevented) void CapApp.minimizeApp()
    })
  }
  try {
    await SplashScreen.hide({ fadeOutDuration: 300 })
  } catch {
    /* ignore */
  }
}
