import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/api/supabaseClient';
import { useAuthStore } from '../store/authStore';
import type { Session } from '@supabase/supabase-js';

async function resolveOnboardingCompleted(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', userId)
    .single();
  // A missing row (still being created by the handle_new_user trigger, or a
  // transient read error) is treated as "onboarding not complete" rather than
  // thrown — this only gates which stack renders, not real data access.
  if (error || !data) return false;
  return data.onboarding_completed;
}

/**
 * Subscribes to Supabase auth state for the lifetime of the app and mirrors
 * it into authStore, which RootNavigator branches on. Mount once at the root,
 * inside QueryClientProvider (sign-out clears the query cache).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const setSession = useAuthStore(state => state.setSession);
  const signOutLocal = useAuthStore(state => state.signOutLocal);

  useEffect(() => {
    let cancelled = false;

    const applySession = async (session: Session | null) => {
      if (!session?.user) {
        if (!cancelled) signOutLocal();
        return;
      }
      const onboardingCompleted = await resolveOnboardingCompleted(session.user.id);
      if (!cancelled) {
        setSession({ userId: session.user.id, onboardingCompleted });
      }
    };

    supabase.auth.getSession().then(({ data }) => applySession(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
      }
      applySession(session);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
