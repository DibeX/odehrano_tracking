# Complete Setup Guide

This guide will walk you through setting up the Tabletop Game Tracking application from scratch.

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Supabase

### 2.1 Create a Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Fill in:
   - **Name**: tabletop-tracking (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is sufficient

### 2.2 Get API Credentials

1. Once the project is created, go to **Project Settings** (gear icon)
2. Click **API** in the sidebar
3. Copy these values (you'll need them):
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

### 2.3 Run Database Schema

1. In Supabase dashboard, click **SQL Editor** in the sidebar
2. Click **New Query**
3. Copy the entire content of `supabase-schema.sql` from this project
4. Paste it into the SQL editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see "Success. No rows returned"

### 2.4 Set Up Storage for Avatars

1. In Supabase dashboard, go to **Storage**
2. Click **Create a new bucket**
3. Name it: `avatars`
4. Set it as **Public bucket**
5. Click **Create bucket**
6. Click on the `avatars` bucket
7. Go to **Policies** tab
8. Click **New Policy** and add these policies:

   **Policy 1: Allow authenticated users to upload**
   ```sql
   CREATE POLICY "Authenticated users can upload avatars"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'avatars');
   ```

   **Policy 2: Allow public to read**
   ```sql
   CREATE POLICY "Anyone can view avatars"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'avatars');
   ```

   **Policy 3: Allow users to update their own avatars**
   ```sql
   CREATE POLICY "Users can update own avatars"
   ON storage.objects FOR UPDATE
   TO authenticated
   USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
   ```

### 2.5 Configure Email Authentication

1. Go to **Authentication** > **Providers**
2. Make sure **Email** is enabled (it should be by default)
3. Scroll down to **Email Templates**
4. Customize the templates if desired:
   - **Confirm signup**: Email sent when user sets password
   - **Magic Link**: Not used in this app
   - **Change Email Address**: When user changes email
   - **Reset Password**: Password reset email

5. Update the redirect URLs in each template to match your domain:
   - Development: `http://localhost:3000`
   - Production: `https://your-domain.vercel.app`

## Step 3: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
   VITE_APP_URL=http://localhost:3000
   ```

## Step 4: Set Up Lingui (Internationalization)

```bash
npm run extract
npm run compile
```

This will:
- Extract all translatable strings from your code
- Create translation files in `src/locales/`
- Compile them for use in the app

## Step 5: Create First Admin User

Since the app doesn't allow self-registration, you need to create the first admin user manually:

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to **Authentication** > **Users** in Supabase
2. Click **Add user** > **Create new user**
3. Fill in:
   - **Email**: your email
   - **Password**: choose a password
   - **Auto Confirm User**: Yes (check this box)
4. Click **Create user**
5. Go to **Table Editor** > **users** table
6. Find your user (it was auto-created by the trigger)
7. Click on the row to edit
8. Change **role** from `player` to `admin`
9. Update **nickname** if desired
10. Click **Save**

### Option 2: Via SQL

```sql
-- Insert into auth.users (this creates the authentication record)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'admin@example.com',
  crypt('your-password-here', gen_salt('bf')),
  NOW(),
  '{"nickname": "admin"}',
  NOW(),
  NOW()
);

-- Update the user role to admin
UPDATE users
SET role = 'admin'
WHERE email = 'admin@example.com';
```

## Step 6: Run the Development Server

```bash
npm run dev
```

The app should now be running at http://localhost:3000

## Step 7: Test the Application

1. Go to http://localhost:3000/login
2. Log in with your admin credentials
3. You should be redirected to the dashboard
4. Start building out the features!

## Step 8: Deploy to Vercel

### 8.1 Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/tabletop-tracking.git
git push -u origin main
```

### 8.2 Import to Vercel

1. Go to https://vercel.com
2. Click **New Project**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Other
   - **Build Command**: `npm run build`
   - **Output Directory**: `.output/public`
   - **Install Command**: `npm install`

### 8.3 Add Environment Variables in Vercel

1. In the project settings, go to **Environment Variables**
2. Add the same variables from your `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_URL` (use your Vercel domain, e.g., `https://your-app.vercel.app`)

### 8.4 Deploy

1. Click **Deploy**
2. Wait for the build to complete
3. Your app is now live!

### 8.5 Update Supabase Redirect URLs

1. Go back to Supabase dashboard
2. Go to **Authentication** > **URL Configuration**
3. Add your Vercel domain to **Site URL**: `https://your-app.vercel.app`
4. Add redirect URLs:
   - `https://your-app.vercel.app/**`
   - `https://your-app.vercel.app/auth/callback`

## Next Steps: Implementing Features

Now that the basic setup is complete, you'll need to implement the remaining features:

### Priority 1: Core Authentication
- [ ] Protected route middleware
- [ ] Invitation system (admin creates invitations)
- [ ] Password setup page for new users
- [ ] User profile management

### Priority 2: Game Management
- [ ] BGG game search and add interface
- [ ] Played games CRUD operations
- [ ] Player assignment to games
- [ ] Score and winner tracking
- [ ] Comments on games

### Priority 3: User Management
- [ ] Admin user management interface
- [ ] User invitation flow
- [ ] Avatar upload with crop
- [ ] Role management

### Priority 4: Rankings
- [ ] Ranking year management
- [ ] User ranking interface (drag-drop ordering)
- [ ] Lock/unlock years
- [ ] Deadline management
- [ ] Reminder system

### Priority 5: Results
- [ ] Ranking calculation implementation
- [ ] Results display with scheme selector
- [ ] Player contribution breakdown
- [ ] Export/share functionality

## Troubleshooting

### Database Connection Issues
- Verify your Supabase URL and anon key are correct
- Check that your Supabase project is active (not paused)
- Verify RLS policies are set up correctly

### Build Errors
- Make sure all dependencies are installed: `npm install`
- Clear the build cache: `rm -rf .vinxi .output`
- Check Node.js version (requires 18+)

### Authentication Issues
- Verify email templates in Supabase have correct redirect URLs
- Check that the first admin user was created correctly
- Verify RLS policies allow the operations you're trying to perform

### Environment Variables Not Working
- Make sure they start with `VITE_` prefix
- Restart the dev server after changing `.env`
- In Vercel, make sure to redeploy after adding environment variables

## Getting Help

- Check the main README.md for additional documentation
- Review Supabase docs: https://supabase.com/docs
- Review TanStack Start docs: https://tanstack.com/start
- Open an issue on GitHub if you encounter problems

## Security Notes

- Never commit your `.env` file
- Keep your Supabase service role key secret (only use anon key in frontend)
- Always use RLS policies for database security
- Use HTTPS in production
- Regularly update dependencies for security patches
