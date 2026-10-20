# Put the app online with GitHub Pages (free)

Your repository: **https://github.com/Casisnotnerd/Casishoarder-Stickers-app**

1. Make sure the repository is **Public** (repo → Settings → General → bottom "Danger Zone" → Change visibility).
   Free GitHub Pages needs a public repo. Only the app's code is public. Your stickers, prices and
   photos live in Supabase and need your login.
2. Claude pushes the code to the repository (you'll be asked to approve access once).
3. Repo → **Settings** → **Pages** → Source: **GitHub Actions**.
4. Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, add:
   - `VITE_SUPABASE_URL` = Project URL from Supabase
   - `VITE_SUPABASE_ANON_KEY` = anon / publishable key from Supabase
   - (later, optional) `SHARE_TOKEN` = the code at the end of your share link, for the privacy check
5. Repo → **Actions** → "Deploy to GitHub Pages" → **Run workflow**. When it's green, your app is at
   **https://casisnotnerd.github.io/Casishoarder-Stickers-app/**
6. Keep-alive: Actions → "Keep Supabase awake" runs twice a week. If GitHub ever shows it as disabled
   (after 60 days without changes to the repo), click **Enable workflow**.
