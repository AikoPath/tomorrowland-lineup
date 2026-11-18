/**
 * The Supabase client keeps the session in localStorage with this key.
 * A page can read the key without the Supabase client, so a user who does not sign in does not download the client.
 */
export const SESSION_STORAGE_KEY = 'account-session';

export function hasSession(storage: Pick<Storage, 'getItem'>): boolean {
  return storage.getItem(SESSION_STORAGE_KEY) !== null;
}
