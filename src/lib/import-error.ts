// Thrown by the algorithm importers. Carries a code instead of a message so
// the UI can show it in the user's language.
export type ImportErrorCode = 'invalid-json' | 'unrecognized' | 'wrong-kind';

export class ImportError extends Error {
  readonly code: ImportErrorCode;

  constructor(code: ImportErrorCode) {
    super(`import failed: ${code}`);
    this.name = 'ImportError';
    this.code = code;
  }
}
