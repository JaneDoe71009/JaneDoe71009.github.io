# Publish IB Info

The site is ready for a GitHub **user site**, such as `https://your-github-username.github.io`. No OpenAI account or branding is needed to visit it. It is an independent student site, not an official IB or school service.

## What is ready

- Blue-and-white light and dark themes; 13 pages with all six DP subject groups and separate EE, TOK, and CAS pages.
- Personal events, subject favorites, calendar filters, calendar export, and private countdowns displaying days, hours, minutes, and seconds, with independent weekend, holiday, and day-off settings. Target times use Eastern time; excluded days pause the clock. Existing date-only countdowns target midnight at the start of their selected date, without rewriting saved plans.
- Email sign-in, review queues, resources, study tips, discussions, replies, reports, and owner/admin controls once the database is connected.
- A weekly GitHub calendar refresh that discovers each new school-year document. Unreadable or unpublished sources are flagged, never filled with guessed dates.

## 1. Connect your own Supabase project

1. Sign in to [Supabase](https://supabase.com/dashboard) and create a free project. Enter the database password yourself and keep it private.
2. In its SQL editor, run `supabase/migrations/202609040001_ib_info.sql` once in a new, empty project. It creates the tables, approval rules, privacy protections, and owner-only moderation functions.
3. In Authentication → URL Configuration, set Site URL to `https://your-github-username.github.io` and allow `https://your-github-username.github.io/account/`. For local development, also allow `http://127.0.0.1:3000/account/`.
4. Current user-selected setup: turn **Confirm email off** under Authentication → Sign In / Providers. New email/password accounts sign in immediately. Password recovery still needs email delivery; configure your own mail provider under Authentication → SMTP when needed. Supabase's default sender restricts recipients and has low sending limits. Check any provider's free limits and domain requirements; do not buy anything unless you choose to.
5. Copy the project URL and **publishable/anon client key** into the GitHub repository variables described below. The key is intentionally public; database permissions enforce access. Never use a service-role key, secret key, database password, or personal access token in the website.
6. On IB Info's Account page, choose **Create account**, enter an email and a unique password, and sign in immediately. Email verification is off for now. After identifying your own actual website account, run the following in Supabase's SQL editor using its email:

```sql
select public.configure_owner('YOUR_ACCOUNT_EMAIL');
```

This command cannot be run by ordinary website visitors. The first visitor cannot claim ownership. You can then add classmates as admins from the site's Administration page. Since email ownership is not checked, personally confirm which account belongs to a classmate before granting admin access.

Optional local connection: copy `.env.example` to a private `.env.local`, enter only the two public client values, and restart the local preview.

### Passwords and email limits

- New passwords entered through the website require at least 12 characters and confirmation. Supabase Auth validates and hashes passwords; the app never puts them in its content tables, personal plans, or browser preference storage. Database permissions are unchanged by the sign-in method.
- Signed-in users can choose **Set / change password**. Someone who previously used a magic link can use this option, or choose **Forgot or haven’t set a password?** while signed out. Recovery requires a working email and a valid recovery session; turning off signup verification does not reset existing passwords.
- Recovery emails return to the existing `/account` or `/account/` allowlisted address. The app captures recovery intent before Supabase consumes the successful link, and only allows a password update after the auth server verifies the signed-in user. Expired or used links show an explanation.
- Signup and normal sign-in no longer require emails. Password recovery still does. The current default Supabase sender is restricted to project-team addresses and 2 messages per hour, so recovery can remain unavailable until delivery is configured. See [Supabase email delivery](https://supabase.com/docs/guides/auth/auth-smtp).
- Supabase implicitly confirms accounts when Confirm email is disabled. The existing database activation checks continue to work without a new migration; that activation timestamp is not proof of email ownership. The UI now describes identities as account lookups, not verified people. Existing passwords, owner/admin grants, bans, and private-plan permissions are preserved.
- The interface waits 60 seconds between email requests to discourage repeat clicks. This is not the server's rate-limit reset time, and it does not lift the provider limit. No email is sent automatically on page load.

## 2. Publish on GitHub Pages

1. Create an empty public repository named exactly `your-github-username.github.io` in your GitHub account. Do not overwrite an existing user-site repository.
2. Upload/commit the source files, including `.github/workflows/pages.yml`, the lockfile, and the database migration. Exclude `.env.local`, dependencies, caches, generated builds, logs, and any student information. Your public repository contains code and official public calendar dates, not the database's student content or identities.
3. Under Settings → Secrets and variables → Actions → Variables, add `SUPABASE_URL` and `SUPABASE_ANON_KEY` using the public client values from Supabase. Add `SCHOOL_CALENDAR_URL` and `SCHOOL_CALENDAR_ALLOWED_HOSTS` there too; the calendar updater reads those private repository settings without publishing the school URL in the source or generated calendar.
4. Under Settings → Pages, choose **GitHub Actions** as the publishing source. Allow the workflow to write to this repository so verified calendar updates can be retained.
5. Run **Publish IB Info** from Actions. It refreshes sources, runs tests, checks types, builds, and publishes. It also runs on pushes to `main` and weekly on Mondays. Check that the run succeeds before sharing the address.

This setup deliberately uses an account-level GitHub Pages address. Project subpaths like `/ib-info/` need a separate routing configuration; do not rename the repository to an ordinary project name without changing the setup.

GitHub schedules can be delayed, and public repositories with no activity may have schedules disabled. Check Actions periodically and re-enable a disabled schedule. Auto-refresh is best effort, not a guarantee of immediate school cancellations or timetable revisions.

## 3. Before inviting classmates

- Test with two separate student accounts and one additional admin in your real project. Verify new signup starts a session immediately without an email, pending dates are invisible publicly, tips/forums publish immediately, and password sign-in works. When recovery email delivery is available, check that a valid recovery link opens the new-password form and an expired link cannot change a password.
- Confirm additional admins cannot read reports or look up identities. Only the owner can do either through the website. Never make student moderators Supabase project collaborators.
- Confirm private plans stay separate across accounts. Device-only plans remain on that browser; they are not automatically uploaded when someone signs in.
- Check the calendar's source status. The current 2026–2027 no-school dates were verified. The IB source rejected the automated request, so May 2027 dates have not been invented. Confirm the final subject/session timetable with the school coordinator.
- Review the community/privacy page and the moderation rules. A word filter catches some explicit terms, not every form of abuse; owner reports and human moderation remain necessary. Add blocked terms in the private database table if needed.

## Privacy and limits

Public visitors see approved content and any nickname chosen by its author. Only the owner can associate contributions with their sign-in email through the app; other admins cannot access those identities or reports. The owner and hosting/database providers may have technical access outside the website, so this is **not untraceable or end-to-end encrypted**. Students should never post private information or upload other people's work without permission.

Personal plans are protected by account-level database rules, or are stored only on the current browser while signed out. People using the same browser profile can access its device-local plans. Signing out does not delete device-local plans.

The source includes working approval and access rules, tested in a local PostgreSQL-compatible test database. Live email, hosted database configuration, and public deployment still require account setup and a live launch check. Free service limits may change; [Supabase pricing](https://supabase.com/pricing) currently notes inactivity pauses on free projects. No paid service is required by this source, but email delivery may need another provider.

## Development

Use Node 22.13 or later and pnpm 11.19.0. `pnpm dev` runs the local preview in the terminal. `pnpm preview:local` starts it independently of that terminal and writes runtime logs to ignored `.preview/server.log`; it reuses an existing listener on port 3000 and installs no login/startup service. The computer must remain on for a local preview to be accessible. `pnpm test` runs auth, calendar, and database-permission tests; `pnpm exec tsc --noEmit` checks types; `pnpm build` generates `dist/client` for GitHub Pages. `pnpm sync:calendars` refreshes official public sources and retains last verified dates when a source fails.
