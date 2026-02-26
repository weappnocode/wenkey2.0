import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_COMPANY_ID = '30b26d53-7069-4f90-a200-f67e83493cec'; // Grupo RDZ

export interface Company {
  id: string;
  name: string;
  is_active?: boolean;
}

interface CompanyContextType {
  selectedCompany: Company | null;
  selectedCompanyId: string | null;
  setSelectedCompany: (company: Company | null) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(() => {
    try {
      const saved = localStorage.getItem('selectedCompany');
      if (saved) {
        return JSON.parse(saved);
      }

      // Fallback for migration from ID-only storage
      const legacyId = localStorage.getItem('selectedCompanyId');
      if (legacyId) {
        return { id: legacyId, name: '...' };
      }
    } catch (e) {
      console.error('Error parsing selectedCompany from localStorage', e);
    }

    // If absolutely nothing is found, return a stub that will be filled by the auto-select effect
    return null;
  });
  const autoSelectLock = useRef<{ userId: string | null; applied: boolean }>({
    userId: null,
    applied: false,
  });

  useEffect(() => {
    if (selectedCompany) {
      localStorage.setItem('selectedCompany', JSON.stringify(selectedCompany));
      // Keep legacy ID for compatibility
      localStorage.setItem('selectedCompanyId', selectedCompany.id);
    }
    // We strictly DO NOT clear localStorage here if selectedCompany is null,
    // to prevent accidental data loss during state transitions or mounting.
    // Clearing storage is handled explicitly by the signOut function in AuthContext.
  }, [selectedCompany]);

  // Auto-select logic: runs ONCE per login session (when userId changes).
  // Does NOT interfere with manual company switches by the user.
  useEffect(() => {
    const userId = profile?.id ?? null;

    // Detect new login (userId changed)
    if (autoSelectLock.current.userId === userId) return;

    // Reset lock for the new session
    autoSelectLock.current = { userId, applied: false };

    // Nothing to do if logged out
    if (!userId) return;

    // If already have a company selected in localStorage, keep it as-is
    // (user may have chosen it manually in a previous session and we respect that)
    const savedStr = localStorage.getItem('selectedCompany');
    if (savedStr) {
      try {
        const saved = JSON.parse(savedStr);
        if (saved?.id) {
          // Mark as applied so we don't override
          autoSelectLock.current.applied = true;
          return;
        }
      } catch { /* ignore */ }
    }

    // No saved company — fetch and apply the default
    const targetCompanyId = profile?.company_id || DEFAULT_COMPANY_ID;

    const fetchAndSelect = async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name, is_active')
          .eq('id', targetCompanyId)
          .maybeSingle();

        if (error) throw error;

        if (data && data.is_active) {
          setSelectedCompany({
            id: data.id,
            name: data.name,
            is_active: data.is_active,
          });
        }
      } catch (err) {
        console.error('Error auto-selecting company:', err);
      } finally {
        autoSelectLock.current.applied = true;
      }
    };

    fetchAndSelect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.company_id]);

  return (
    <CompanyContext.Provider value={{
      selectedCompany,
      selectedCompanyId: selectedCompany?.id || null,
      setSelectedCompany
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
