import type { TreeNode } from "./types";

export const mockFileTree: TreeNode[] = [
  {
    id: "folder-intros",
    name: "Intros",
    type: "folder",
    path: "Intros",
    mtimeMs: 0,
    children: [
      { id: "file-1", name: "GlitchIntro.tsx", type: "file", path: "Intros/GlitchIntro.tsx", mtimeMs: 0 },
      { id: "file-2", name: "SlideReveal.tsx", type: "file", path: "Intros/SlideReveal.tsx", mtimeMs: 0 },
    ],
  },
  {
    id: "folder-social",
    name: "Social",
    type: "folder",
    path: "Social",
    mtimeMs: 0,
    children: [{ id: "file-3", name: "ReelsCTA.tsx", type: "file", path: "Social/ReelsCTA.tsx", mtimeMs: 0 }],
  },
];
