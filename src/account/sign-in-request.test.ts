import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isOwnSignIn, saveSignInRequest, takeSignInRequest } from './sign-in-request.ts';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

test('accepts the sign-in to the account that this device asked for', () => {
  const storage = memoryStorage();
  saveSignInRequest(storage, ' Me@Example.com ');
  assert.equal(isOwnSignIn(takeSignInRequest(storage), 'me@example.com'), true);
});

test('ignores the case and the spaces of the email addresses', () => {
  assert.equal(isOwnSignIn('Me@Example.com', ' me@example.COM'), true);
});

test('rejects the sign-in to a different account', () => {
  const storage = memoryStorage();
  saveSignInRequest(storage, 'me@example.com');
  assert.equal(isOwnSignIn(takeSignInRequest(storage), 'attacker@example.com'), false);
});

test('rejects the sign-in when this device asked for no link', () => {
  assert.equal(isOwnSignIn(takeSignInRequest(memoryStorage()), 'me@example.com'), false);
  assert.equal(isOwnSignIn('me@example.com', null), false);
});

test('uses a request one time only', () => {
  const storage = memoryStorage();
  saveSignInRequest(storage, 'me@example.com');
  takeSignInRequest(storage);
  assert.equal(takeSignInRequest(storage), null);
});
