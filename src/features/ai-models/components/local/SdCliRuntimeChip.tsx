import { useSdCliRuntime } from '../../hooks/useSdCliRuntime';
import { describeRuntimeInstall } from '../../services/download-labels';
import { LocalRuntimeChip } from './LocalRuntimeChip';

/**
 * The sd-cli chip the Image and Video strips share: stable-diffusion.cpp is one
 * runtime for both categories, so an install started on either page fills the
 * same bar on the other.
 */
export function SdCliRuntimeChip() {
  const cli = useSdCliRuntime();
  const state = cli.loading ? 'checking' : cli.install ? 'installing' : cli.installed ? 'installed' : 'missing';
  return (
    <LocalRuntimeChip
      id="sd-cli"
      name="sd-cli"
      description="stable-diffusion.cpp — generates images and video on your GPU. Downloaded once from the official release (~36 MB)."
      state={state}
      detail={state === 'missing' ? 'Needed to generate · ~36 MB' : undefined}
      actionLabel={state === 'missing' ? 'Install' : undefined}
      onAction={() => void cli.installCli()}
      progress={cli.install?.progress ?? null}
      progressLabel={cli.install ? describeRuntimeInstall(cli.install) : undefined}
      error={cli.error}
    />
  );
}
