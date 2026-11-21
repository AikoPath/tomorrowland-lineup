/**
 * A different person can send a user their own sign-in link. That link signs the user in to the account of that person.
 * Thus the device keeps the email address of its own sign-in request. The confirm page compares it with the account.
 */
export const SIGN_IN_REQUEST_STORAGE_KEY = 'sign-in-request';

type RequestStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function saveSignInRequest(storage: RequestStorage, email: string): void {
  storage.setItem(SIGN_IN_REQUEST_STORAGE_KEY, email);
}

/** Gives the email address of the request and removes it. A link thus has no effect on a later sign-in. */
export function takeSignInRequest(storage: RequestStorage): string | null {
  const email = storage.getItem(SIGN_IN_REQUEST_STORAGE_KEY);
  storage.removeItem(SIGN_IN_REQUEST_STORAGE_KEY);
  return email;
}

/** True only if this device asked for a link to the account that is now signed in. */
export function isOwnSignIn(requestedEmail: string | null, signedInEmail: string | null): boolean {
  return requestedEmail !== null && signedInEmail !== null && normalizeEmail(signedInEmail) === normalizeEmail(requestedEmail);
}

/** Supabase keeps each email address in lowercase. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
