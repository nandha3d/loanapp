/**
 * A client-facing error that carries an HTTP status. Validation/refusal paths
 * throw this so route catch blocks can distinguish "invalid input / refused
 * operation" (a 4xx the mobile client branches on) from a genuine server fault
 * (500). Throw `new HttpError(400, 'Invalid auction type')` from validators.
 *
 * Deliberately dependency-free (no next/server) so pure-logic domain code and
 * tsx unit tests can import it without pulling in the Next.js runtime.
 */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}
