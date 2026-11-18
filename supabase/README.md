# Sign-in with Supabase

A user can sign in with a link in an email. Then the favourites stay the same on all devices of the user. Sign-in is optional.

[Supabase](https://supabase.com) gives the sign-in and the database. The site stays static. The browser calls Supabase directly.

| File                                       | Content                                                     |
| ------------------------------------------ | ----------------------------------------------------------- |
| `migrations/20261118000000_favourites.sql` | The table of the favourites and its access rules.           |
| `templates/sign-in.html`                   | The text of the sign-in email.                              |
| `config.toml`                              | The settings for preview branches and for `supabase start`. |

The Supabase GitHub integration runs each new file in `migrations/` on the production database after the merge to `main`. Do not run a migration in the SQL Editor. A second run of a migration fails.

The integration does not send the Auth settings in `config.toml` to production. Set them in the dashboard, as in steps 3 and 4.

A build without the Supabase values has no sign-in. The favourites then stay on the device only. Thus you do not need Supabase to change the lineup data.

## Security

- The publishable key and the project URL are in the JavaScript of the site. They are public, as the Supabase design intends.
- Row level security in the migration lets a signed-in user read, add and remove only their own rows. A user who is not signed in gets no rows.
- The browser does not send the user id. The database takes it from the session token, so a user cannot write rows of a different user.
- The table accepts only set keys in the correct format and a maximum of 1000 rows for each user.
- Supabase limits the number of sign-in emails for each hour.
- The sign-in links go only to the production site and to `localhost`. See step 3.
- Supabase runs each migration that you merge into `main`, with all rights on the database. Read each change to `supabase/` in a PR from a contributor before you merge it.
- Do not put the secret key (`sb_secret_…`) in the site or in an environment variable with the `PUBLIC_` prefix. The secret key ignores row level security.
- The database keeps the email address and the favourite sets of each user. To delete a user and their favourites, delete the user in **Authentication → Users**.

## Set up a new Supabase project

Do these steps one time. They take approximately 30 minutes.

### 1. Make the project

1. Open https://supabase.com/dashboard and click **New project**.
2. Select **Connected to GitHub**, then select the repo `AikoPath/tomorrowland-lineup`.
3. Write `tomorrowland-lineup` as the name.
4. Click **Generate a password**, then keep the password in your password manager. The site does not use it.
5. Select the region **Southeast Asia (Singapore)**. This region is near the festival.
6. Under **Security**, set these values:
   - **Enable Data API**: on. The site uses it.
   - **Automatically expose new tables**: off. The migration gives the access rights.
   - **Enable automatic RLS**: on.
7. Click **Create new project**. Wait until the project is ready.

### 2. Connect the migrations

1. Open **Project Settings → Integrations → GitHub**.
2. Set **Working directory** to `.`.
3. Set the production branch to `main`.
4. Turn on **Deploy to production**.
5. Turn off **Automatic branching**. Each preview branch is a separate database that costs money.
6. Click **Save**. The integration runs the migrations only on a push to `main` after this save.
7. Merge the PR with the `supabase/` folder into `main`.
8. Open **Table Editor**. Make sure that the table `favourites` shows the label "RLS enabled".

The site shows no sign-in link until section 7, so you can merge the PR before the other steps.

### 3. Set the links

1. Open **Authentication → URL Configuration**.
2. Set **Site URL** to `https://tomorrowland.aiko.dev`.
3. Add these two values to **Redirect URLs**:
   - `https://tomorrowland.aiko.dev/sign-in/confirm/`
   - `http://localhost:4321/sign-in/confirm/`

Supabase sends a link only to a page in this list. Do not add a pattern for `vercel.app`. Any person can make a Vercel project with a name that matches the pattern, and then get the sign-in link of a different user. Thus the sign-in works only on the production site and on your computer.

### 4. Change the sign-in email

Supabase sends the "Confirm signup" email to a new user and the "Magic link" email to a known user. Change the two emails.

1. Open **Authentication → Emails → Templates**.
2. Open **Confirm signup**.
3. Set the subject to `Your sign-in link`.
4. Replace all the text of the body with the text of `supabase/templates/sign-in.html`.
5. Click **Save changes**.
6. Do steps 3 to 5 again for **Magic link**.

The link in the email opens `/sign-in/confirm/` on the site, and JavaScript on that page does the sign-in. An email scanner that opens the link does not use the token, because it does not run JavaScript.

### 5. Copy the keys

1. Open **Project Settings → API Keys**.
2. Copy the **publishable key**. It starts with `sb_publishable_`.
3. Open **Project Settings → Data API** and copy the **Project URL**.

### 6. Test on your computer

1. Make a file `.env` in the root of the repo with these two lines:

   ```sh
   PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   ```

2. Run `npm run dev`.
3. Open http://localhost:4321 and tap the heart on a set.
4. Click **Sign in** in the message at the bottom.
5. Write your email address, then click **Send sign-in link**.
6. Open the link in the email in the same browser. The page shows "You are signed in as …".
7. Open **Table Editor → favourites** in Supabase. Make sure that it shows your favourite.

Git ignores the `.env` file.

### 7. Add the keys to Vercel

1. Open the Vercel project `tomorrowland-lineup`, then **Settings → Environment Variables**.
2. Add `PUBLIC_SUPABASE_URL` for **Production** only.
3. Add `PUBLIC_SUPABASE_PUBLISHABLE_KEY` for **Production** only.
4. Deploy again. Astro writes the values into the JavaScript at build time.

The preview deployments get no keys, because the sign-in links go only to the production site. A preview thus shows no sign-in link.

Do not connect the Supabase integration of Vercel. It adds the secret keys of the project to Vercel, and the site does not use them.

### 8. Send emails from your own domain

The email service in Supabase is for tests only. It sends emails only to the members of your Supabase organization, and only a small number in each hour. Do these steps before other users sign in.

1. Make an account on https://resend.com. The free plan sends 3000 emails each month.
2. Add the domain `tomorrowland.aiko.dev` in Resend.
3. Add the DNS records that Resend shows to the Porkbun DNS of `aiko.dev`.
4. Wait until Resend shows the domain as verified.
5. Make an API key in Resend with the permission "Sending access".
6. In Supabase, open **Authentication → Emails → SMTP Settings** and turn on **Enable custom SMTP**.
7. Write these values, then click **Save changes**:

   | Field        | Value                                   |
   | ------------ | --------------------------------------- |
   | Sender email | `noreply@tomorrowland.aiko.dev`         |
   | Sender name  | `Tomorrowland Thailand 2026 lineup`     |
   | Host         | `smtp.resend.com`                       |
   | Port         | `465`                                   |
   | Username     | `resend`                                |
   | Password     | The API key from Resend                 |

8. Open **Authentication → Rate Limits**. Set the emails for each hour to `100`.
