# Act Avenue Ticketing: Setup

Do the steps in order. Total time: about 30 minutes.

## 1. Supabase

1. Create a project at supabase.com. Save the database password.
2. SQL Editor > New query. Paste all of `supabase/schema.sql` and run it **once**.
3. Storage > create three buckets, all set to **Public**:
   - `payment-proofs`
   - `e-tickets`
   - `production-media`
4. Authentication > URL Configuration. Leave it for now. You set it in step 5.
5. Authentication > Providers > Email. For quick testing, turn **Confirm email** off. For production, keep it on and set up custom SMTP (Resend works) because Supabase's built-in email is rate limited.
6. Project Settings > API Keys. Copy:
   - Project URL
   - anon / Publishable key
   - service_role / Secret key (keep private)
7. Create your admin login: Authentication > Users > Add user (your email and a password). Then SQL Editor:

```sql
update profiles
set role = 'admin', display_name = 'Your Name'
where id = (select id from auth.users where email = 'you@example.com');
```

## 2. Resend

1. Sign up at resend.com.
2. Domains > Add Domain. Add the DNS records at your domain provider and wait for Verified.
3. API Keys > Create. Copy it.
4. Pick your sender, for example `Act Avenue <tickets@yourdomain.com>`.

`onboarding@resend.dev` only delivers to your own Resend account email. Use it for a first test, then switch.

## 3. Images

Every logo, texture and placeholder lives in `public/images/`. Replace a file and keep the same name.

| File | Used for | Size |
|---|---|---|
| `AA_logo.png` | Navbar logo, browser tab icon | 256x256 |
| `navbar.png` | Navbar background texture | 1600x120 |
| `background.png` | Section background texture | 1600x900 |
| `placeholder-poster.png` | Production with no poster | 600x900 |
| `placeholder-banner.png` | Production with no banner | 1600x600 |
| `placeholder-headshot.png` | Actor with no photo | 400x400 |

Real posters, banners and headshots are uploaded from the admin pages. To rename a file or change its path, edit `lib/images.ts`.

## 4. GitHub

Create a **new, empty, private** repo. Do not upload this over an older copy of the app. Old and new folders would both exist and the build fails with duplicate routes.

**A. GitHub Desktop (easiest).** File > Add Local Repository > pick this folder > Publish repository.

**B. Command line.**
```
cd theater-ticketing-app
git init
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOU/REPO.git
git push -u origin main
```

**C. Browser upload.** GitHub accepts 100 files per upload.
1. Unzip. Upload the `app` folder first (drag the folder, not its contents). Commit.
2. Upload everything else (`components`, `lib`, `public`, `supabase`, `types`, and all loose files). Include hidden files such as `.gitignore`.
3. Keep folder names with brackets exactly as they are: `(site)` and `(protected)`.

To move files later, press `.` on the repo page (opens github.dev) and drag them in the explorer.

## 5. Vercel

1. vercel.com > Add New > Project > import the repo. Framework is detected as Next.js.
2. Add these environment variables before deploying:

| Name | Value | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / Publishable key | No |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role / Secret key | **Yes** |
| `RESEND_API_KEY` | Resend key | **Yes** |
| `EMAIL_FROM` | `Act Avenue <tickets@yourdomain.com>` | Yes |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` | No |
| `CRON_SECRET` | any long random string | **Yes** |

Vercel warns about names starting with `NEXT_PUBLIC_`. Keep that prefix on the three public values. Never add it to the secret ones.

3. Deploy. Copy your live URL.
4. If the URL differs from what you typed in `NEXT_PUBLIC_SITE_URL`, fix it and redeploy.
5. Back in Supabase > Authentication > URL Configuration:
   - Site URL: your live URL
   - Redirect URLs: add `https://your-app.vercel.app/**`

## 6. Hold-expiry cron

`vercel.json` runs `/api/cron/hold-expiry` once a day, which is the limit on the Hobby plan. Vercel sends your `CRON_SECRET` automatically. Cron runs on production only.

- **Pro plan:** change the schedule in `vercel.json` to `*/30 * * * *`.
- **Staying on Hobby:** use cron-job.org to call `https://your-app.vercel.app/api/cron/hold-expiry` every 30 minutes with the header `Authorization: Bearer YOUR_CRON_SECRET`.

## 7. First production

1. Go to `/admin/login` and sign in with the admin account from step 1.7.
2. Organizations: create "Act Avenue".
3. Productions: create one, upload poster and banner, add performances and ticket tiers, set status to Published.
4. The show now appears on the homepage.

## 8. Test the full flow

1. Open the site in a private window. Add tickets to the cart. Check out with a screenshot as proof.
2. Check that Email 1 arrives.
3. In `/admin/reservations`, approve it. Check that Email 2 arrives with the QR.
4. In `/admin/checkin`, enter the reference code. It should check in once and block the second time.
5. Reject another booking. Check that the re-upload email arrives and the link works.

## Troubleshooting

| Problem | Fix |
|---|---|
| Too many redirects on `/admin/login` | You are on an old copy. Use this version, where login sits outside `(protected)`. |
| Build fails with duplicate or conflicting routes | Old files remain in the repo. Delete the repo contents and re-upload. |
| Images show "hostname not configured" | Set `NEXT_PUBLIC_SUPABASE_URL` in Vercel and redeploy. |
| No emails arrive | Check `RESEND_API_KEY`, `EMAIL_FROM` and that the domain is Verified. |
| Emails link to the wrong address | Fix `NEXT_PUBLIC_SITE_URL`, then redeploy. |
| Cron returns 401 | `CRON_SECRET` is missing in Vercel. Add it and redeploy. |
| Deploy fails on `vercel.json` cron | The schedule runs more than once a day on Hobby. Use `0 0 * * *`. |
| Signup confirmation email never comes | Turn Confirm email off for testing, or set custom SMTP. |

## Updating later

Edit files, commit, push. Vercel redeploys on every push to `main`. Database changes go in the Supabase SQL Editor.
