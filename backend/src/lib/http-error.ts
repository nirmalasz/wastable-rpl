/** Error with an HTTP status code. Throw it anywhere; the error handler turns it into JSON. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message = 'Bad request', details?: unknown) {
    return new HttpError(400, message, details);
  }
  static unauthorized(message = 'Unauthorized') {
    return new HttpError(401, message);
  }
  static forbidden(message = 'Forbidden') {
    return new HttpError(403, message);
  }
  static notFound(message = 'Not found') {
    return new HttpError(404, message);
  }
  static unprocessable(message = 'Unprocessable entity', details?: unknown) {
    return new HttpError(422, message, details);
  }
  static tooMany(message = 'Too many requests') {
    return new HttpError(429, message);
  }
  static conflict(message = 'Conflict') {
    return new HttpError(409, message);
  }
}
