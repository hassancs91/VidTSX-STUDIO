"""VidTSX worker protocol (plan §1.3): JSON lines on stdout, raw log on stderr.

Events:
  {"type":"ready","torch":..,"cuda":bool,"device":..,"vramMb":..}
      ("torch" is null for pipelines that do not import torch, e.g. rembg on onnxruntime)
  {"type":"stage","name":..}
  {"type":"progress","stage":..,"pct":..}
  {"type":"result","outputPath":..,"stats":{..}}
  {"type":"error","code":..,"message":..}
Error codes: oom | cuda-mismatch | import | weights-corrupt | cancelled | bad-request | network | unknown
  network = a worker tried to reach the internet. Every file a pipeline touches is declared in the
  app's catalogue and downloaded up front, so this is an app bug (undeclared companion), not a
  user error (Stage 0 "MUST change" #5).
"""
import json
import os
import signal
import sys
import traceback
import zipfile

ERROR_CODES = ("oom", "cuda-mismatch", "import", "weights-corrupt", "cancelled", "bad-request", "network", "unknown")

# Take a private copy of fd 1 for protocol lines, then point Python's stdout at stderr so
# any library print() cannot corrupt the JSON stream.
_proto = os.fdopen(os.dup(1), "w", encoding="utf-8", buffering=1, newline="\n")
sys.stdout = sys.stderr
try:
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass


def emit(event: dict) -> None:
    _proto.write(json.dumps(event, ensure_ascii=False) + "\n")
    _proto.flush()


def log(msg: str) -> None:
    sys.stderr.write(msg.rstrip("\n") + "\n")
    sys.stderr.flush()


def stage(name: str) -> None:
    emit({"type": "stage", "name": name})


def progress(stage_name: str, pct: float) -> None:
    emit({"type": "progress", "stage": stage_name, "pct": int(max(0, min(100, round(pct))))})


def result(output_path: str, stats: dict) -> None:
    emit({"type": "result", "outputPath": output_path, "stats": stats})


def error(code: str, message: str, exit_code: int = 1) -> None:
    if code not in ERROR_CODES:
        code = "unknown"
    emit({"type": "error", "code": code, "message": message})
    _proto.flush()
    sys.exit(exit_code)


class RequestError(Exception):
    """A problem with the request itself (missing input file, bad field)."""


class WeightsError(Exception):
    """Weights file present but unreadable / wrong shape."""


def read_request(path: str) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            req = json.load(fh)
    except (OSError, ValueError) as exc:
        raise RequestError(f"Cannot read request file {path}: {exc}") from exc
    if not isinstance(req, dict):
        raise RequestError("Request JSON must be an object")
    return req


def _msg(exc: BaseException) -> str:
    text = str(exc).strip() or exc.__class__.__name__
    first = text.splitlines()[0]
    return first[:600]


def classify(exc: BaseException) -> tuple[str, str]:
    """Map an exception to (code, human message). Order matters: most specific first."""
    name = exc.__class__.__name__
    text = str(exc)
    low = text.lower()

    if isinstance(exc, KeyboardInterrupt):
        return "cancelled", "Generation was cancelled."
    if isinstance(exc, RequestError):
        return "bad-request", _msg(exc)
    if isinstance(exc, WeightsError):
        return "weights-corrupt", _msg(exc)
    if isinstance(exc, MemoryError) or name == "OutOfMemoryError" or "out of memory" in low or "cuda oom" in low:
        return "oom", "Ran out of memory (" + ("GPU" if "cuda" in low or name == "OutOfMemoryError" else "RAM") + "). Try a lower mesh resolution or the CPU runtime. " + _msg(exc)
    if any(k in low for k in ("no kernel image", "cudaerrorinsufficientdriver", "driver version is insufficient",
                              "cuda driver", "not compatible with the current pytorch", "cuda capability",
                              "cudnn_status", "cublas_status_not_initialized", "cuda error")):
        return "cuda-mismatch", "The GPU driver and the bundled CUDA runtime do not match. Update the NVIDIA driver or use the CPU runtime. " + _msg(exc)
    if name in ("ConnectionError", "ConnectTimeout", "ReadTimeout", "MaxRetryError", "NewConnectionError",
                "URLError", "SSLError", "ProxyError", "HfHubHTTPError", "RepositoryNotFoundError",
                "LocalEntryNotFoundError", "OfflineModeIsEnabled") or any(
        k in low for k in ("getaddrinfo failed", "max retries exceeded", "name resolution", "connection refused",
                           "network is unreachable", "hf_hub_offline", "offline mode is enabled")):
        return "network", "A file this model needs was not downloaded up front, so the worker tried to reach the internet. This is an app bug (undeclared companion file) - please report it. " + _msg(exc)
    if isinstance(exc, (ImportError, ModuleNotFoundError)) or (isinstance(exc, OSError) and ("dll" in low or "winerror 126" in low or "winerror 193" in low)):
        return "import", "The AI runtime is incomplete or damaged (" + _msg(exc) + "). Use Repair on the AI Runtime row."
    if isinstance(exc, (zipfile.BadZipFile, EOFError)) or name in ("UnpicklingError", "PytorchStreamReader") or any(
        k in low for k in ("pytorchstreamreader", "central directory", "unexpected eof", "invalid load key",
                           "failed to read", "corrupt", "missing key(s)", "unexpected key(s)", "size mismatch",
                           "checksum", "magic number", "storage has wrong size")):
        return "weights-corrupt", "The model weights are damaged or incomplete. Re-download the model. " + _msg(exc)
    if isinstance(exc, FileNotFoundError):
        return "bad-request", _msg(exc)
    return "unknown", f"{name}: {_msg(exc)}"


def install_cancel_handlers() -> None:
    def _handler(signum, _frame):  # noqa: ANN001
        raise KeyboardInterrupt()

    for sig in ("SIGINT", "SIGBREAK", "SIGTERM"):
        if hasattr(signal, sig):
            try:
                signal.signal(getattr(signal, sig), _handler)
            except Exception:  # noqa: BLE001
                pass


def run_guarded(fn) -> None:
    """Run fn(); turn any exception into a protocol error line with a traceback on stderr."""
    try:
        fn()
    except SystemExit:
        raise
    except BaseException as exc:  # noqa: BLE001
        log(traceback.format_exc())
        code, message = classify(exc)
        error(code, message)
