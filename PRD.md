# Domain Register + Sedo Listing Automation Tool - PRD

## 1. Product Overview
A full-stack application that automates domain registration through Namecheap API and facilitates Sedo listing, with user authentication and domain management capabilities.

## 2. Target Users
- Domain investors
- Domain flippers
- Small business owners looking to register domains

## 3. Core Features

### 3.1 Authentication System
- Email/password based registration
- Supabase Auth integration
- Protected routes for authenticated users
- Session management
- Social login options (optional)

### 3.2 Domain Registration
- Domain name input with validation
- TLD restriction (.shop and .click only)
- Price validation (< $2)
- Namecheap API integration
- Custom nameserver configuration
- Auto-renewal settings

### 3.3 Sedo Integration
- Nameserver configuration for Sedo parking
- Manual listing instructions
- Optional Puppeteer automation for listing

### 3.4 Dashboard
- Domain management interface
- Registration status tracking
- Listing status monitoring
- Retry mechanisms for failed operations

## 4. Technical Specifications

### 4.1 Frontend
- Next.js 14+ (App Router)
- Ant Design v5
- TypeScript
- React Query for data fetching
- Zustand for state management
- Tailwind CSS for custom styling
- Responsive design
- Loading states
- Error handling
- Form validation

### 4.2 Backend
- Next.js API Routes
- Supabase
  - Authentication
  - PostgreSQL Database
  - Real-time subscriptions
  - Row Level Security (RLS)
  - Storage for files
- Namecheap API integration
- Optional Puppeteer automation
- Error handling
- Logging

### 4.3 Database Schema (Supabase)
```sql
-- Users table (handled by Supabase Auth)
auth.users

-- Domains table
domains (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id),
  domain_name text not null,
  registration_date timestamp with time zone,
  expiry_date timestamp with time zone,
  price decimal(10,2),
  status text check (status in ('pending', 'registered', 'failed', 'listed')),
  sedo_listed boolean default false,
  nameservers jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table domains enable row level security;

-- Create policies
create policy "Users can view their own domains"
  on domains for select
  using (auth.uid() = user_id);

create policy "Users can insert their own domains"
  on domains for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own domains"
  on domains for update
  using (auth.uid() = user_id);
```

## 5. API Endpoints

### 5.1 Authentication (Supabase)
- POST /auth/signup
- POST /auth/signin
- POST /auth/signout
- GET /auth/user

### 5.2 Domains
- POST /api/domains/register
- GET /api/domains
- GET /api/domains/:id
- POST /api/domains/:id/sedo

## 6. Security Requirements
- Supabase Auth security
- Row Level Security (RLS)
- API key protection
- Rate limiting
- Input validation
- XSS protection
- CORS configuration

## 7. Performance Requirements
- Page load time < 2s
- API response time < 1s
- 99.9% uptime
- Support for concurrent users

## 8. Deployment
- Frontend: Vercel
- Backend: Vercel (Next.js API Routes)
- Database: Supabase
- Environment variables for configuration

## 9. Monitoring and Logging
- Vercel Analytics
- Supabase Dashboard
- Error tracking
- Performance monitoring
- User activity logs
- API usage metrics

## 10. Future Enhancements
- Additional TLD support
- Bulk domain registration
- Advanced pricing analytics
- Automated Sedo listing
- Email notifications
- Domain transfer capabilities
- Real-time domain status updates 