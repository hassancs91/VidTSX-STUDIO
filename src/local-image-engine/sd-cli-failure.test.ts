import { describe, expect, it } from 'vitest';
import { classifySdCliFailure, SdCliError } from './sd-cli-failure';

// The real truncated-download failure that motivated this classifier (A3):
// sd.cpp parses the gguf header fine, then dies reading tensor data.
const TRUNCATED_GGUF_OUTPUT = `
[INFO ] stable-diffusion.cpp:159  - loading model from 'D:\\models\\image\\sd3.5_medium.gguf'
[INFO ] model.cpp:1042 - load D:\\models\\image\\sd3.5_medium.gguf using gguf format
[DEBUG] model.cpp:1059 - init from 'D:\\models\\image\\sd3.5_medium.gguf'
[ERROR] model.cpp:2295 - read tensor data failed: 'D:\\models\\image\\sd3.5_medium.gguf'
[ERROR] stable-diffusion.cpp:559  - load tensors from model loader failed
`;

describe('classifySdCliFailure', () => {
  it('classifies the truncated-model "read tensor data failed" block as corrupt-model', () => {
    const failure = classifySdCliFailure(1, TRUNCATED_GGUF_OUTPUT);
    expect(failure.code).toBe('corrupt-model');
    expect(failure.message).toBe(
      'This model file looks incomplete or corrupt. Delete it and re-download.',
    );
  });

  it.each([
    'load tensors from model loader failed',
    '[ERROR] stable-diffusion.cpp:559 - failed to load model',
    '[ERROR] model.cpp:1061 - init model loader from file failed: bad header',
  ])('classifies "%s" as corrupt-model', (output) => {
    expect(classifySdCliFailure(1, output).code).toBe('corrupt-model');
  });

  it('is case-insensitive', () => {
    expect(classifySdCliFailure(1, 'Read Tensor Data FAILED').code).toBe('corrupt-model');
  });

  it.each([
    'ggml_backend_cuda_buffer_type_alloc_buffer: allocating 4370.00 MiB on device 0: cudaMalloc failed: out of memory',
    'ggml_vulkan: Device memory allocation of size 4831838208 failed.\nggml_vulkan: vk::Device::allocateMemory: ErrorOutOfDeviceMemory',
    'ggml_gallocr_reserve_n: failed to allocate Vulkan0 buffer of size 6442450944',
    'CUDA error: out of memory',
  ])('classifies OOM output as out-of-memory', (output) => {
    const failure = classifySdCliFailure(1, output);
    expect(failure.code).toBe('out-of-memory');
    expect(failure.message).toBe(
      'Ran out of GPU memory. Enable CPU offload or choose a smaller model.',
    );
  });

  it.each([
    '[ERROR] model.cpp:1817 - unknown architecture: qwen_image',
    '[ERROR] stable-diffusion.cpp - unsupported model type',
  ])('classifies "%s" as unsupported-model', (output) => {
    const failure = classifySdCliFailure(1, output);
    expect(failure.code).toBe('unsupported-model');
    expect(failure.message).toContain('needs a newer sd-cli build');
  });

  it('prefers unsupported-model over corrupt-model when both signatures appear', () => {
    const output = 'unknown architecture: wan2.2\nfailed to load model';
    expect(classifySdCliFailure(1, output).code).toBe('unsupported-model');
  });

  it('classifies a spawn failure (missing binary) as missing-dll', () => {
    const failure = classifySdCliFailure(
      null,
      'sd-cli process error: spawn D:\\app\\resources\\binaries\\sd-cli.exe ENOENT',
    );
    expect(failure.code).toBe('missing-dll');
    expect(failure.message).toBe(
      "sd-cli couldn't start — its binary or DLLs are missing or mismatched.",
    );
  });

  it('classifies a missing-DLL message as missing-dll', () => {
    const output = 'The code execution cannot proceed because ggml-vulkan.dll was not found.';
    expect(classifySdCliFailure(1, output).code).toBe('missing-dll');
  });

  it.each([
    0xc0000135, // STATUS_DLL_NOT_FOUND, unsigned as Node reports on Windows
    -1073741515, // same, signed
    0xc0000139, // STATUS_ENTRYPOINT_NOT_FOUND (mismatched DLL set)
  ])('classifies exit code %d with no output as missing-dll', (exitCode) => {
    expect(classifySdCliFailure(exitCode, '').code).toBe('missing-dll');
  });

  it('classifies a null exit code with unremarkable output as cancelled', () => {
    const failure = classifySdCliFailure(null, 'sampling: step 3/20');
    expect(failure.code).toBe('cancelled');
    expect(failure.message).toBe('Generation was cancelled.');
  });

  it('falls back to unknown with the exit code in the message', () => {
    const failure = classifySdCliFailure(1, 'some output the classifier has never seen');
    expect(failure.code).toBe('unknown');
    expect(failure.message).toContain('exit code 1');
  });
});

describe('SdCliError', () => {
  it('carries code + raw details and appends the hint to the message', () => {
    const err = new SdCliError(classifySdCliFailure(1, 'nothing recognizable'), 'raw tail here');
    expect(err.code).toBe('unknown');
    expect(err.details).toBe('raw tail here');
    expect(err.message).toContain('exit code 1');
    expect(err.message).toContain('See details');
  });

  it('uses the friendly message alone when there is no hint', () => {
    const err = new SdCliError(classifySdCliFailure(1, TRUNCATED_GGUF_OUTPUT), 'raw');
    expect(err.message).toBe(
      'This model file looks incomplete or corrupt. Delete it and re-download.',
    );
  });
});
