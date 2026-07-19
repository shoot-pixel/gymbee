import { useState, useCallback } from 'react';
import { supabase } from '../services/api/supabaseClient';

type AuthResult = { error: string | null };

/** Thin wrapper around supabase.auth mutations with local loading/error state. */
export function useAuth() {
  const [loading, setLoading] = useState(false);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    return { error: error?.message ?? null };
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async (): Promise<AuthResult> => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    setLoading(false);
    return { error: error?.message ?? null };
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    return { error: error?.message ?? null };
  }, []);

  return { loading, signIn, signUp, resetPassword, signOut, updatePassword };
}
