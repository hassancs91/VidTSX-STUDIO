// Ambient module shims for third-party packages that don't ship .d.ts files.

// Vite's `?url` asset import — already declared by `electron-vite/client`,
// but a narrow declaration here keeps headless / temp-tsconfig type-checks
// happy without dragging in the full client types.
declare module '*.wasm?url' {
  const src: string;
  export default src;
}
