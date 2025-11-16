# Tabletop Game Tracking Application

A full-stack application for tracking and ranking tabletop games played within a gaming group.

## Features

### User Management

- **Role-based access control**: Admin, Moderator, and Player roles
- **Invitation system**: Admins can invite new users via email with expiring (14-day) single-use tokens
- **User profiles**: Nickname, email, avatar with crop functionality, and description
- **Authentication**: Login, password reset, and secure password setup for new users

### Game Management

- **BoardGameGeek integration**: Fetch game metadata via BGG XML API
- **Played games tracking**: Record game sessions with date, players, scores, winners, and notes
- **Custom naming**: Override game names while preserving original name in tooltips
- **Comments**: Users can comment on played game sessions

### Ranking System

- **Yearly rankings**: Players rank games played during each year
- **Manual additions**: Players can add games to their rankings even if not assigned to a session
- **Locked years**: Admins/Moderators can lock years to prevent further ranking changes
- **Deadline reminders**: Set deadlines for ranking submissions with automatic reminders
- **Privacy controls**: Rankings can be kept private or made public by Admins/Moderators

### Results & Analytics

Three ranking calculation schemes:

- **Scheme A (Equal)**: One person = one vote (w_p = 1)
- **Scheme B (Damped)**: Weight by √(games played) - recommended compromise
- **Scheme C (Linear)**: Weight by games played (w_p = np)

Advanced tie-breaking:

1. Higher first-place votes
2. Higher top-2 placements
3. Head-to-head comparison among overlapping voters
4. Alphabetical fallback

## Tech Stack

### Frontend

- **React 18** with TypeScript
- **TanStack Start** (full-stack React framework)
- **TanStack Router** for routing
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **Lingui** for internationalization

### Backend

- **Supabase** for:
  - PostgreSQL database
  - Authentication (Supabase Auth)
  - Row Level Security (RLS)
  - Real-time subscriptions (optional)
  - Storage (for avatars)

### External APIs

- **BoardGameGeek XML API v2** for game metadata

### Deployment

- **Vercel** for hosting (free tier)

## Project Structure

```
tabletop-tracking/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── layout/          # Layout components
│   │   └── features/        # Feature-specific components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Library configurations
│   ├── locales/             # Translation files
│   ├── routes/              # TanStack Router routes
│   ├── services/            # API services
│   ├── styles/              # Global styles
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions
│   ├── entry-client.tsx     # Client entry point
│   ├── entry-server.tsx     # Server entry point
│   └── router.tsx           # Router configuration
├── supabase-schema.sql      # Database schema
├── app.config.ts            # TanStack Start config
├── tailwind.config.js       # Tailwind configuration
├── tsconfig.json            # TypeScript configuration
├── lingui.config.ts         # Lingui i18n configuration
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account (free tier)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd tabletop-tracking
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new Supabase project at https://supabase.com
   - Go to Project Settings > API to get your URL and anon key
   - Run the SQL from `supabase-schema.sql` in the Supabase SQL Editor
   - Enable Email authentication in Authentication > Providers

4. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Supabase credentials:

   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_APP_URL=http://localhost:3000
   ```

5. **Set up Supabase Storage for avatars**
   - Go to Storage in Supabase dashboard
   - Create a new public bucket named `avatars`
   - Set up policies to allow authenticated users to upload

6. **Extract and compile translations**

   ```bash
   npm run extract
   npm run compile
   ```

7. **Run the development server**

   ```bash
   npm run dev
   ```

8. **Create the first admin user**
   - You'll need to manually create the first admin user in Supabase
   - Go to Authentication > Users in Supabase dashboard
   - Click "Add user" > "Create new user"
   - After creating, go to Table Editor > users
   - Update the user's role to 'admin'

## Deployment

### Deploy to Vercel

1. **Push your code to GitHub**

2. **Import project in Vercel**
   - Go to https://vercel.com
   - Click "New Project"
   - Import your GitHub repository

3. **Configure environment variables**
   - Add the same environment variables from your `.env` file
   - Update `VITE_APP_URL` to your Vercel domain

4. **Deploy**
   - Vercel will automatically build and deploy
   - Update Supabase redirect URLs in Authentication settings

## Database Schema

### Tables

- **users**: User profiles with roles
- **user_invitations**: Invitation tokens for new users
- **board_games**: Game metadata from BGG
- **played_games**: Game session records
- **played_game_players**: Players in each session
- **played_game_comments**: Comments on game sessions
- **ranking_years**: Year configuration for rankings
- **user_game_rankings**: User rankings per game per year

### Row Level Security

All tables have RLS policies configured:

- Players can view public data and manage their own content
- Moderators can manage games and rankings
- Admins have full access

## Development

### Code Style

- Use named functions instead of arrow functions where possible
- All imports use `@/` alias pointing to `src/`
- TypeScript strict mode enabled
- Follow React best practices

### Adding Translations

1. Wrap text with Lingui macros:

   ```tsx
   import { Trans } from "@lingui/react/macro";
   <Trans>Hello World</Trans>;
   ```

2. Extract messages:

   ```bash
   npm run extract
   ```

3. Translate in `src/locales/{locale}/messages.po`

4. Compile:
   ```bash
   npm run compile
   ```

### Adding New Components

- UI components go in `src/components/ui/`
- Feature components go in `src/components/features/`
- Follow shadcn/ui patterns for consistency

## API Integration

### BoardGameGeek API

The app uses BGG XML API v2:

- Fetch game by ID: `https://boardgamegeek.com/xmlapi2/thing?id={id}&stats=1`
- Search games: `https://boardgamegeek.com/xmlapi2/search?query={query}&type=boardgame`

API service located in `src/services/bgg-api.ts`

## Ranking Calculation

The ranking engine (`src/services/ranking-calculator.ts`) implements three weighted voting schemes:

**Common calculations per player:**

- `raw_points_p(r) = np − r + 1` (where np = total games ranked by player)
- `S_p = np*(np+1)/2`
- `base_fraction_p(r) = raw_points_p(r) / S_p`

**Scheme A (Equal):**

- `w_p = 1`
- `contribution = base_fraction * 1`

**Scheme B (Damped - Recommended):**

- `w_p = √np`
- `contribution = base_fraction * √np`

**Scheme C (Linear):**

- `w_p = np`
- `contribution = base_fraction * np`

Final score is sum of all contributions, normalized by total weight.

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

[Your chosen license]

## Support

For issues and questions, please open a GitHub issue.
