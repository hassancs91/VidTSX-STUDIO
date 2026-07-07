export class OpenRouterHttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'OpenRouterHttpError';
  }
}
