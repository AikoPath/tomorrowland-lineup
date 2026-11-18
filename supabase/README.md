# Sign-in with Supabase

A user can sign in with a link in an email. Then the favourites stay the same on all devices of the user. Sign-in is optional.

[Supabase](https://supabase.com) gives the sign-in and the database. The site stays static. The browser calls Supabase directly.

| File                  | Content                                                       |
| --------------------- | ------------------------------------------------------------- |
| `favourites.sql`      | The table of the favourites and its access rules.             |
| `email-sign-in.html`  | The text of the sign-in email.                                |

A build without the Supabase values has no sign-in. The favourites then stay on the device only. Thus you do not need Supabase to change the lineup data.

## Security

- The publishable key and the project URL are in the JavaScript of the site. They are public, as the Supabase design intends.
- Row level security in `favourites.sql` lets a signed-in user read, add and remove only their own rows. A user who is not signed in gets no rows.
- The browser does not send the user id. The database takes it from the session token, so a user cannot write rows of a different user.
- The table accepts only set keys in the correct format and a maximum of 1000 rows for each user.
- Supabase limits the number of sign-in emails for each hour.
- Do not put the secret key (`sb_secret_…`) in the site or in an environment variable with the `PUBLIC_` prefix. The secret key ignores row level security.
- The database keeps the email address and the favourite sets of each user. To delete a user and their favourites, delete the user in **Authentication → Users**.

## Set up a new Supabase project

Do these steps one time. They take approximately 30 minutes.

### 1. Make the project

1. Open https://supabase.com/dashboard and sign in with GitHub.
2. Click **New project**.
3. Write `tomorrowland-lineup` as the name.
4. Click **Generate a password**, then keep the password in your password manager. The site does not use it.
5. Select the region **Southeast Asia (Singapore)**. This region is near the festival.
6. Click **Create new project**. Wait until the project is ready.

### 2. Make the table

1. Open **SQL Editor** in the left menu.
2. Click **New query**.
3. Paste all the text of `supabase/favourites.sql`.
4. Click **Run**. The result must be "Success. No rows returned".
5. Open **Table Editor**. Make sure that the table `favourites` shows the label "RLS enabled".

### 3. Set the links

1. Open **Authentication → URL Configuration**.
2. Set **Site URL** to `https://tomorrowland.aiko.dev`.
3. Add these three values to **Redirect URLs**:
   - `https://tomorrowland.aiko.dev/sign-in/confirm/`
   - `https://tomorrowland-lineup-*.vercel.app/sign-in/confirm/`
   - `http://localhost:4321/sign-in/confirm/`

Supabase sends a link only to a page in this list.

### 4. Change the sign-in email

Supabase sends the "Confirm signup" email to a new user and the "Magic link" email to a known user. Change the two emails.

1. Open **Authentication → Emails → Templates**.
2. Open **Confirm signup**.
3. Set the subject to `Your sign-in link`.
4. Replace all the text of the body with the text of `supabase/email-sign-in.html`.
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
2. Add `PUBLIC_SUPABASE_URL` for **Production** and **Preview**.
3. Add `PUBLIC_SUPABASE_PUBLISHABLE_KEY` for **Production** and **Preview**.
4. Deploy again. Astro writes the values into the JavaScript at build time.

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
