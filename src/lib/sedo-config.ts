// Configuration for Sedo API
// These should be moved to environment variables in production

export const SEDO_CONFIG = {
  PARTNER_ID: process.env.NEXT_PUBLIC_SEDO_PARTNER_ID || '332452',
  SIGN_KEY: process.env.NEXT_PUBLIC_SEDO_SIGN_KEY || 'b91f975a0626c20aa3b5f6e23d50e6',
  API_URL: 'https://api.sedo.com/api/v1/DomainInsert',
  DEFAULT_PRICE: 999, // Default price in USD
  DEFAULT_LANGUAGE: 'en', // English language
  DEFAULT_CURRENCY: 1, // 1 = USD
  DEFAULT_CATEGORIES: [1008], // Miscellaneous category (ID: 1008)
}; 