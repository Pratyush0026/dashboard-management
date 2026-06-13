# TalenTrack Admin Dashboard

An admin dashboard for managing candidate data with AI-powered insights.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in your credentials
2. Run `npm install`
3. Run `npm run dev`

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `DIRECT_URL` - Direct PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `GEMINI_API_KEY` - Google Gemini API key for AI features
