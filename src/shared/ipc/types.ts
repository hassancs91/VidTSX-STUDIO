// Barrel re-export of every IPC request/response/event type.
// The actual definitions live in ./types/<feature>.ts. This file exists so
// existing `import { ... } from '@shared/ipc/types'` call sites keep working.
export * from './types/index';
