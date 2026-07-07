import { createContext, useContext, type ReactNode } from 'react';
import { useLicense } from '../hooks/useLicense';

type LicenseContextValue = ReturnType<typeof useLicense>;

const LicenseContext = createContext<LicenseContextValue | null>(null);

export function LicenseProvider({ children }: { children: ReactNode }) {
  const license = useLicense();
  return (
    <LicenseContext.Provider value={license}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicenseContext(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicenseContext must be used within LicenseProvider');
  return ctx;
}
