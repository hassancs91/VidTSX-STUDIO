// Which ports the canvas draws (ruling D-r22 (2)). A `recordOnly` output (the decide / gate nodes' `p`) is filed in the run record by the
// flow runner but never drawn — no handle, so it cannot be wired and its number never shows on the canvas.

import type { PortDef } from '@shared/types/flows';

export function drawnPorts(ports: readonly PortDef[]): PortDef[] {
  return ports.filter((port) => !port.recordOnly);
}
