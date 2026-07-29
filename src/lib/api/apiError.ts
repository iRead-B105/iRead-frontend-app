export interface ApiErrorOptions {
  readonly message: string
  readonly status: number
  readonly code: string
  readonly responseBody?: unknown
  readonly originalError?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly responseBody?: unknown
  readonly originalError?: unknown

  constructor(options: ApiErrorOptions) {
    super(options.message)
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code
    this.responseBody = options.responseBody
    this.originalError = options.originalError
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
