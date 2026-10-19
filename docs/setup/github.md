# Put the app online with GitHub Pages (free)

1. On github.com -> **New repository** -> name `Casishoarder-Stickers-app` -> **Public** -> don't add any files -> Create.
   (Free GitHub Pages needs a public repo. Only the app's code is public. Your stickers, prices and
   photos live in Supabase and need your login.)
2. Tell Claude your GitHub username; Claude pushes the code.
3. Repo -> **Settings** -> **Pages** -> Source: **GitHub Actions**.
4. Repo -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**, add:
   - `VITE_SUPABASE_URL` = Project URL from Supabase
   - `VITE_SUPABASE_ANON_KEY` = anon / publishable key from Supabase
   - (later, optional) `SHARE_TOKEN` = the code at the end of your share link, for the privacy check
5. Repo -> **Actions** -> "Deploy to GitHub Pages" -> **Run workflow**. When it's green, your app is at
   `https://<your-username>.github.io/Casishoarder-Stickers-app/`.
6. Keep-alive: Actions -> "Keep Supabase awake" runs twice a week. If GitHub ever shows it as disabled
   (after 60 days without changes to the repo), click **Enable workflow**.
