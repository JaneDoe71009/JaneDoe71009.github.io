import { createClient } from '@supabase/supabase-js';
import { readAuthCallback } from './account-auth';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Capture only callback intent/error before the SDK consumes the URL fragment.
export const initialAuthCallback = typeof window === 'undefined' ? null : readAuthCallback(window.location.href);
export const supabase = url && key ? createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) : null;
export const connected = Boolean(supabase);
