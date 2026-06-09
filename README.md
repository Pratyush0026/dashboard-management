# TalenTrack — Candidate Management Dashboard

A production-ready admin dashboard for managing candidates, importing Excel data, and getting AI-powered recruiting insights.

## Features

- **Excel Import** — Drag & drop `.xlsx`/`.xls` files; duplicate emails are automatically skipped
- **Candidate Table** — Search, filter by status/position/location with real-time debounced queries
- **AI Insights Chat** — Ask questions in plain English; chat history persists across sessions
- **Secure Auth** — JWT-based auth with bcrypt password hashing

## Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4
- **Backend**: Next.js API routes
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4o-mini
- **Auth**: JWT + bcrypt

## Setup

### 1. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Auth — generate a strong random secret
JWT_SECRET=your-very-strong-random-secret-min-32-chars

# OpenAI (optional — AI chat won't work without this)
OPENAI_API_KEY=sk-...

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email (optional — password reset)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=user@example.com
EMAIL_PASS=your-password
EMAIL_FROM=noreply@yourdomain.com
```

### 2. Database

Run `lib/supabase/setup.sql` in your Supabase SQL editor.

### 3. Run

```bash
npm install
npm run dev
```

## Excel Import Format

Required columns: `name`, `email`, `position_applied`

Optional: `phone`, `education`, `experience_years`, `skills`, `salary_expectation`, `location`, `status` (Applied/Interviewing/Offer/Rejected)
