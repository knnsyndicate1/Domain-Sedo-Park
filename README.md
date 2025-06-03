# Domain Registration & Management Tool

A Next.js and Supabase application for domain registration and management with admin approval workflow.

## Features

- User registration with admin approval
- Domain search and registration
- Admin dashboard for user management
- Secure authentication using Supabase
- Edge Functions for advanced operations

## Technology Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Ant Design
- **Backend**: Supabase (Authentication, Database, Edge Functions)
- **Deployment**: Vercel

## Setup Instructions

1. Clone the repository:
   ```
   git clone https://github.com/knnsyndicate1/Domain-Sedo-Tool.git
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env.local` file with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. Run the development server:
   ```
   npm run dev
   ```

5. For production build:
   ```
   npm run build
   npm run start
   ```

## Supabase Edge Functions

For deploying Edge Functions:

1. Install Supabase CLI
2. Link to your Supabase project
3. Deploy using `supabase functions deploy delete-user`

## License

MIT 