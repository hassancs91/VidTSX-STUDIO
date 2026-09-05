"""Background-removal worker (rembg on onnxruntime, CPU).  python runner.py --request <json> | --selftest

Same protocol as triposr/runner.py (see ../common/protocol.py). Runs on CPU only: the shared
runtime ships the CPU build of onnxruntime, and u2net takes 1-4 s per image there, so no GPU
path is needed (docs/ai-runtime-implementation-plan.md §4 step 3).

Request (absolute paths):
  {
    "imagePath":  "...",            required - any image PIL can open (EXIF orientation honoured)
    "outputPath": "....png",        required - written as an RGBA PNG
    "rembgHome":  "...",            required - folder holding models/<model>/<model>.onnx
                                    (rembg 2.0.83 layout; the app downloads the file up front)
    "model":      "u2net",          optional - u2net | u2netp | isnet-general-use | silueta | birefnet-* ...
    "device":     "cpu",            optional, informational (always CPU in this runtime)
    "alphaMatting": false,          optional - pymatting refinement, slower, softer edges
    "postProcessMask": false,       optional - rembg's morphological clean-up of the mask
    "mattePath":  "....png"         optional - also write the alpha matte as an 8-bit grayscale PNG
  }

Events:  ready -> stage load-model -> stage process -> stage export -> result
Result stats: width, height, model, providers, seconds, stageSeconds, inputBytes, outputBytes.
Error codes: bad-request (missing field / input), weights-corrupt (model file missing or unreadable),
             import (runtime damaged), network (an undeclared file was fetched - app bug), unknown.
"""
import argparse
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "common"))   # protocol.py

# Offline by construction: nothing in a generation may touch the network.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("PYTHONUTF8", "1")

import protocol as P  # noqa: E402

T0 = time.perf_counter()
DEFAULT_MODEL = "u2net"


def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--request", type=str)
    ap.add_argument("--selftest", action="store_true")
    # Same as --selftest here: the selftest already imports everything this pipeline uses.
    ap.add_argument("--warmup", action="store_true")
    return ap.parse_args()


def emit_ready(ort, rembg_version: str):
    # No torch here on purpose: importing it costs ~3 s and background removal does not need it.
    P.emit({"type": "ready", "torch": None, "cuda": False, "device": "cpu", "vramMb": 0,
            "python": sys.version.split()[0], "onnxruntime": ort.__version__, "rembg": rembg_version,
            "providers": list(ort.get_available_providers()),
            "importSeconds": round(time.perf_counter() - T0, 2)})


def model_file(rembg_home: str, model: str) -> str:
    # rembg >= 2.0.7x layout: <home>/models/<name>/<name>.onnx (Stage 0 companion list).
    return os.path.join(rembg_home, "models", model, f"{model}.onnx")


def main():
    args = parse_args()
    P.install_cancel_handlers()
    selftest = args.selftest or args.warmup
    if not selftest and not args.request:
        raise P.RequestError("--request <file>, --selftest or --warmup is required")

    req = {} if selftest else P.read_request(args.request)
    if req.get("rembgHome"):
        os.environ["U2NET_HOME"] = req["rembgHome"]   # must precede `import rembg`; wins over REMBG_HOME

    import onnxruntime as ort  # noqa: E402
    import rembg  # noqa: E402
    from PIL import Image, ImageOps  # noqa: E402

    try:
        from importlib.metadata import version as _dist_version
        rembg_version = _dist_version("rembg")
    except Exception:  # noqa: BLE001
        rembg_version = "unknown"

    emit_ready(ort, rembg_version)
    if selftest:
        return

    for key in ("imagePath", "outputPath", "rembgHome"):
        if not req.get(key):
            raise P.RequestError(f"Request field '{key}' is required")
    if not os.path.isfile(req["imagePath"]):
        raise P.RequestError(f"Input image not found: {req['imagePath']}")
    model = str(req.get("model", DEFAULT_MODEL))
    stage_t = {}

    def timed(name):
        stage_t[name] = time.perf_counter()
        P.stage(name)

    def done(name):
        stage_t[name] = round(time.perf_counter() - stage_t[name], 2)

    # ---- load-model
    timed("load-model")
    onnx_path = model_file(req["rembgHome"], model)
    if not os.path.isfile(onnx_path):
        # Without this check rembg would try to download the file (network = app bug).
        raise P.WeightsError(f"Background-removal model file missing: {onnx_path}")
    if os.path.getsize(onnx_path) < 1024:
        raise P.WeightsError(f"Background-removal model file is truncated: {onnx_path}")
    providers = ["CPUExecutionProvider"]
    try:
        session = rembg.new_session(model, providers=providers)
    except Exception as exc:  # noqa: BLE001
        text = str(exc).lower()
        if "onnx" in text or "protobuf" in text or "invalid_graph" in text or "invalid_protobuf" in text or "no session class" in text:
            raise P.WeightsError(f"Cannot load background-removal model '{model}': {exc}") from exc
        raise
    done("load-model")

    # ---- process
    timed("process")
    image = ImageOps.exif_transpose(Image.open(req["imagePath"]))
    input_bytes = os.path.getsize(req["imagePath"])
    out = rembg.remove(
        image,
        session=session,
        alpha_matting=bool(req.get("alphaMatting", False)),
        post_process_mask=bool(req.get("postProcessMask", False)),
    )
    if out.mode != "RGBA":
        out = out.convert("RGBA")
    done("process")

    # ---- export
    timed("export")
    os.makedirs(os.path.dirname(os.path.abspath(req["outputPath"])), exist_ok=True)
    out.save(req["outputPath"], format="PNG")
    matte_path = req.get("mattePath")
    if matte_path:
        os.makedirs(os.path.dirname(os.path.abspath(matte_path)), exist_ok=True)
        out.getchannel("A").save(matte_path, format="PNG")
    done("export")

    P.result(req["outputPath"], {
        "width": int(out.width),
        "height": int(out.height),
        "model": model,
        "device": "cpu",
        "providers": providers,
        "mattePath": matte_path or None,
        "inputBytes": input_bytes,
        "outputBytes": os.path.getsize(req["outputPath"]),
        "seconds": round(time.perf_counter() - T0, 2),
        "stageSeconds": stage_t,
    })


if __name__ == "__main__":
    P.run_guarded(main)
