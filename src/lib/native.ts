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
  try {
    const launch = await CapApp.getLaunchUrl()
    if (launch?.url) onOpenUrl(launch.url)
  } catch {
    /* ignore */
  }
  void CapApp.addListener('appUrlOpen', ({ url }) => onOpenUrl(url))
  try {
    await SplashScreen.hide({ fadeOutDuration: 300 })
  } catch {
    /* ignore */
  }
}
