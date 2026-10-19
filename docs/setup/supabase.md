# Set up Supabase (free) - about 10 minutes

Menu names below were written in Oct 2026; if Supabase renamed something, look for the closest match.

1. Go to supabase.com -> sign up (free) -> **New project**.
   - Name: `sticker-vault` · Region: **Southeast Asia (Singapore)** · set a database password and keep it safe.
2. Left menu -> **SQL Editor** -> **New query** -> paste everything from `supabase/migrations/001_init.sql` -> **Run**.
   Expected: "Success. No rows returned".
3. Left menu -> **Authentication** -> **Users** -> **Add user** -> **Create new user** -> your email,
   tick **Auto Confirm User**. (No password needed for the app - it uses an email code.)
4. **Authentication** -> **Sign In / Providers** (or **Providers -> Email**) -> turn **off** "Allow new users to sign up".
   This makes you the only person who can log in.
5. **Authentication** -> **Email Templates** -> **Magic Link** -> make sure the message contains `{{ .Token }}`
   (the 6-digit code). Example body: `Your Sticker Vault code is {{ .Token }}`. Save.
6. **Project Settings** -> **API** (or **Data API**) -> copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon / publishable key** (long text). This key is designed to be public; your data is protected by
     the row-level security rules in step 2.
   Put both into GitHub as described in `docs/setup/github.md` step 4.