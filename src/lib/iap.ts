/**
 * In-app purchase for the App Store build, through RevenueCat. On the web Pro
 * is sold with a Stripe link (pro.ts); Apple requires its own billing inside
 * the app, so the native shell sells the same season pass as a StoreKit
 * product. RevenueCat holds the receipt, grants the 'pro' entitlement and
 * calls our webhook (supabase/functions/revenuecat-webhook) so the account
 * gets the same entitlements row the Stripe webhook writes. Every call here
 * is a no-op in the browser and in a native build with no key.
 */
import { LOG_LEVEL, PRODUCT_TYPE, PURCHASES_ERROR_CODE, Purchases, type CustomerInfo, type PurchasesError, type PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { isNative, platform } from './native'

const RC_KEY = (import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined)?.trim() || ''
/** True in an iOS build that carries a RevenueCat key: Pro is sold in-app */
export const IAP_CONFIGURED = isNative && platform === 'ios' && RC_KEY !== ''
const ENTITLEMENT = 'pro'
const PASS_DAYS = 365

export interface IapStatus {
  pro: boolean
  until: number | null
  productId: string | null
  willRenew: boolean
  sandbox: boolean
}

export interface IapOffer {
  pkg: PurchasesPackage
  /** The store's own price string, in the buyer's currency */
  price: string
  /** Auto-renewable subscription (Apple's yearly plan) rather than a one-time pass */
  renews: boolean
}

let configured: Promise<void> | null = null
function ensureConfigured(): Promise<void> {
  if (!IAP_CONFIGURED) return Promise.reject(new Error('In-app purchase is not in this build'))
  if (!configured) {
    configured = (async () => {
      if (import.meta.env.DEV) await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG })
      await Purchases.configure({ apiKey: RC_KEY })
    })().catch((e) => {
      configured = null
      throw e
    })
  }
  return configured
}

function statusFrom(info: CustomerInfo): IapStatus {
  const ent = info.entitlements.active[ENTITLEMENT]
  if (!ent) return { pro: false, until: null, productId: null, willRenew: false, sandbox: false }
  // A non-renewing pass has no store expiry; it runs a year from the purchase
  const until = ent.expirationDateMillis ?? ent.latestPurchaseDateMillis + PASS_DAYS * 86400e3
  return { pro: until > Date.now(), until, productId: ent.productIdentifier, willRenew: ent.willRenew, sandbox: ent.isSandbox }
}

/** What the App Store says for this phone's Apple ID. Null when IAP is not in this build. */
export async function getStatus(): Promise<IapStatus | null> {
  if (!IAP_CONFIGURED) return null
  await ensureConfigured()
  const { customerInfo } = await Purchases.getCustomerInfo()
  return statusFrom(customerInfo)
}

/**
 * Tie the receipt to the account so the webhook can write its entitlement.
 * A purchase made while signed out merges into the account on sign-in.
 */
export async function identify(userId: string | null): Promise<void> {
  if (!IAP_CONFIGURED) return
  await ensureConfigured()
  if (userId) {
    await Purchases.logIn({ appUserID: userId })
    return
  }
  const { isAnonymous } = await Purchases.isAnonymous()
  if (!isAnonymous) await Purchases.logOut()
}

/** The season pass as the App Store prices it for this phone */
export async function getOffer(): Promise<IapOffer | null> {
  if (!IAP_CONFIGURED) return null
  await ensureConfigured()
  const { current } = await Purchases.getOfferings()
  const pkg = current?.annual ?? current?.lifetime ?? current?.availablePackages[0] ?? null
  if (!pkg) return null
  return { pkg, price: pkg.product.priceString, renews: pkg.product.productType === PRODUCT_TYPE.AUTO_RENEWABLE_SUBSCRIPTION }
}

export type BuyResult = { ok: true; status: IapStatus } | { ok: false; cancelled: boolean; message: string }

export async function buy(pkg: PurchasesPackage): Promise<BuyResult> {
  try {
    await ensureConfigured()
    const r = await Purchases.purchasePackage({ aPackage: pkg })
    return { ok: true, status: statusFrom(r.customerInfo) }
  } catch (e) {
    const err = e as Partial<PurchasesError>
    const cancelled = err.userCancelled === true || String(err.code) === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
    return { ok: false, cancelled, message: cancelled ? 'Purchase cancelled' : err.message || 'The App Store did not finish the purchase' }
  }
}

/** Reinstalled, or a new phone on the same Apple ID */
export async function restore(): Promise<IapStatus> {
  await ensureConfigured()
  const { customerInfo } = await Purchases.restorePurchases()
  return statusFrom(customerInfo)
}

/** Renewals, refunds and purchases finished elsewhere arrive here */
export function onChange(cb: (s: IapStatus) => void): void {
  if (!IAP_CONFIGURED) return
  void ensureConfigured()
    .then(() => Purchases.addCustomerInfoUpdateListener((info) => cb(statusFrom(info))))
    .catch(() => undefined)
}
