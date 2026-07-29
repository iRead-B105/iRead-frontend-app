export interface SuccessResponseWithData<T> {
  readonly success: true
  readonly data: T
}

export interface SuccessResponseWithoutData {
  readonly success: true
  readonly data?: never
}

export type SuccessResponse<T> = SuccessResponseWithData<T> | SuccessResponseWithoutData

export interface ErrorDetail {
  readonly code: string
  readonly message: string
}

export interface ErrorResponse {
  readonly error: ErrorDetail
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isSuccessResponse(value: unknown): value is SuccessResponse<unknown> {
  return isRecord(value) && value.success === true
}

export function hasResponseData<T>(
  response: SuccessResponse<T>,
): response is SuccessResponseWithData<T> {
  return Object.prototype.hasOwnProperty.call(response, 'data')
}

export function isErrorResponse(value: unknown): value is ErrorResponse {
  if (!isRecord(value) || !isRecord(value.error)) {
    return false
  }

  return typeof value.error.code === 'string' && typeof value.error.message === 'string'
}
