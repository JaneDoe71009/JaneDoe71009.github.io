# How to run IB Info

This is the short, non-technical guide for the site owner.

## The three parts

- **GitHub** stores the website files and publishes the public pages.
- **Supabase** stores accounts, private countdowns, posts, submissions, and admin roles.
- **The local project folder** is the safest place to make and test bigger design or feature changes before publishing them.

Private student content is not stored in the public GitHub repository.

## Everyday site administration

Sign in on the website, then open **Administration** in the sidebar. From there you can:

- approve or reject submitted resources, deadlines, events, and corrections;
- moderate study tips and forum posts;
- review reports that only the owner can see;
- add another admin or revoke an admin role.

Tips and forum posts appear immediately, so check reports and the recent activity list regularly. Only grant admin access to an account you have personally confirmed belongs to the intended person.

## Personal calendars and countdowns

Open **Calendar** on the site. A signed-in student's personal events and countdowns are saved privately to that account. Each countdown can choose whether to include weekends, holidays, school days off, and extra days off. The clock uses Eastern time and shows days, hours, minutes, and seconds.

## Change permanent wording, links, subjects, or colors

For a tiny text correction, open the file in GitHub, select the pencil icon, make the edit, and choose **Commit changes**. GitHub then runs the publishing check automatically.

Useful files:

- `lib/catalog.ts` — subject lists, official resource links, and starter tips.
- `components/workspace-content.tsx` — most page wording and page sections.
- `components/hub.tsx` — sidebar, header, and footer.
- `app/globals.css` — light/dark colors and visual styling.
- `lib/official-calendar.json` — the last verified public calendar snapshot.

For a larger change, ask Codex to update the local project, test it, and show it in the local preview before uploading it.

## School calendar privacy and yearly updates

The public code deliberately does not contain a school or district name, URL, or source document link. The source address is stored in the repository's **Settings → Secrets and variables → Actions → Variables** as:

- `SCHOOL_CALENDAR_URL`
- `SCHOOL_CALENDAR_ALLOWED_HOSTS`

The weekly publishing job uses those settings to look for the current school-year calendar, but writes only generic school-calendar wording into the public site. If the school changes its calendar webpage or document host, update those two repository variables.

The calendar refresh retains the last verified dates if a source is unavailable or its format changes. Always confirm exam details with the IB coordinator rather than treating the website as the final authority.

## Publish and check an update

1. Open the repository's **Actions** tab.
2. Open **Publish IB Info**.
3. Confirm the newest run has a green check.
4. Open the public site and check the page you changed.

Never put a database password, Supabase service-role key, GitHub token, student email list, or private student data into a repository file. The Supabase publishable client key is designed to be used by a public website; the database access rules protect the private rows.
