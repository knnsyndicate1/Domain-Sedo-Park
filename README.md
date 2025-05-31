# Domain Register + Sedo Listing Automation Tool

A full-stack application that automates domain registration through Namecheap API and facilitates Sedo listing with automatic nameserver configuration.

## Redeployed with authentication fix

## Features

- User authentication with Supabase (special handling for @knnsyndicate.com emails)
- Domain checking and price validation (only .shop and .click under $2)
- Automatic domain registration with Namecheap API
- Sedo nameserver configuration during registration
- Sedo API integration for direct domain listing
- Dashboard for domain management
- IP detection for Namecheap API whitelisting compliance

## Tech Stack

- Next.js 14 App Router
- Ant Design + Tailwind CSS
- Supabase (Auth & Database)
- TypeScript
- Namecheap API
- Sedo API

## Complete Setup Instructions

### 1. Prerequisites

- Node.js 18+ and npm
- Namecheap API access (sandbox or production)
- Supabase account
- Sedo account (for domain parking/listing)

### 2. Repository Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### 3. Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Create the `domains` table with the following schema:
   ```sql
   CREATE TABLE domains (
     id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) NOT NULL,
     domain TEXT NOT NULL,
     status TEXT DEFAULT 'pending',
     sedo_listed BOOLEAN DEFAULT false,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
     nameservers TEXT
   );
   ```

3. Create the auto-verification trigger for @knnsyndicate.com emails:
   ```sql
   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS TRIGGER AS $$
   BEGIN
     -- Auto-verify if the email ends with @knnsyndicate.com
     IF NEW.email LIKE '%@knnsyndicate.com' THEN
       UPDATE auth.users SET email_confirmed_at = now() WHERE id = NEW.id;
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
   ```

4. Enable Email authentication in Supabase Auth settings

### 4. Namecheap API Configuration

1. Sign up for Namecheap API access at [namecheap.com/support/api](https://www.namecheap.com/support/api/intro/)
2. Add your server's IP address to the API whitelist in your Namecheap account settings
3. Get your API Key, Username, and Client IP

### 5. Environment Variables

Create a `.env.local` file in the root directory with:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Namecheap API
NAMECHEAP_USERNAME=your_namecheap_username
NAMECHEAP_API_KEY=your_namecheap_api_key
NAMECHEAP_CLIENT_IP=your_whitelisted_ip_address

# Sedo API
NEXT_PUBLIC_SEDO_PARTNER_ID=your_sedo_partner_id
NEXT_PUBLIC_SEDO_SIGN_KEY=your_sedo_sign_key

# Whois Information (Required for successful registration)
WHOIS_FIRST_NAME=John
WHOIS_LAST_NAME=Doe
WHOIS_ADDRESS=123 Main St
WHOIS_CITY=New York
WHOIS_STATE=NY
WHOIS_POSTAL_CODE=10001
WHOIS_COUNTRY=US
WHOIS_PHONE=+1.5555555555
WHOIS_EMAIL=contact@yourdomain.com
```

### 6. Launch the Application

Development mode:
```bash
npm run dev
```

Production build:
```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/                   # Next.js app directory
│   ├── api/              # API routes
│   │   ├── namecheap/    # Namecheap API endpoints
│   │   │   ├── price/    # Domain price checking
│   │   │   └── register/ # Domain registration
│   │   └── sedo/         # Sedo API endpoints
│   │       └── list/     # Domain listing on Sedo
│   ├── login/            # Login page
│   ├── register/         # Registration page
│   ├── dashboard/        # Dashboard page
│   └── layout.tsx        # Root layout
├── lib/                  # Utility functions
│   ├── supabase.ts       # Supabase client
│   ├── sedo-api.ts       # Sedo API integration
│   └── sedo-config.ts    # Sedo API configuration
└── components/           # Reusable components
```

## Usage Instructions

1. **Login/Register**: Use email authentication (users with @knnsyndicate.com email are auto-verified)
2. **Check Domain**: Enter a .shop or .click domain and check its price
3. **Register Domain**: If the price is under $2, you can register the domain
4. **Sedo Listing**: After registration, domains appear in the dashboard where you can:
   - View registration status
   - Use automatic Sedo API listing
   - Access manual instructions to list on Sedo
   - Mark domains as listed on Sedo

## Sedo API Integration

This application uses the Sedo DomainInsert API to automatically list domains:

1. Configure your Sedo API credentials in the `.env.local` file
2. When a domain is registered, it can be automatically listed on Sedo via the API
3. Enter your Sedo account credentials when prompted to authorize the listing
4. The API will list the domain with default settings (price: $999 USD, category: Miscellaneous)
5. You can later update the listing details in your Sedo account

For more information about the Sedo API, visit the [official documentation](https://api.sedo.com/apidocs/v1/Basic/functions/sedoapi_DomainInsert.html).

## Troubleshooting

- If domain registration shows "pending" status, check that all Whois fields are correctly configured
- For Namecheap API connection issues, verify your IP is correctly whitelisted
- Ensure your Namecheap account has sufficient funds for domain registration

## Deployment

This application is designed to be deployed on Vercel. Simply connect your GitHub repository to Vercel and configure the environment variables. 