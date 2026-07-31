import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';
import type { Database } from '../../types/database';

const REQUEST_TIMEOUT_MS = 15_000;

// React Native's fetch can stall indefinitely on a degraded connection (never
// resolving or rejecting), which otherwise leaves any in-flight mutation's
// `isPending` stuck `true` forever with no error surfaced.
function fetchWithTimeout(...[input, init]: Parameters<typeof fetch>): ReturnType<typeof fetch> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});
