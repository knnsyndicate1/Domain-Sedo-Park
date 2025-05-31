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
  nameservers?: string
}

/**
 * User profile data
 */
export type Profile = {
  id: string
  email: string
  created_at: string
}

/**
 * Namecheap API response type for price checking
 */
export type PriceCheckResponse = {
  price: number | null
  available: boolean
  message?: string
  error?: string
}

/**
 * Namecheap API response type for domain registration
 */
export type RegistrationResponse = {
  status: 'registered' | 'pending' | 'failed'
  message?: string
  error?: string
}

/**
 * Registration form data
 */
export type RegistrationFormData = {
  firstName: string
  lastName: string
  email: string
  phone: string
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
 */
export type EnvVars = {
  // Placeholder type for documentation purposes only
} 