import { HardwarePanel } from './HardwarePanel';
import { RuntimesTable } from './RuntimesTable';
import { StoragePanel } from './StoragePanel';

/**
 * The Overview section (docs/ai-models-redesign.md §3.1, formerly "System"):
 * Hardware and Storage side by side where the window allows, the Runtimes
 * table full width under them. The Audio / LLM / Embedding engine cards are
 * gone — hidden engines leave no trace.
 */
export function OverviewContent() {
  return (
    <div className="flex flex-col gap-4" data-overview-content>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <HardwarePanel />
        <StoragePanel />
      </div>
      <RuntimesTable />
    </div>
  );
}
