import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountRedirectUrl, accountError, readAuthCallback, passwordProblem, performAccountAction } from '../lib/account-auth.ts';

const input = { email: ' student@example.test ', password: ' a unique password ', confirmation: ' a unique password ', returnUrl: 'http://127.0.0.1:3000/account#error=access_denied&error_code=otp_expired' };
function client(overrides = {}) {
  const calls = [];
  const defaults = {
    signInWithPassword: { error: null }, signUp: { data: { session: { user: { id: 'test-student' } } }, error: null },
    resetPasswordForEmail: { error: null }, resend: { error: null },
    getUser: { data: { user: { id: 'test-student', email_confirmed_at: '2026-09-05' } }, error: null }, updateUser: { error: null },
  };
  const auth = Object.fromEntries(Object.entries(defaults).map(([name, result]) => [name, async (...args) => {
    calls.push([name, ...args]); return overrides[name] ?? result;
  }]));
  return { auth, calls };
}

test('Auth return addresses use the site origin and never inherit old errors or tokens', () => {
  assert.equal(accountRedirectUrl(input.returnUrl), 'http://127.0.0.1:3000/account');
  assert.equal(accountRedirectUrl('https://example.test/account/?next=https://other.test/#access_token=test'), 'https://example.test/account/');
});

test('Expired callback is explained and only the failed callback parameters are removed', () => {
  const result = readAuthCallback(input.returnUrl + '&error_description=untrusted+text&sb=');
  assert.match(result.error, /expired/);
  assert.equal(result.recovery, false);
  assert.equal(result.cleanUrl, 'http://127.0.0.1:3000/account');
  assert.ok(!result.error.includes('untrusted'));
});

test('Recovery intent is captured without copying or prematurely removing successful tokens', () => {
  const result = readAuthCallback('https://example.test/account/#access_token=secret-placeholder&refresh_token=private-placeholder&type=recovery');
  assert.deepEqual(result, { recovery: true, error: '', cleanUrl: null });
  assert.ok(!JSON.stringify(result).includes('placeholder'));
  assert.equal(readAuthCallback('https://example.test/account/#type=recovery&error_code=otp_expired').recovery, false);
  assert.equal(readAuthCallback('https://example.test/account/#access_token=placeholder&type=signup').recovery, false);
});

test('Password login uses only the password endpoint and preserves password whitespace', async () => {
  const { auth, calls } = client();
  assert.equal((await performAccountAction(auth, 'sign-in', input)).error, '');
  assert.deepEqual(calls, [['signInWithPassword', { email: 'student@example.test', password: input.password }]]);
});

test('Signup returns an immediate account session without requesting verification emails', async () => {
  const { auth, calls } = client();
  const result = await performAccountAction(auth, 'sign-up', input);
  assert.match(result.message, /account is ready/);
  assert.deepEqual(calls, [['signUp', { email: 'student@example.test', password: input.password }]]);
});

test('New passwords are confirmed and checked before any account writes', async () => {
  const { auth, calls } = client();
  assert.match(passwordProblem('short', 'short'), /12 characters/);
  assert.match((await performAccountAction(auth, 'sign-up', { ...input, confirmation: 'different' })).error, /don’t match/);
  assert.match((await performAccountAction(auth, 'password', { ...input, password: 'short', confirmation: 'short' })).error, /12 characters/);
  assert.equal(calls.length, 0);
});

test('Recovery email keeps the response generic and uses the configured account route', async () => {
  const { auth, calls } = client();
  const result = await performAccountAction(auth, 'forgot', input);
  assert.match(result.message, /If an account exists/);
  assert.deepEqual(calls, [['resetPasswordForEmail', 'student@example.test', { redirectTo: 'http://127.0.0.1:3000/account' }]]);
});

test('Signup without a session cannot claim success or tell the user an email was sent', async () => {
  const { auth, calls } = client({ signUp: { data: { session: null }, error: null } });
  const result = await performAccountAction(auth, 'sign-up', input);
  assert.equal(result.message, '');
  assert.match(result.error, /did not start a session/);
  assert.equal(calls.length, 1);
});

test('Password updates first verify the active user with the auth server', async () => {
  const { auth, calls } = client();
  assert.match((await performAccountAction(auth, 'password', input)).message, /Password saved/);
  assert.deepEqual(calls, [['getUser'], ['updateUser', { password: input.password }]]);
});

test('Missing accounts cannot update passwords; email verification is not a password-update prerequisite', async () => {
  for (const user of [null, {}]) {
    const { auth, calls } = client({ getUser: { data: { user }, error: null } });
    assert.match((await performAccountAction(auth, 'password', input)).error, /valid signed-in account/);
    assert.deepEqual(calls, [['getUser']]);
  }
  const { auth, calls } = client({ getUser: { data: { user: { id: 'authenticated-user', email_confirmed_at: null } }, error: null } });
  assert.equal((await performAccountAction(auth, 'password', input)).error, '');
  assert.equal(calls[1][0], 'updateUser');
});

test('Email limits and password errors are distinct, with no automatic retry', async () => {
  const { auth, calls } = client({ resetPasswordForEmail: { error: { code: 'over_email_send_rate_limit', status: 429 } } });
  assert.match((await performAccountAction(auth, 'forgot', input)).error, /email-sending limit/);
  assert.equal(calls.length, 1);
  assert.match(accountError({ code: 'invalid_credentials' }), /email or password/);
  assert.match(accountError({ code: 'email_not_confirmed' }), /marked as pending/);
  assert.match(accountError({ status: 429 }), /Too many attempts/);
});

test('Server password errors are not reported as a successful change', async () => {
  const { auth } = client({ updateUser: { error: { code: 'same_password' } } });
  const result = await performAccountAction(auth, 'password', input);
  assert.equal(result.message, '');
  assert.match(result.error, /different/);
});
