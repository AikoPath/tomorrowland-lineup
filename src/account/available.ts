import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from 'astro:env/client';

/** A build without the Supabase values, for example on the computer of a data contributor, has no sign-in. */
export const ACCOUNT_AVAILABLE = Boolean(PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_PUBLISHABLE_KEY);
