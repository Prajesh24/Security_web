/**
 * Application error with an attached HTTP status code. Thrown by services and
 * translated into a JSON response by the central error handler. Using a single
 * error type lets us return clean, *generic* messages to clients (avoiding
 * information leakage) while logging details server-side.
 */
export class HttpError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'HttpError';
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}
