# Content Safety Gate B — self-export of the pixel classifier to ONNX fp16.
#
# Exports Marqo/nsfw-image-detection-384 (ViT-tiny @384, Apache-2.0) from the
# HuggingFace safetensors weights to an fp16 ONNX graph with fp32 I/O, checked
# into resources/content-safety/ together with a metadata JSON (preprocessing
# constants, label order, sha256). Self-exporting instead of trusting a
# third-party ONNX is a supply-chain decision — see docs/CONTENT_SAFETY_DESIGN.md
# Rev 1 (decisions 3–4).
#
# One-time setup (Windows, from the repo root):
#   python -m venv .vidtsx-temp/onnx-venv
#   .vidtsx-temp/onnx-venv/Scripts/python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
#   .vidtsx-temp/onnx-venv/Scripts/python -m pip install timm onnx onnxconverter-common onnxruntime huggingface_hub safetensors
# Run:
#   .vidtsx-temp/onnx-venv/Scripts/python scripts/export-content-safety-model.py
#
# The script verifies torch-vs-ONNX parity on random inputs before writing the
# metadata, and fails loudly on any drift > 1e-2 in probability space.

import hashlib
import json
import os
import sys

import numpy as np
import onnx
import torch
import timm
from onnxconverter_common import float16

HF_MODEL = "Marqo/nsfw-image-detection-384"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "resources", "content-safety")
OUT_FP32 = os.path.join(OUT_DIR, "nsfw-image-detection-384.fp32.onnx")  # temp, deleted
OUT_FP16 = os.path.join(OUT_DIR, "nsfw-image-detection-384.fp16.onnx")
OUT_META = os.path.join(OUT_DIR, "model-config.json")
OPSET = 17


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    print(f"Loading {HF_MODEL} via timm…")
    # Unfused attention: fused SDPA traces to Cast/If nodes that break the
    # fp16 conversion; the manual matmul+softmax path exports cleanly and is
    # numerically identical.
    timm.layers.set_fused_attn(False)
    model = timm.create_model(f"hf_hub:{HF_MODEL}", pretrained=True)
    model.eval()

    data_cfg = timm.data.resolve_data_config({}, model=model)
    pretrained_cfg = getattr(model, "pretrained_cfg", {}) or {}
    label_names = pretrained_cfg.get("label_names")
    if not label_names:
        # Fall back to the hub config.json
        from huggingface_hub import hf_hub_download

        with open(hf_hub_download(HF_MODEL, "config.json"), "r", encoding="utf-8") as f:
            hub_cfg = json.load(f)
        label_names = hub_cfg.get("label_names") or [
            v for _, v in sorted((hub_cfg.get("id2label") or {}).items(), key=lambda kv: int(kv[0]))
        ]
    if not label_names:
        sys.exit("FATAL: could not resolve label names — refusing to guess NSFW index")
    print("labels:", label_names, "| data config:", data_cfg)

    size = data_cfg["input_size"]  # (3, H, W)
    example = torch.randn(1, *size)

    print("Exporting fp32 ONNX…")
    torch.onnx.export(
        model,
        example,
        OUT_FP32,
        input_names=["pixel_values"],
        output_names=["logits"],
        dynamic_axes={"pixel_values": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=OPSET,
        dynamo=False,
    )

    print("Converting to fp16 (fp32 I/O kept)…")
    m32 = onnx.load(OUT_FP32)
    m16 = float16.convert_float_to_float16(m32, keep_io_types=True)
    onnx.save(m16, OUT_FP16)
    os.remove(OUT_FP32)

    print("Verifying parity torch vs fp16 ONNX…")
    import onnxruntime as ort

    sess = ort.InferenceSession(OUT_FP16, providers=["CPUExecutionProvider"])
    max_drift = 0.0
    for _ in range(8):
        x = torch.randn(1, *size)
        with torch.no_grad():
            p_torch = torch.softmax(model(x), dim=1).numpy()
        logits = sess.run(["logits"], {"pixel_values": x.numpy()})[0]
        e = np.exp(logits - logits.max(axis=1, keepdims=True))
        p_onnx = e / e.sum(axis=1, keepdims=True)
        max_drift = max(max_drift, float(np.abs(p_torch - p_onnx).max()))
    print(f"max probability drift: {max_drift:.6f}")
    if max_drift > 1e-2:
        sys.exit("FATAL: fp16 drift exceeds 1e-2 — do not ship this export")

    with open(OUT_FP16, "rb") as f:
        sha256 = hashlib.sha256(f.read()).hexdigest()

    meta = {
        "source": HF_MODEL,
        "license": "Apache-2.0",
        "file": os.path.basename(OUT_FP16),
        "sha256": sha256,
        "opset": OPSET,
        "inputName": "pixel_values",
        "outputName": "logits",
        "inputSize": list(size),  # [channels, height, width]
        "mean": list(data_cfg["mean"]),
        "std": list(data_cfg["std"]),
        "interpolation": data_cfg.get("interpolation", "bicubic"),
        "labels": list(label_names),
        "nsfwIndex": [i for i, name in enumerate(label_names) if str(name).lower() == "nsfw"][0],
        "maxParityDrift": max_drift,
        "exportedWith": {
            "torch": torch.__version__,
            "timm": timm.__version__,
            "onnx": onnx.__version__,
        },
    }
    with open(OUT_META, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
        f.write("\n")

    print(f"OK: {OUT_FP16} ({os.path.getsize(OUT_FP16) / 1e6:.1f} MB)")
    print(f"sha256 {sha256}")


if __name__ == "__main__":
    main()
