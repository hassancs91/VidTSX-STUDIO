"""TripoSR worker (VidTSX plan §1.2/§1.3).  python runner.py --request <json> | --selftest"""
import argparse
import itertools
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)                                            # tsr/
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "common"))   # protocol.py

# Offline by construction: nothing in a generation may touch the network.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("PYTHONUTF8", "1")

import protocol as P  # noqa: E402

T0 = time.perf_counter()


def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--request", type=str)
    ap.add_argument("--selftest", action="store_true")
    # --warmup: selftest + import the whole pipeline (transformers, rembg, skimage, trimesh) and exit.
    # The app runs it once after installing the runtime so the first launch of fresh files
    # (Defender scan + .pyc compilation, ~100 s in Stage 0) happens then, not on the user's
    # first generation.
    ap.add_argument("--warmup", action="store_true")
    return ap.parse_args()


def pick_device(want: str):
    import torch

    if want == "cpu":
        return "cpu"
    if torch.cuda.is_available():
        return "cuda:0"
    if want == "cuda":
        raise RuntimeError("CUDA requested but torch.cuda.is_available() is False (CUDA error: no usable GPU)")
    return "cpu"


def emit_ready(torch):
    cuda = bool(torch.cuda.is_available())
    dev = torch.cuda.get_device_name(0) if cuda else "cpu"
    vram = int(torch.cuda.get_device_properties(0).total_memory // (1024 * 1024)) if cuda else 0
    P.emit({"type": "ready", "torch": torch.__version__, "cuda": cuda, "device": dev, "vramMb": vram,
            "python": sys.version.split()[0], "importSeconds": round(time.perf_counter() - T0, 2)})


def main():
    args = parse_args()
    P.install_cancel_handlers()
    if not args.selftest and not args.warmup and not args.request:
        raise P.RequestError("--request <file>, --selftest or --warmup is required")

    req = {} if (args.selftest or args.warmup) else P.read_request(args.request)
    if req.get("rembgHome"):
        os.environ["U2NET_HOME"] = req["rembgHome"]   # must precede `import rembg`

    import torch  # noqa: E402  (the expensive import; cold-start is measured up to `ready`)

    emit_ready(torch)
    if args.selftest:
        return

    P.stage("import")
    import numpy as np
    from PIL import Image, ImageOps
    import trimesh
    from tsr.system import TSR
    from tsr.utils import remove_background, resize_foreground, scale_tensor, get_spherical_cameras

    if args.warmup:
        import rembg  # noqa: F401  (onnxruntime + pymatting/numba, the other slow first import)
        import skimage.measure  # noqa: F401
        P.emit({"type": "result", "outputPath": None,
                "stats": {"warmup": True, "seconds": round(time.perf_counter() - T0, 2)}})
        return

    for key in ("imagePath", "outputPath", "modelDir", "dinoConfigPath"):
        if not req.get(key):
            raise P.RequestError(f"Request field '{key}' is required")
    if not os.path.isfile(req["imagePath"]):
        raise P.RequestError(f"Input image not found: {req['imagePath']}")
    mc_res = int(req.get("mcResolution", 256))
    threshold = float(req.get("threshold", 25.0))
    chunk = int(req.get("chunkSize", 8192))
    device = pick_device(str(req.get("device", "auto")))
    stage_t = {}

    def timed(name):
        stage_t[name] = time.perf_counter()
        P.stage(name)

    def done(name):
        stage_t[name] = round(time.perf_counter() - stage_t[name], 2)

    if device.startswith("cuda"):
        torch.cuda.reset_peak_memory_stats()

    # ---- load-model
    timed("load-model")
    ckpt_path = os.path.join(req["modelDir"], "model.ckpt")
    if not os.path.isfile(ckpt_path):
        raise P.WeightsError(f"model.ckpt missing in {req['modelDir']}")
    model = TSR.from_local(req["modelDir"], req["dinoConfigPath"])
    model.renderer.set_chunk_size(chunk)
    model.to(device)
    model.eval()
    done("load-model")

    # ---- preprocess
    timed("preprocess")
    image = ImageOps.exif_transpose(Image.open(req["imagePath"]))
    if req.get("removeBackground", True):
        import rembg  # noqa: E402  (may fetch u2net.onnx unless U2NET_HOME has it)

        session = rembg.new_session(str(req.get("rembgModel", "u2net")))
        image = remove_background(image, session)
        image = resize_foreground(image, float(req.get("foregroundRatio", 0.85)))
        arr = np.array(image).astype(np.float32) / 255.0
        arr = arr[:, :, :3] * arr[:, :, 3:4] + (1 - arr[:, :, 3:4]) * 0.5
        image = Image.fromarray((arr * 255.0).astype(np.uint8))
    else:
        image = image.convert("RGB")
    pre_path = os.path.splitext(req["outputPath"])[0] + ".input.png"
    os.makedirs(os.path.dirname(os.path.abspath(req["outputPath"])), exist_ok=True)
    image.save(pre_path)
    done("preprocess")

    # ---- encode (image -> triplane scene codes)
    timed("encode")
    with torch.no_grad():
        scene_codes = model([image], device=device)
    done("encode")

    # ---- shape: slab-wise density query (progress), marching cubes, vertex colours
    timed("shape")
    model.set_marching_cubes_resolution(mc_res)
    helper = model.isosurface_helper
    radius = model.renderer.cfg.radius
    # Grid points are generated per x-slab instead of materialising helper.grid_vertices
    # (a full R^3 x 3 float grid is 12.9 GB of host RAM at R=1024); same index order (x-major).
    n_slabs = max(1, min(mc_res, int(req.get("progressSlabs", 16))))
    rows_per_slab = (mc_res + n_slabs - 1) // n_slabs
    axis = torch.linspace(*helper.points_range, mc_res)
    densities = []
    scene_code = scene_codes[0]
    with torch.no_grad():
        for s in range(n_slabs):
            x0, x1 = s * rows_per_slab, min(mc_res, (s + 1) * rows_per_slab)
            if x0 >= x1:
                break
            gx, gy, gz = torch.meshgrid(axis[x0:x1], axis, axis, indexing="ij")
            pts = torch.stack([gx.reshape(-1), gy.reshape(-1), gz.reshape(-1)], dim=-1).to(device)
            pts = scale_tensor(pts, helper.points_range, (-radius, radius))
            densities.append(model.renderer.query_triplane(model.decoder, pts, scene_code)["density_act"])
            P.progress("shape", 100.0 * (s + 1) / n_slabs)
        density = torch.cat(densities, dim=0)
        del densities
    v_pos, t_pos_idx = helper(-(density - threshold))
    if v_pos.shape[0] == 0:
        raise RuntimeError("Marching cubes produced no surface (empty mesh)")
    v_pos = scale_tensor(v_pos, helper.points_range, (-radius, radius))
    with torch.no_grad():
        color = model.renderer.query_triplane(model.decoder, v_pos, scene_code)["color"]
    mesh = trimesh.Trimesh(vertices=v_pos.cpu().numpy(), faces=t_pos_idx.cpu().numpy(),
                           vertex_colors=color.cpu().numpy())
    done("shape")

    # ---- export
    timed("export")
    mesh.export(req["outputPath"])
    done("export")

    stats = {
        "vertices": int(mesh.vertices.shape[0]),
        "faces": int(mesh.faces.shape[0]),
        "watertight": bool(mesh.is_watertight),
        "windingConsistent": bool(mesh.is_winding_consistent),
        "volume": float(mesh.volume) if mesh.is_watertight else None,
        "outputBytes": os.path.getsize(req["outputPath"]),
        "device": device,
        "mcResolution": mc_res,
        "seconds": round(time.perf_counter() - T0, 2),
        "stageSeconds": stage_t,
        "peakVramMb": int(torch.cuda.max_memory_allocated() // (1024 * 1024)) if device.startswith("cuda") else 0,
        "peakVramReservedMb": int(torch.cuda.max_memory_reserved() // (1024 * 1024)) if device.startswith("cuda") else 0,
    }

    if req.get("orientationCheck"):
        # (a) density at the mesh vertices must sit on the iso-level for the identity axis order
        #     and NOT for any other permutation of (x, y, z).
        perms = {}
        with torch.no_grad():
            for perm in itertools.permutations(range(3)):
                p = v_pos[:, list(perm)]
                d = model.renderer.query_triplane(model.decoder, p, scene_code)["density_act"].flatten()
                perms["".join("xyz"[i] for i in perm)] = float((d - threshold).abs().median())
        # (b) red-painted (viewer-left) vertices should lie on the camera-left side of view 0
        rays_o, rays_d = get_spherical_cameras(1, 0.0, 1.9, 40.0, 64, 64)
        right = (rays_d[0, 32, 63] - rays_d[0, 32, 0]).numpy()
        right = right / (np.linalg.norm(right) + 1e-8)
        fwd = rays_d[0, 32, 32].numpy()
        vc = np.asarray(mesh.visual.vertex_colors[:, :3], dtype=np.float32) / 255.0
        is_red = (vc[:, 0] > 0.55) & (vc[:, 1] < 0.4) & (vc[:, 2] < 0.4)
        verts = np.asarray(mesh.vertices)
        red_mean = float((verts[is_red] @ right).mean()) if is_red.any() else None
        other_mean = float((verts[~is_red] @ right).mean()) if (~is_red).any() else None
        # NeRF render at view 0 for a human eyeball check against the input photo
        render_path = os.path.splitext(req["outputPath"])[0] + ".nerf_view0.png"
        model.render(scene_codes, n_views=1, return_type="pil", height=256, width=256)[0][0].save(render_path)
        stats["orientation"] = {
            "medianAbsDensityMinusThresholdByPerm": perms,
            "bestPerm": min(perms, key=perms.get),
            "cameraRightWorld": [float(x) for x in right],
            "cameraForwardWorld": [float(x) for x in fwd],
            "redVertexCount": int(is_red.sum()),
            "redMeanAlongRight": red_mean,
            "otherMeanAlongRight": other_mean,
            "nerfView0": render_path,
        }

    P.result(req["outputPath"], stats)


if __name__ == "__main__":
    P.run_guarded(main)
