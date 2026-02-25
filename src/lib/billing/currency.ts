/**
 * Billing - Multi-Currency Support
 * 
 * Handles currency formatting, detection, and validation
 * for international pricing support.
 */

export const SUPPORTED_CURRENCIES = {
  usd: { symbol: "$", name: "US Dollar", locale: "en-US", zeroDecimal: false, flag: "🇺🇸" },
  eur: { symbol: "€", name: "Euro", locale: "de-DE", zeroDecimal: false, flag: "🇪🇺" },
  gbp: { symbol: "£", name: "British Pound", locale: "en-GB", zeroDecimal: false, flag: "🇬🇧" },
  brl: { symbol: "R$", name: "Brazilian Real", locale: "pt-BR", zeroDecimal: false, flag: "🇧🇷" },
  cad: { symbol: "CA$", name: "Canadian Dollar", locale: "en-CA", zeroDecimal: false, flag: "🇨🇦" },
  aud: { symbol: "A$", name: "Australian Dollar", locale: "en-AU", zeroDecimal: false, flag: "🇦🇺" },
  jpy: { symbol: "¥", name: "Japanese Yen", locale: "ja-JP", zeroDecimal: true, flag: "🇯🇵" },
  inr: { symbol: "₹", name: "Indian Rupee", locale: "en-IN", zeroDecimal: false, flag: "🇮🇳" },
  mxn: { symbol: "MX$", name: "Mexican Peso", locale: "es-MX", zeroDecimal: false, flag: "🇲🇽" },
} as const;

export type SupportedCurrency = keyof typeof SUPPORTED_CURRENCIES;

export type CurrencyConfig = typeof SUPPORTED_CURRENCIES[SupportedCurrency];

// ============================================================
// FORMAT PRICES
// ============================================================

/**
 * Format price amount in smallest currency unit to human-readable string
 * 
 * @param amountInSmallestUnit - Amount in cents (USD), pence (GBP), yen (JPY), etc.
 * @param currency - The currency code
 * @returns Formatted price string (e.g., "$199.00", "€179.00", "¥100")
 */
export function formatPrice(amountInSmallestUnit: number, currency: SupportedCurrency): string {
  const config = SUPPORTED_CURRENCIES[currency];
  const amount = config.zeroDecimal ? amountInSmallestUnit : amountInSmallestUnit / 100;
  
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: config.zeroDecimal ? 0 : 2,
    maximumFractionDigits: config.zeroDecimal ? 0 : 2,
  }).format(amount);
}

/**
 * Format price from a BillingPlan StripePlanPrice record
 */
export function formatPlanPrice(price: {
  unitAmount: number;
  currency: string;
}): string {
  if (!isSupportedCurrency(price.currency)) {
    return `${price.unitAmount} ${price.currency.toUpperCase()}`;
  }
  return formatPrice(price.unitAmount, price.currency as SupportedCurrency);
}

// ============================================================
// DETECT CURRENCY
// ============================================================

/**
 * Map country codes to currencies
 */
const COUNTRY_TO_CURRENCY: Record<string, SupportedCurrency> = {
  // North America
  US: "usd",
  CA: "cad",
  
  // UK
  GB: "gbp",
  
  // Europe
  DE: "eur",
  FR: "eur",
  IT: "eur",
  ES: "eur",
  NL: "eur",
  PT: "eur",
  BE: "eur",
  AT: "eur",
  IE: "eur",
  FI: "eur",
  GR: "eur",
  
  // Latin America
  BR: "brl",
  MX: "mxn",
  
  // Asia Pacific
  JP: "jpy",
  IN: "inr",
  AU: "aud",
};

/**
 * Detect currency from user's country code
 * 
 * @param countryCode - Two-letter ISO 3166-1 alpha-2 country code
 * @returns Detected currency or USD as default
 */
export function detectCurrency(countryCode: string): SupportedCurrency {
  return COUNTRY_TO_CURRENCY[countryCode.toUpperCase()] ?? "usd";
}

/**
 * Get all supported currencies as an array
 */
export function getSupportedCurrencies(): SupportedCurrency[] {
  return Object.keys(SUPPORTED_CURRENCIES) as SupportedCurrency[];
}

/**
 * Get currency config by code
 */
export function getCurrencyConfig(currency: string): CurrencyConfig | null {
  if (!isSupportedCurrency(currency)) {
    return null;
  }
  return SUPPORTED_CURRENCIES[currency];
}

// ============================================================
// VALIDATION
// ============================================================

/**
 * Check if a currency code is supported
 */
export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return currency.toLowerCase() in SUPPORTED_CURRENCIES;
}

/**
 * Validate currency for Stripe (must be lowercase)
 */
export function validateCurrencyForStripe(currency: string): SupportedCurrency {
  if (!isSupportedCurrency(currency.toLowerCase())) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  return currency.toLowerCase() as SupportedCurrency;
}

// ============================================================
// CONVERSION HELPERS
// ============================================================

/**
 * Convert amount from one currency to another (simple fixed rate for display)
 * Note: In production, use a real-time exchange rate API
 */
export function convertCurrency(
  amount: number,
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency,
  exchangeRates?: Record<SupportedCurrency, number>
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }
  
  // Default fixed rates (for display estimation only - not for real transactions)
  const defaultRates: Record<SupportedCurrency, number> = {
    usd: 1.0,
    eur: 0.92,
    gbp: 0.79,
    brl: 4.97,
    cad: 1.36,
    aud: 1.53,
    jpy: 149.5,
    inr: 83.1,
    mxn: 17.15,
  };
  
  const rates = exchangeRates ?? defaultRates;
  const amountInUsd = amount / (rates[fromCurrency] || 1);
  return amountInUsd * (rates[toCurrency] || 1);
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: SupportedCurrency): string {
  return SUPPORTED_CURRENCIES[currency]?.symbol ?? currency.toUpperCase();
}

/**
 * Get locale for currency
 */
export function getCurrencyLocale(currency: SupportedCurrency): string {
  return SUPPORTED_CURRENCIES[currency]?.locale ?? "en-US";
}

// ============================================================
// PLAN PRICING HELPERS
// ============================================================

/**
 * Calculate yearly price from monthly (typically 2 months free = ~17% discount)
 */
export function calculateYearlyFromMonthly(monthlyAmount: number): number {
  // 2 months free (17% discount)
  return Math.round(monthlyAmount * 10);
}

/**
 * Calculate monthly price from yearly
 */
export function calculateMonthlyFromYearly(yearlyAmount: number): number {
  return Math.round(yearlyAmount / 12);
}

/**
 * Calculate savings from choosing yearly over monthly
 */
export function calculateYearlySavings(monthlyAmount: number): number {
  const yearlyFromMonthly = calculateYearlyFromMonthly(monthlyAmount);
  const fullYearly = monthlyAmount * 12;
  return fullYearly - yearlyFromMonthly;
}

/**
 * Get discount percentage for yearly billing
 */
export function getYearlyDiscountPercent(monthlyAmount: number): number {
  const yearlyFromMonthly = calculateYearlyFromMonthly(monthlyAmount);
  const fullYearly = monthlyAmount * 12;
  return Math.round(((fullYearly - yearlyFromMonthly) / fullYearly) * 100);
}
