import { useState } from 'react';
import { Button, Badge, TextInput } from '@shared/components';
import { useLicenseContext } from '../../contexts/LicenseContext';
import { formatLicenseInput } from '../../hooks/useLicense';

export function LicenseSection({ handleOpenLink }: { handleOpenLink: (url: string) => Promise<void> }) {
  const { status, licenseKey, tier, loading, error, activate, deactivate } = useLicenseContext();
  const [inputValue, setInputValue] = useState('');
  const [activating, setActivating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleActivate = async () => {
    const clean = inputValue.replace(/[^A-Z0-9]/gi, '');
    if (clean.length === 0) return;
    setActivating(true);
    const success = await activate(inputValue.trim());
    setActivating(false);
    if (success) setInputValue('');
  };

  const handleDeactivate = async () => {
    setShowConfirm(false);
    await deactivate();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(formatLicenseInput(e.target.value));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleActivate();
  };

  const statusBadge = () => {
    if (status === 'valid') return <Badge variant="active">Active</Badge>;
    if (status === 'expired') return <Badge variant="expired">Expired</Badge>;
    return <Badge variant="inactive">Not Activated</Badge>;
  };

  return (
    <>
      <div className="flex items-center gap-2 mt-0 mb-3">
        <h3 className="text-[13px] font-medium text-text-primary">License Activation</h3>
        {statusBadge()}
      </div>
      <div className="bg-app-surface rounded-lg p-3 border border-border">
        {(status === 'not_activated' || status === 'expired') && (
          <div className="flex flex-col gap-2">
            {status === 'expired' && (
              <div className="text-[11px] text-accent-red">
                Your license has expired. Please re-activate.
              </div>
            )}
            {error && (
              <div className="text-[11px] text-accent-red">{error}</div>
            )}
            <div className="text-[11px] text-text-muted">
              Enter your license key to activate VidTSX
            </div>
            <button
              className="text-[11px] text-accent hover:underline text-left w-fit"
              onClick={() => handleOpenLink('https://learnwithhasan.com/vidtsx')}
            >
              Get your free license key &rarr;
            </button>
            <div className="flex items-center gap-2">
              <TextInput
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="flex-1"
                disabled={activating || loading}
              />
              <Button
                variant="primary"
                onClick={handleActivate}
                disabled={activating || loading || inputValue.replace(/-/g, '').length === 0}
              >
                {activating ? 'Activating...' : 'Activate'}
              </Button>
            </div>
          </div>
        )}

        {status === 'valid' && (
          <div className="flex flex-col gap-2">
            {error && (
              <div className="text-[11px] text-accent-red">{error}</div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] text-text-muted mb-1">License Key</div>
                <div className="text-[12px] text-text-secondary font-mono">{licenseKey}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-text-muted mb-1">Plan</div>
                <div className="text-[12px] text-text-secondary capitalize">{tier || 'Free'}</div>
              </div>
            </div>
            {!showConfirm ? (
              <Button
                variant="secondary"
                onClick={() => setShowConfirm(true)}
                disabled={loading}
              >
                Deactivate
              </Button>
            ) : (
              <div className="flex flex-col gap-2 mt-1">
                <div className="text-[11px] text-text-muted">
                  Are you sure? You'll need to re-enter your key to use VidTSX features.
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={handleDeactivate} disabled={loading}>
                    {loading ? 'Deactivating...' : 'Yes, Deactivate'}
                  </Button>
                  <Button variant="secondary" onClick={() => setShowConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
