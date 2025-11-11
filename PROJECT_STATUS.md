# Project Status

This document tracks what has been completed and what still needs to be implemented.

## ✅ Completed

### Project Setup
- [x] Git repository initialized
- [x] TanStack Start project structure
- [x] TypeScript configuration
- [x] Tailwind CSS setup
- [x] PostCSS configuration
- [x] Package.json with all dependencies
- [x] Environment variables template
- [x] .gitignore configuration

### Database & Backend
- [x] Complete database schema (supabase-schema.sql)
  - All 8 tables with proper relationships
  - Row Level Security (RLS) policies
  - Indexes for performance
  - Triggers for updated_at columns
  - User role enum
- [x] Supabase client configuration
- [x] TypeScript type definitions for all tables
- [x] Database type exports

### Authentication
- [x] useAuth hook with full functionality
  - Sign in / Sign out
  - Password reset
  - Password update
  - Role checking (isAdmin, isModerator, hasRole)
  - User profile fetching
- [x] Login page with password reset flow
- [x] Supabase Auth integration

### UI Components (shadcn/ui)
- [x] Button component
- [x] Input component
- [x] Label component
- [x] Card components (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter)
- [x] Avatar components (Avatar, AvatarImage, AvatarFallback)

### Services
- [x] BoardGameGeek API integration (bgg-api.ts)
  - Fetch game by ID
  - Search games
  - XML parsing
  - Complete metadata extraction
- [x] Ranking calculation engine (ranking-calculator.ts)
  - All 3 schemes (Equal, Damped, Linear)
  - Tie-breaking logic
  - Player contribution tracking
  - Normalization

### Utilities
- [x] cn() utility for class merging
- [x] Date formatting functions
- [x] Token generation
- [x] Expiration date calculation

### Internationalization
- [x] Lingui configuration
- [x] Locale folders structure (en, cs)
- [x] Extract and compile scripts

### Documentation
- [x] Comprehensive README.md
- [x] Detailed SETUP_GUIDE.md
- [x] PROJECT_STATUS.md (this file)

### Deployment
- [x] Vercel configuration (vercel.json)
- [x] App config for Vercel preset

## 🚧 To Be Implemented

### Routes & Pages
- [ ] Protected route middleware (check auth before rendering)
- [ ] Dashboard page (main landing after login)
- [ ] User profile page
- [ ] User management pages (admin)
  - [ ] User list
  - [ ] Create invitation
  - [ ] Manage users
- [ ] Games pages
  - [ ] List all played games
  - [ ] Add new played game
  - [ ] Edit played game
  - [ ] Game details view
- [ ] Rankings pages
  - [ ] My rankings page (current user)
  - [ ] Ranking management (admin/moderator)
  - [ ] Year configuration
- [ ] Results page
  - [ ] Scheme selector
  - [ ] Rankings display
  - [ ] Player contributions

### UI Components (Still Needed)
- [ ] Dialog/Modal component
- [ ] Select component (for dropdowns)
- [ ] Dropdown menu component
- [ ] Tabs component
- [ ] Toast/notification component
- [ ] Tooltip component
- [ ] Table component (for data display)
- [ ] Form components (Textarea, Checkbox, etc.)
- [ ] Loading spinner/skeleton

### Features

#### User Management
- [ ] Admin dashboard for user management
- [ ] Create user invitation form
- [ ] Send invitation email
- [ ] Invitation acceptance page
- [ ] Password setup for new users
- [ ] User profile edit
- [ ] Avatar upload with crop functionality
- [ ] User role management

#### Game Management
- [ ] BGG game search interface
- [ ] Add game from BGG ID
- [ ] Create played game session
- [ ] Assign players to session
- [ ] Record scores and winner
- [ ] Add custom name for game
- [ ] Edit played game
- [ ] Delete played game
- [ ] Comments on played games
- [ ] Game history view

#### Rankings
- [ ] Year management (create/edit/lock/unlock)
- [ ] User ranking interface
  - [ ] List of games played in year
  - [ ] Drag-and-drop ordering
  - [ ] Manual game addition
  - [ ] Save rankings
- [ ] Deadline management
- [ ] Reminder system (email notifications)
- [ ] Lock/unlock years functionality

#### Results & Analytics
- [ ] Results page with scheme selector
- [ ] Display ranked games with scores
- [ ] Show player contributions per game
- [ ] Filtering (by year, by player)
- [ ] Export functionality (CSV, PDF)
- [ ] Share results

#### Storage
- [ ] Avatar upload to Supabase Storage
- [ ] Image processing (crop, resize)
- [ ] File validation

### Testing
- [ ] Unit tests for ranking calculator
- [ ] Unit tests for BGG API service
- [ ] Integration tests for auth flow
- [ ] E2E tests for critical paths

### Enhancements
- [ ] Real-time updates (Supabase subscriptions)
- [ ] Dark mode toggle
- [ ] Responsive design improvements
- [ ] Loading states
- [ ] Error boundaries
- [ ] Accessibility improvements (ARIA labels, keyboard navigation)
- [ ] SEO optimization
- [ ] Performance optimization

### Internationalization
- [ ] Extract all translatable strings
- [ ] Translate to Czech (cs)
- [ ] Language switcher component
- [ ] i18n for dates, numbers

## 📋 Implementation Priority

### Phase 1: Core Functionality (MVP)
1. Protected routes middleware
2. Dashboard with basic navigation
3. User invitation flow (create, send, accept)
4. User profile management
5. BGG game integration UI
6. Create/edit played games
7. Basic rankings interface

### Phase 2: Rankings System
1. Year management
2. User ranking interface with ordering
3. Lock/unlock functionality
4. Results display with all 3 schemes

### Phase 3: Polish & Features
1. Comments on games
2. Avatar upload with crop
3. Deadline reminders
4. Advanced filtering
5. Export functionality

### Phase 4: Quality & Performance
1. Testing suite
2. Error handling improvements
3. Loading states
4. Accessibility audit
5. Performance optimization

## 🔧 Known Issues

1. **Node version warning**: Project requires Node 20.19.0+ but works on 20.18.2
   - Not critical, but should upgrade Node.js
2. **npm audit warnings**: 11 vulnerabilities detected
   - Need to review and fix with `npm audit fix`
3. **TanStack Router**: Need to generate routeTree.gen.ts
   - Will be auto-generated when dev server starts

## 📝 Notes for Development

### Before Starting Development
1. Follow SETUP_GUIDE.md to configure Supabase
2. Create `.env` file with Supabase credentials
3. Run database schema in Supabase SQL editor
4. Create first admin user manually
5. Run `npm run dev` to start development server

### Development Workflow
1. Create new routes in `src/routes/`
2. Create components in `src/components/`
3. Use `useAuth()` hook for authentication checks
4. Use Supabase client from `src/lib/supabase.ts`
5. Follow TypeScript types from `src/types/`

### Code Standards
- Use named functions over arrow functions
- Use `@/` imports for src directory
- Follow shadcn/ui patterns for components
- Add Lingui translations with `<Trans>` macro
- Type everything with TypeScript

## 🎯 Next Steps

**Immediate action items:**
1. Generate route tree: Start dev server to auto-generate
2. Implement protected route middleware
3. Create basic layout component with navigation
4. Build out the dashboard page
5. Implement user invitation flow

## 📚 Resources

- [TanStack Start Docs](https://tanstack.com/start)
- [TanStack Router Docs](https://tanstack.com/router)
- [Supabase Docs](https://supabase.com/docs)
- [shadcn/ui Docs](https://ui.shadcn.com)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Lingui Docs](https://lingui.dev)
- [BoardGameGeek API Docs](https://boardgamegeek.com/wiki/page/BGG_XML_API2)

## Questions or Issues?

Refer to SETUP_GUIDE.md for detailed setup instructions and troubleshooting.
