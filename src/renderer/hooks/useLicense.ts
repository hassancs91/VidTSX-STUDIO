import { useState, useEffect, useCallback } from 'react';
import type { LicenseGetStatusResponse } from '../../shared/ipc/types';

interface LicenseState {
  status: LicenseGetStatusResponse['status'];
  licenseKey: string;
  tier: string;
  features: string[];
  expiresAt: string;
  loading: boolean;
  error: string | null;
}

const initialState: LicenseState = {
  status: 'not_activated',
  licenseKey: '',
  tier: '',
  features: [],
  expiresAt: '',
  loading: true,
  error: null,
};

export function formatLicenseInput(raw: string): string {
  const clean = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 16);
  return clean.match(/.{1,4}/g)?.join('-') ?? clean;
}

export function useLicense() {
  const [state, setState] = useState<LicenseState>(initialState);

  const loadStatus = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const result = await window.api.licenseGetStatus();
      setState({
        status: result.status,
        licenseKey: result.key || '',
        tier: result.tier || '',
        features: result.features || [],
        expiresAt: result.expiresAt || '',
        loading: false,
        error: null,
      });
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Listen for push events from background validation
  useEffect(() => {
    const unsubscribe = window.api.onLicenseStatusChanged((event) => {
      if (event.status === 'revoked' || event.status === 'expired') {
        setState({
          status: 'not_activated',
          licenseKey: '',
          tier: '',
          features: [],
          expiresAt: '',
          loading: false,
          error: 'Your license has been revoked or expired',
        });
      } else if (event.status === 'valid') {
        loadStatus();
      }
    });
    return unsubscribe;
  }, [loadStatus]);

  const activate = useCallback(async (key: string): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const result = await window.api.licenseActivate({ licenseKey: key });
      if (result.success) {
        // Reload full status to get masked key etc.
        await loadStatus();
        return true;
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error || 'Activation failed',
        }));
        return false;
      }
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Network error during activation',
      }));
      return false;
    }
  }, [loadStatus]);

  const deactivate = useCallback(async (): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const result = await window.api.licenseDeactivate();
      if (result.success) {
        setState({
          ...initialState,
          loading: false,
        });
        return true;
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error || 'Deactivation failed',
        }));
        return false;
      }
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Network error during deactivation',
      }));
      return false;
    }
  }, []);

  return {
    status: state.status,
    licenseKey: state.licenseKey,
    tier: state.tier,
    features: state.features,
    expiresAt: state.expiresAt,
    loading: state.loading,
    error: state.error,
    activate,
    deactivate,
    reload: loadStatus,
  };
}
