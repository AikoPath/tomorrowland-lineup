/**
 * The Supabase client keeps the session in localStorage with this key.
 * A page can read the key without the Supabase client, so the page loads the client only for a user who is signed in.
 */
export const SESSION_STORAGE_KEY = 'account-session';

export function hasSession(storage: Pick<Storage, 'getItem'>): boolean {
  return storage.getItem(SESSION_STORAGE_KEY) !== null;
}

/** The email address of the user who is signed in on this device. Other content in the storage gives null. */
export function sessionEmail(storage: Pick<Storage, 'getItem'>): string | null {
  try {
    const session = JSON.parse(storage.getItem(SESSION_STORAGE_KEY) ?? 'null') as { user?: { email?: unknown } } | null;
    const email = session?.user?.email;
    return typeof email === 'string' ? email : null;
  } catch {
    return null;
  }
}
