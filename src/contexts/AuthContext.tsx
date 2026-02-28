import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  permission_type: 'user' | 'manager' | 'admin';
  position: string | null;
  company_id: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Refs to track mounted state and whether a confirmed session exists
  const mountedRef = useRef(true);
  const hasConfirmedSessionRef = useRef(false);

  const fetchProfile = useCallback(async (userId: string, retryCount = 0): Promise<void> => {
    if (!mountedRef.current) return;

    console.log(`[Auth] fetchProfile starting for ${userId}(attempt ${retryCount + 1})`);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, is_active, company_id, avatar_url, permission_type, position')
        .eq('id', userId)
        .maybeSingle();

      if (!mountedRef.current) return;

      if (error) {
        console.error(`[Auth] Error fetching profile(attempt ${retryCount + 1}): `, error);
        if (retryCount < 3) {
          console.log(`[Auth] Retrying profile fetch in ${1000 * (retryCount + 1)}ms...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return fetchProfile(userId, retryCount + 1);
        }
        return;
      }

      if (data) {
        // cast to any to avoid SelectQueryError if types are out of sync
        const rawData = data as any;
        let avatar_url = rawData.avatar_url;
        if (avatar_url && !avatar_url.startsWith('http')) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(avatar_url);
          avatar_url = urlData.publicUrl;
        }

        if (mountedRef.current) {
          console.log(`[Auth] Profile loaded successfully for ${userId}`);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const raw = data as unknown as Record<string, any>;
          setProfile({
            id: raw.id,
            full_name: raw.full_name,
            email: raw.email,
            is_active: raw.is_active,
            company_id: raw.company_id ?? null,
            avatar_url,
            permission_type: (raw.permission_type as Profile['permission_type']) ?? 'user',
            position: raw.position ?? null,
          });
        }
      } else {
        console.warn(`[Auth] No profile found for user ${userId}`);
        setProfile(null);
      }
    } catch (err) {
      console.error(`[Auth] Unexpected error fetching profile(attempt ${retryCount + 1}): `, err);
      if (retryCount < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return fetchProfile(userId, retryCount + 1);
      }
    }
  }, []);

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const applySession = useCallback(async (nextSession: Session | null) => {
    if (!mountedRef.current) return;

    console.log(`[Auth] applySession starting.Session exists: ${!!nextSession} `);

    setSession(nextSession);
    const currentUser = nextSession?.user ?? null;
    setUser(currentUser);

    if (currentUser) {
      hasConfirmedSessionRef.current = true;
      // Fetch in background to not block initialization
      fetchProfile(currentUser.id).catch(err => console.error('Background profile fetch error:', err));
    } else {
      hasConfirmedSessionRef.current = false;
      setProfile(null);
    }
    console.log(`[Auth] applySession finished. User: ${currentUser?.id}, Profile load triggered.`);
  }, [fetchProfile]);

  useEffect(() => {
    mountedRef.current = true;
    let initialized = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        if (!mountedRef.current) return;

        console.log(`[Auth] onAuthStateChange event: ${event}`, nextSession?.user?.id);

        await applySession(nextSession);

        if (!initialized) {
          console.log('[Auth] Initialized via onAuthStateChange');
          initialized = true;
          setLoading(false);
        }

        if (event === 'SIGNED_OUT') {
          console.log('[Auth] User signed out, redirecting to /auth');
          navigate('/auth', { replace: true });
        }

        if (event === 'PASSWORD_RECOVERY') {
          navigate('/reset-password');
        }
      }
    );

    const initializeAuth = async () => {
      try {
        console.log('[Auth] initializeAuth starting (getSession)...');

        // Initial quick check
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[Auth] getSession error:', error);
        }

        if (!mountedRef.current) return;

        // If we found a session immediately, or if the listener already set initialized
        if (initialSession || initialized) {
          if (!initialized) {
            console.log('[Auth] Found session immediately via getSession');
            await applySession(initialSession);
            initialized = true;
            setLoading(false);
          }
          return;
        }

        // If no session yet, we might need to wait for Supabase to recover it from localStorage.
        // Check for presence of Supabase keys in localStorage as a hint to wait.
        const storageKeys = Object.keys(localStorage);
        const hasAuthHint = storageKeys.some(key => key.startsWith('sb-') && key.endsWith('-auth-token'));

        if (hasAuthHint) {
          console.log('[Auth] Found localStorage hint, waiting for session rehydration...');
          // Give onAuthStateChange some time to emit INITIAL_SESSION with a real session
          // We wait up to 1 second, but will resolve early if 'initialized' becomes true.
          for (let i = 0; i < 10; i++) {
            if (initialized || !mountedRef.current) break;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        if (!mountedRef.current) return;

        // Final definitive check if still not initialized
        if (!initialized) {
          const { data: { session: finalSession } } = await supabase.auth.getSession();
          console.log(`[Auth] Final initialization check.Session: ${!!finalSession} `);
          await applySession(finalSession);
          initialized = true;
          setLoading(false);
        }
      } catch (err) {
        console.error('[Auth] initializeAuth error:', err);
        if (!initialized && mountedRef.current) {
          await applySession(null);
          initialized = true;
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const handleVisibilityOrFocus = async () => {
      if (!mountedRef.current || !hasConfirmedSessionRef.current) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && mountedRef.current) {
          setSession(session);
          setUser(session.user);
        }
      } catch (err) {
        console.warn('[Auth] Silent session refresh failed:', err);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    const handleVis = () => {
      if (document.visibilityState === 'visible') handleVisibilityOrFocus();
    };
    document.addEventListener('visibilitychange', handleVis);

    try {
      supabase.auth.startAutoRefresh();
    } catch (err) {
      console.warn('[Auth] startAutoRefresh failed:', err);
    }

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVis);
    };
  }, [navigate, applySession]);

  const signOut = async () => {
    try {
      hasConfirmedSessionRef.current = false;
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setProfile(null);
      setSession(null);
      setUser(null);
      localStorage.removeItem('sb-auth-session');
      localStorage.removeItem('selectedCompanyId');
      localStorage.removeItem('selectedCompany');
      sessionStorage.clear();
      navigate('/auth', { replace: true });
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
