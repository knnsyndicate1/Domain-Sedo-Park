# Domain Register + Sedo Listing Tool: Implementation Flow

## 1. System Overview

This application provides a full-stack solution for domain registration via Namecheap API and Sedo domain listing. The system features:

- User authentication with Supabase
- Domain availability checking
- Real-time domain pricing from Namecheap API
- Domain registration through Namecheap
- Sedo listing support
- Domain status tracking

## 2. Tech Stack

- **Frontend**: Next.js 14+ (App Router), Ant Design v5, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **External APIs**: Namecheap API

## 3. Authentication Flow

1. User signs up/logs in through Supabase Auth
2. Session is stored and managed by Supabase
3. Protected routes redirect to login if no valid session exists
4. User ID from session is used to associate domains with specific users

## 4. API Endpoints

### Frontend API Routes

| Endpoint | Purpose |
|----------|---------|
| `/api/namecheap/price` | Check domain availability and get price |
| `/api/namecheap/register` | Register a domain through Namecheap |

### Namecheap API Commands

| Command | Purpose | Parameters |
|---------|---------|------------|
| `namecheap.domains.check` | Check domain availability | `DomainList={domain}` |
| `namecheap.users.getPricing` | Get domain registration price | `ProductType=DOMAIN`, `ProductCategory=DOMAINS`, `ProductName={tld}`, `ActionName=REGISTER` |
| `namecheap.domains.create` | Register a domain | `DomainName={domain}`, `Years=1`, `AddFreeWhoisguard=YES`, `WGEnabled=YES`, `AutoRenew=false`, `Nameservers={nameservers}` |

## 5. Price Checking Flow

1. **Frontend**: User enters domain name and clicks "Check Price"
   - Validates TLD (.shop or .click only)
   - Makes POST request to `/api/namecheap/price`

2. **Backend** (`/api/namecheap/price`):
   - Extracts domain from request body
   - Retrieves Namecheap API credentials from environment variables
   - Makes request to `namecheap.domains.check` to verify availability
   - If available, makes request to `namecheap.users.getPricing` to get price
   - Extracts price from XML response (focusing on 1-year registration)
   - Returns price and availability status to frontend

3. **Frontend**: Updates UI based on response
   - Shows price if available
   - Enables "Register" button if price < $2
   - Shows appropriate error messages if domain unavailable or price ≥ $2

## 6. Domain Registration Flow

1. **Frontend**: User clicks "Register" button for eligible domains
   - Form submit triggers `onRegister` function
   - Makes POST request to `/api/namecheap/register`

2. **Backend** (`/api/namecheap/register`):
   - Creates pending domain record in Supabase
   - Makes request to `namecheap.domains.create` with Sedo nameservers
   - Parses XML response to determine registration success
   - Updates domain status in Supabase database
   - Returns registration status to frontend

3. **Frontend**: Updates UI based on registration status
   - Shows success message if registered
   - Adds domain to domain list
   - Shows error message if registration failed

## 7. Domain Status Tracking

Domain status in database can be:
- `pending`: Registration in progress
- `registered`: Successfully registered
- `failed`: Registration failed

Additional flag `sedo_listed` tracks whether the domain has been listed on Sedo.

## 8. Sedo Listing Process

1. User clicks "Add to Sedo" for a registered domain
2. Application shows a modal with instructions for Sedo listing
3. After listing on Sedo, user clicks "Mark as Sedo Listed"
4. Application updates the domain record in Supabase

## 9. Error Handling

- API credential errors: Handled with appropriate error messages
- Domain availability: Clear messaging for unavailable domains
- Price constraints: Clear messaging when price ≥ $2
- API failures: Error messages with specific failure reasons
- XML parsing: Robust extraction with fallbacks for price data

## 10. Data Flow Diagram

```
User → Dashboard → Check Price → Namecheap API → Price Display → Register → Namecheap API → Sedo Listing
     ↑                                                                             ↓
     └─────────────────────────── Supabase Database ──────────────────────────────┘
```

## 11. Implementation Notes

- Price checking uses two-step process: first check availability, then get price
- Registration automatically sets Sedo parking nameservers
- Only domains < $2 can be registered (business rule enforcement)
- Only .shop and .click TLDs are supported (validation in UI)
- Real-time price data ensures accurate pricing information
- Session management ensures domains belong to authenticated users 