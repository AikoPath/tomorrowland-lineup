import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from 'astro:env/client';
import { clearPending, type FavouriteAccount } from '../favourites/sync.ts';
import { SIGN_IN_CONFIRM_URL } from '../urls.ts';
import { SESSION_STORAGE_KEY } from './session.ts';

/**
 * The browser calls Supabase directly with the publishable key. The key is public.
 * The row level security in supabase/migrations/20261118000000_favourites.sql lets each user read and change only their own favourites.
 */
let client: SupabaseClient | undefined;

function supabase(): SupabaseClient {
  if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_PUBLISHABLE_KEY) throw new Error('Sign-in is not available.');
  client ??= createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    // The confirm page reads the link of the email. No other page has sign-in data in its URL.
    auth: { storageKey: SESSION_STORAGE_KEY, detectSessionInUrl: false },
  });
  return client;
}

/** Supabase sends an email with a link to the confirm page. The email template is in supabase/templates/sign-in.html. */
export async function sendSignInLink(email: string): Promise<void> {
  const { error } = await supabase().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: new URL(SIGN_IN_CONFIRM_URL, location.origin).href },
  });
  if (error) throw error;
}

export async function confirmSignIn(tokenHash: string): Promise<void> {
  const { error } = await supabase().auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
  if (error) throw error;
}

/** Gives null when no user is signed in. */
export async function signedInEmail(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.user.email ?? null;
}

/**
 * Only this device signs out. The other devices stay signed in.
 * The favourites stay on this device. The changes that the account does not have yet go away.
 */
export async function signOut(): Promise<void> {
  clearPending(localStorage);
  const { error } = await supabase().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export const favouriteAccount: FavouriteAccount = {
  async list() {
    const { data, error } = await supabase().from('favourites').select('set_key');
    if (error) throw error;
    return data.map((row) => row.set_key as string);
  },
  async add(keys) {
    // The database sets the user_id column from the session.
    const { error } = await supabase()
      .from('favourites')
      .upsert(
        keys.map((key) => ({ set_key: key })),
        { onConflict: 'user_id,set_key', ignoreDuplicates: true },
      );
    if (error) throw error;
  },
  async remove(keys) {
    const { error } = await supabase().from('favourites').delete().in('set_key', keys);
    if (error) throw error;
  },
};
