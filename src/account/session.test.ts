import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SESSION_STORAGE_KEY, hasSession, sessionEmail } from './session.ts';

function storage(value: string | null): Pick<Storage, 'getItem'> {
  return { getItem: (key) => (key === SESSION_STORAGE_KEY ? value : null) };
}

test('reads the email address from the session of the Supabase client', () => {
  assert.equal(sessionEmail(storage('{"access_token":"x","user":{"email":"a@example.com"}}')), 'a@example.com');
  assert.equal(hasSession(storage('{}')), true);
});

test('gives no email address with no session or with other content', () => {
  assert.equal(sessionEmail(storage(null)), null);
  assert.equal(sessionEmail(storage('{')), null);
  assert.equal(sessionEmail(storage('{"user":{}}')), null);
  assert.equal(hasSession(storage(null)), false);
});
