/**
 * SDK-specific error class. Thrown for any non-2xx HTTP response.
 */
export class CertrustApiError extends Error {
  readonly statusCode: number;
  readonly body: unknown;

  constructor(message: string, statusCode: number, body: unknown) {
    super(message);
    this.name = 'CertrustApiError';
    this.statusCode = statusCode;
    this.body = body;
  }
}
