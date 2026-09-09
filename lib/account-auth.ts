import type { SupabaseClient } from '@supabase/supabase-js';

export type AccountAction = 'sign-in' | 'sign-up' | 'forgot' | 'password';
type AuthClient = Pick<SupabaseClient['auth'], 'signInWithPassword' | 'signUp' | 'resetPasswordForEmail' | 'getUser' | 'updateUser'>;
type Credentials = { email: string; password: string; confirmation: string; returnUrl: string };

export function accountRedirectUrl(currentUrl: string) {
  const url = new URL(currentUrl);
  // Preserve the local/static route variant, never old tokens or error parameters.
  return new URL(url.pathname.endsWith('/') ? '/account/' : '/account', url.origin).href;
}

export function accountError(error: unknown): string {
  const detail = error as { code?: string; message?: string; status?: number } | null;
  const code = detail?.code;
  if (code === 'over_email_send_rate_limit' || /email.*rate|rate.*email/i.test(detail?.message || ''))
    return 'The email-sending limit has been reached. Password recovery is temporarily unavailable. You can still sign in with your password or create a new account without email verification.';
  if (code === 'otp_expired') return 'This email link is invalid, expired, or already used. Sign in with your password. A new account no longer needs an email verification link.';
  if (code === 'invalid_credentials') return 'The email or password is incorrect. If you previously used an email sign-in link, choose “Forgot or haven’t set a password?” to set a password.';
  if (code === 'email_not_confirmed') return 'This account is still marked as pending from the previous signup setup. Contact the site owner to activate it; email verification is now turned off.';
  if (code === 'user_already_exists' || code === 'email_exists') return 'If you already have an account, sign in or use password recovery.';
  if (code === 'same_password') return 'Choose a password different from your current password.';
  if (code === 'weak_password') return 'Choose a stronger, unique password with at least 12 characters.';
  if (code === 'reauthentication_needed' || code === 'reauthentication_not_valid' || code === 'session_not_found')
    return 'Your session needs to be verified again. Sign in again or use a fresh password-reset email, then retry.';
  if (code === 'over_request_rate_limit' || detail?.status === 429) return 'Too many attempts. Please wait before trying again.';
  if (/email address.*not authorized|email address.*not allowed/i.test(detail?.message || ''))
    return 'The current email provider cannot send to this address. The site owner needs to finish email-delivery setup.';
  return 'We couldn’t complete that request. Check your connection and try again later. If this continues, contact the site owner.';
}

export function readAuthCallback(currentUrl: string) {
  const url = new URL(currentUrl);
  const hash = new URLSearchParams(url.hash.slice(1));
  const code = hash.get('error_code') || url.searchParams.get('error_code');
  const failed = Boolean(code || hash.get('error') || url.searchParams.get('error'));
  const recovery = !failed && hash.get('type') === 'recovery';
  let cleanUrl: string | null = null;
  // Leave successful callback tokens to Supabase. Never retain tokens in this object.
  if (failed && !hash.has('access_token') && !hash.has('refresh_token')) {
    for (const key of ['error', 'error_code', 'error_description', 'sb']) {
      hash.delete(key);
      url.searchParams.delete(key);
    }
    url.hash = hash.toString();
    cleanUrl = url.href;
  }
  return { recovery, error: failed ? accountError({ code: code || 'callback_failed' }) : '', cleanUrl };
}

export function passwordProblem(password: string, confirmation: string) {
  if (password.length < 12) return 'Use at least 12 characters for your new password.';
  if (password !== confirmation) return 'The passwords don’t match. Please enter them again.';
  return '';
}

export async function performAccountAction(auth: AuthClient, action: AccountAction, input: Credentials) {
  const email = input.email.trim();
  if (action === 'sign-up' || action === 'password') {
    const problem = passwordProblem(input.password, input.confirmation);
    if (problem) return { error: problem, message: '' };
  }
  try {
    if (action === 'sign-in') {
      const { error } = await auth.signInWithPassword({ email, password: input.password });
      if (error) throw error;
      return { error: '', message: 'You’re signed in.' };
    }
    if (action === 'password') {
      const current = await auth.getUser();
      if (current.error) throw current.error;
      if (!current.data.user?.id) return { error: 'A valid signed-in account or password-reset session is required to set a password.', message: '' };
      const { error } = await auth.updateUser({ password: input.password });
      if (error) throw error;
      return { error: '', message: 'Password saved. You can now sign in with your email and password.' };
    }
    const redirectTo = accountRedirectUrl(input.returnUrl);
    if (action === 'sign-up') {
      const { data, error } = await auth.signUp({ email, password: input.password });
      if (error) throw error;
      if (!data.session) return { error: 'Signup did not start a session. If you already have an account, sign in. Otherwise contact the site owner to check account activation.', message: '' };
      return { error: '', message: 'Your account is ready. You’re signed in.' };
    }
    if (action === 'forgot') {
      const { error } = await auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      return { error: '', message: 'If an account exists for that email, you’ll receive a link to set a new password. Use the newest email and check your spam folder.' };
    }
    return { error: 'Choose a sign-in action and try again.', message: '' };
  } catch (error) {
    return { error: accountError(error), message: '' };
  }
}
