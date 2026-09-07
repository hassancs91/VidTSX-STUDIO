export class BytePlusHttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    /** ModelArk error code, e.g. `InvalidParameter.TaskTypeConstraint`. */
    public readonly code?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'BytePlusHttpError';
  }
}
