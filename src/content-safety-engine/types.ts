/** Content Safety Gate B — worker protocol and model metadata types. */

/** Shape of resources/content-safety/model-config.json (written by the export script). */
export interface SafetyModelConfig {
  source: string;
  file: string;
  sha256: string;
  inputName: string;
  outputName: string;
  /** [channels, height, width] */
  inputSize: [number, number, number];
  mean: number[];
  std: number[];
  labels: string[];
  nsfwIndex: number;
}

export type SafetyWorkerRequest =
  | { type: 'loadModel'; modelPath: string; config: SafetyModelConfig }
  | {
      type: 'classify';
      requestId: string;
      /** Raw RGB24 bytes at exactly the model's input height×width. */
      rgb: Uint8Array;
    };

export type SafetyWorkerResponse =
  | { type: 'modelLoaded' }
  | { type: 'classifyResult'; requestId: string; nsfwProbability: number }
  | { type: 'error'; requestId?: string; error: string };
