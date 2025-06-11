/**
 * Domain object type used throughout the application
 */
export type Domain = {
  id: string
  user_id: string
  domain: string
  status: string
  sedo_listed: boolean
  created_at: string
  nameservers?: string // Contains nameserver information, typically 'ns1.sedopark.net, ns2.sedopark.net' for Sedo
  registration_date?: string
  expiry_date?: string
}

/**
 * Namecheap API response type for domain registration
 */
export type RegistrationResponse = {
  status: 'registered' | 'pending' | 'failed'
  message?: string
  domain?: string
  nameservers?: string // Contains nameserver information from the registration API
  error?: string
}

/**
 * Environment variables required for the application
 * 
 * These should be defined in your .env.local file:
 * 
 * # Supabase
 * NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
 * NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
 * 
 * # Namecheap API
 * NAMECHEAP_USERNAME=your_namecheap_username
 * NAMECHEAP_API_KEY=your_namecheap_api_key
 * NAMECHEAP_CLIENT_IP=your_whitelisted_ip_address
 * 
 * # Whois Information
 * WHOIS_FIRST_NAME=John
 * WHOIS_LAST_NAME=Doe
 * WHOIS_ADDRESS=123 Main St
 * WHOIS_CITY=New York
 * WHOIS_STATE=NY
 * WHOIS_POSTAL_CODE=10001
 * WHOIS_COUNTRY=US
 * WHOIS_PHONE=+1.5555555555
 * WHOIS_EMAIL=contact@yourdomain.com
 * 
 * # Sedo API
 * SEDO_USERNAME=your_sedo_username
 * SEDO_PASSWORD=your_sedo_password
 * SEDO_PARTNER_ID=your_sedo_partner_id
 * SEDO_SIGN_KEY=your_sedo_sign_key
 */
export type EnvVars = {
  // Placeholder type for documentation purposes only
} 