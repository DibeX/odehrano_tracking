# Quick Start Guide

Get the tabletop-tracking app running in 5 minutes!

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] npm installed
- [ ] Supabase account created

## 5-Minute Setup

### 1. Install Dependencies (1 min)

```bash
npm install
```

### 2. Create Supabase Project (2 min)

1. Go to https://supabase.com → "New Project"
2. Name: `tabletop-tracking`
3. Choose a password and region
4. Wait for project to be ready (~2 minutes)

### 3. Configure Environment (30 sec)

```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_APP_URL=http://localhost:3000
```

Get these from: Supabase Dashboard → Settings → API

### 4. Set Up Database (1 min)

1. Supabase Dashboard → SQL Editor → New Query
2. Copy entire content of `supabase-schema.sql`
3. Paste and click "Run"
4. You should see "Success. No rows returned"

### 5. Create Admin User (30 sec)

In Supabase Dashboard:
1. Authentication → Users → Add User
2. Email: your email
3. Password: choose a password
4. ✅ Check "Auto Confirm User"
5. Click "Create user"

Then:
1. Table Editor → users table
2. Find your user row
3. Change role from `player` to `admin`
4. Save

### 6. Start Development Server (30 sec)

```bash
npm run dev
```

### 7. Test It Out!

1. Open http://localhost:3000/login
2. Login with your admin credentials
3. You should be redirected to the dashboard!

## What's Next?

Now you're ready to develop! Check out:

- [PROJECT_STATUS.md](PROJECT_STATUS.md) - See what's implemented and what's next
- [SETUP_GUIDE.md](SETUP_GUIDE.md) - Detailed setup instructions
- [README.md](README.md) - Full documentation

## Common Issues

**Build errors?**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Can't connect to Supabase?**
- Double-check your `.env` file
- Verify the Supabase URL and anon key
- Make sure your Supabase project is active (not paused)

**Login not working?**
- Make sure you ran the database schema SQL
- Verify the admin user exists in Supabase
- Check the user role is set to 'admin'

**Node version warnings?**
- These are warnings, not errors
- The app should still work fine
- Consider upgrading to Node 20.19.0+ to remove warnings

## Development Workflow

1. **Start dev server**: `npm run dev`
2. **Make changes**: Edit files in `src/`
3. **Hot reload**: Changes appear automatically
4. **Check types**: `npm run type-check`

## Project Structure Quick Reference

```
src/
├── components/
│   ├── ui/           # Reusable UI components
│   ├── layout/       # Layout components (Header, Sidebar, etc.)
│   └── features/     # Feature-specific components
├── routes/           # Pages (TanStack Router)
├── hooks/            # Custom React hooks (useAuth, etc.)
├── services/         # API services (BGG, rankings)
├── lib/              # Config (Supabase, utils)
├── types/            # TypeScript types
└── styles/           # Global styles
```

## Key Files

- `src/hooks/use-auth.ts` - Authentication logic
- `src/lib/supabase.ts` - Supabase client
- `src/services/bgg-api.ts` - BoardGameGeek API
- `src/services/ranking-calculator.ts` - Ranking algorithms
- `supabase-schema.sql` - Complete database schema

## Ready to Build!

You now have:
- ✅ Complete database with RLS policies
- ✅ Authentication system
- ✅ BoardGameGeek API integration
- ✅ Ranking calculation engine
- ✅ UI component library
- ✅ Admin user created

Start building features! See PROJECT_STATUS.md for what to implement next.

## Need Help?

- Check SETUP_GUIDE.md for detailed troubleshooting
- Review the code comments for implementation details
- All services are documented with JSDoc comments
