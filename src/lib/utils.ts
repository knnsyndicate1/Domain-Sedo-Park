/**
 * Format a currency value based on the currency code
 * @param amount - The amount to format
 * @param currency - Currency code (0: EUR, 1: USD, 2: GBP)
 * @returns Formatted currency string with symbol
 */
export function formatCurrency(amount: number, currency: number): string {
  const currencySymbol = currency === 0 ? '€' : currency === 1 ? '$' : '£';
  return `${currencySymbol}${amount.toLocaleString()}`;
} 