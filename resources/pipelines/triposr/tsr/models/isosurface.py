# VidTSX vendored copy — Stage 0 patch: torchmcubes (compiled CUDA/C++ extension)
# replaced by scikit-image's Lewiner marching cubes (pure wheel, no compiler).
#
# Axis order note (verified in lab RESULTS.md, "Orientation"):
#   grid_vertices is built with torch.meshgrid(x, y, z, indexing="ij") and flattened,
#   so level.view(R, R, R) is indexed [x, y, z].  skimage.measure.marching_cubes returns
#   vertices in array-index order (i, j, k) == (x, y, z), so NO axis permutation is needed.
#   torchmcubes returned (z, y, x), which is why upstream applied `v_pos[..., [2, 1, 0]]`;
#   that flip is intentionally dropped here.
from typing import Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
from skimage.measure import marching_cubes


class IsosurfaceHelper(nn.Module):
    points_range: Tuple[float, float] = (0, 1)

    @property
    def grid_vertices(self) -> torch.FloatTensor:
        raise NotImplementedError


class MarchingCubeHelper(IsosurfaceHelper):
    def __init__(self, resolution: int) -> None:
        super().__init__()
        self.resolution = resolution
        self._grid_vertices: Optional[torch.FloatTensor] = None

    @property
    def grid_vertices(self) -> torch.FloatTensor:
        if self._grid_vertices is None:
            # keep the vertices on CPU so that we can support very large resolution
            x, y, z = (
                torch.linspace(*self.points_range, self.resolution),
                torch.linspace(*self.points_range, self.resolution),
                torch.linspace(*self.points_range, self.resolution),
            )
            x, y, z = torch.meshgrid(x, y, z, indexing="ij")
            verts = torch.cat(
                [x.reshape(-1, 1), y.reshape(-1, 1), z.reshape(-1, 1)], dim=-1
            ).reshape(-1, 3)
            self._grid_vertices = verts
        return self._grid_vertices

    def forward(
        self,
        level: torch.FloatTensor,
    ) -> Tuple[torch.FloatTensor, torch.LongTensor]:
        # Upstream convention: caller passes -(density - threshold); we negate back so the
        # object interior is where the volume is > 0. NOTE: empirically skimage "descent" yields inward
        # normals here (trimesh volume < 0); "ascent" gives outward normals (volume > 0) — RESULTS.md.
        volume = (-level).view(self.resolution, self.resolution, self.resolution)
        volume_np = volume.detach().float().cpu().numpy()
        vmin, vmax = float(volume_np.min()), float(volume_np.max())
        if not (vmin < 0.0 < vmax):
            # marching_cubes raises on a constant/out-of-range volume; return an empty mesh
            return (
                torch.zeros((0, 3), dtype=torch.float32, device=level.device),
                torch.zeros((0, 3), dtype=torch.long, device=level.device),
            )
        verts, faces, _normals, _values = marching_cubes(
            volume_np, level=0.0, gradient_direction="ascent"
        )
        v_pos = torch.from_numpy(np.ascontiguousarray(verts, dtype=np.float32))
        t_pos_idx = torch.from_numpy(np.ascontiguousarray(faces, dtype=np.int64))
        v_pos = v_pos / (self.resolution - 1.0)
        return v_pos.to(level.device), t_pos_idx.to(level.device)
