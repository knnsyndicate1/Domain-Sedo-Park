# Domain Registration & Sedo Listing Application

## Overview
A comprehensive web application for registering domains through Namecheap and automatically listing them on the Sedo marketplace. The application provides a streamlined workflow for domain management, from registration to marketplace listing, with a user-friendly interface.

## Tech Stack
- **Frontend**: Next.js 13+ with App Router, React, TypeScript
- **UI Components**: Ant Design (antd)
- **Styling**: TailwindCSS
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **API Integrations**: Namecheap API, Sedo API
- **State Management**: React Hooks

## Features
- User authentication (register, login, logout)
- Domain name search and availability check
- Automated domain registration through Namecheap
- One-click listing of domains on Sedo marketplace
- Search functionality for Sedo-listed domains
- Responsive design for all device sizes

## Application Flow

### Authentication Flow
1. Users register or login through the authentication pages
2. Authentication is handled by Supabase Auth
3. Session management ensures protected routes

### Domain Registration Flow
1. User enters a domain name in the dashboard
2. System checks domain availability and price through Namecheap API
3. If available and under price threshold ($2.00), user can register the domain
4. Registration process:
   - Domain is marked as "pending" in the database
   - Namecheap API is called to register the domain
   - Database is updated with registration status

### Sedo Listing Flow
1. Registered domains appear in the dashboard under "Domains Needing Action"
2. User clicks "Auto-List on Sedo" for a specific domain
3. Domain is submitted to Sedo API for listing
4. Upon successful listing:
   - Domain is marked as "listed" in the database
   - Domain is removed from the dashboard view
   - Domain becomes searchable in the Search Listed Domains page

### Search Flow
1. User navigates to the Search Listed Domains page
2. User enters keywords to search their Sedo-listed domains
3. Results are filtered in real-time using debounced search
4. Only domains that are both registered AND successfully listed on Sedo appear in search results

## File Structure

```
src/
├── app/                      # Next.js 13+ App Router
│   ├── dashboard/            # Dashboard page for domain management
│   ├── login/                # Login page
│   ├── register/             # Registration page
│   ├── search-domain/        # Search page for listed domains
│   └── page.tsx              # Home page
├── components/               # Shared React components
├── lib/                      # Utility libraries and API wrappers
│   ├── namecheap-api.ts      # Namecheap API integration
│   ├── sedo-api.ts           # Sedo API integration
│   ├── sedo-config.ts        # Sedo API configuration
│   ├── supabase.ts           # Supabase client initialization
│   └── types.ts              # TypeScript type definitions
└── api/                      # API route handlers
    ├── namecheap/            # Namecheap API routes
    └── sedo/                 # Sedo API routes
```

## Key Components

### Page Components

#### Home Page (`src/app/page.tsx`)
- Landing page with information about the application
- Links to login and registration

#### Dashboard (`src/app/dashboard/page.tsx`)
- Central hub for domain management
- Features:
  - Domain registration form
  - Price checking functionality
  - List of domains needing action
  - Auto-list functionality for Sedo

#### Search Page (`src/app/search-domain/page.tsx`)
- Search interface for finding domains listed on Sedo
- Features:
  - Autocomplete search with debounce
  - Real-time results filtering
  - Domain details display

### API Integrations

#### Namecheap API (`src/lib/namecheap-api.ts`)
- Handles domain availability checking
- Processes domain registration
- Manages nameserver configuration

#### Sedo API (`src/lib/sedo-api.ts`)
- Lists domains on Sedo marketplace
- Searches for user's domains in Sedo account
- Includes fallback simulation for testing

## Database Schema

### Users Table
- Managed by Supabase Auth

### Domains Table
```sql
CREATE TABLE domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  domain TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  sedo_listed BOOLEAN DEFAULT FALSE,
  nameservers TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## User Experience Flow

1. **New User**:
   - Registers an account
   - Lands on dashboard
   - Searches for domain names
   - Registers domains
   - Lists domains on Sedo
   - Searches for listed domains

2. **Existing User**:
   - Logs in
   - Views dashboard with domains needing action
   - Lists domains on Sedo
   - Searches for existing listed domains

## Special Features

### Automatic Dashboard Filtering
- Once domains are successfully listed on Sedo, they're automatically removed from the dashboard view
- This keeps the dashboard focused only on domains that need action

### Debounced Search
- Search functionality uses debouncing to prevent excessive API calls
- Provides a smoother user experience during search

### Simulated API for Development
- Fallback simulation for Sedo API when credentials are unavailable
- Enables testing without actual API credentials

## Deployment

### Prerequisites
- Namecheap API credentials
- Sedo API credentials
- Supabase project

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

NAMECHEAP_API_USER=your_namecheap_username
NAMECHEAP_API_KEY=your_namecheap_api_key
NAMECHEAP_CLIENT_IP=your_client_ip

SEDO_USERNAME=your_sedo_username
SEDO_PASSWORD=your_sedo_password
```

### Deployment Steps
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Build the application: `npm run build`
5. Start the server: `npm start`

## Future Enhancements
- Domain portfolio analytics
- Bulk domain operations
- Integration with additional domain registrars
- Advanced Sedo listing options
- Domain appraisal integration 