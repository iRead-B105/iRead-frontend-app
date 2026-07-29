import { ApiError } from './apiError'
import { createDownloadResult, type DownloadResult } from './download'
import { isAbortError } from './isAbortError'
import {
  hasResponseData,
  isErrorResponse,
  isSuccessResponse,
  type SuccessResponse,
} from './apiTypes'

export type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export type AccessTokenProvider = () =>
  | string
  | null
  | undefined
  | Promise<string | null | undefined>

export interface UnauthorizedContext {
  readonly requestRetried: boolean
}

export type AuthenticationRecoveryHandler = (
  error: ApiError,
  context: UnauthorizedContext,
) => boolean | Promise<boolean>

export type ApiErrorHandler = (error: ApiError) => void | Promise<void>

export interface ApiAuthHooks {
  readonly getAccessToken?: AccessTokenProvider
  readonly onUnauthorized?: AuthenticationRecoveryHandler
  readonly onError?: ApiErrorHandler
}

export interface ApiClientOptions extends ApiAuthHooks {
  readonly baseUrl?: string
  readonly fetch?: FetchImplementation
}

interface ParsedBody {
  readonly rawText: string
  readonly value: unknown
}

export interface ApiRequestOptions {
  readonly retryOnUnauthorized?: boolean
}

async function readResponseBody(response: Response): Promise<ParsedBody> {
  const rawText = await response.text()

  if (rawText === '') {
    return {
      rawText,
      value: undefined,
    }
  }

  try {
    return {
      rawText,
      value: JSON.parse(rawText) as unknown,
    }
  } catch {
    return {
      rawText,
      value: rawText,
    }
  }
}

function createResponseFormatError(response: Response, responseBody: unknown): ApiError {
  return new ApiError({
    status: response.status,
    code: 'INVALID_RESPONSE',
    message: '[API] 공통 성공 응답 형식이 올바르지 않습니다.',
    responseBody,
  })
}

function assertApiEndpoint(endpoint: string): void {
  if (!endpoint.startsWith('/api/')) {
    throw new TypeError(`[API] endpoint는 /api/... 형식이어야 합니다. 현재 값: ${endpoint}`)
  }
}

function isFormDataBody(body: BodyInit | null | undefined): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData
}

export class ApiClient {
  private readonly baseUrl: string
  private readonly fetchImplementation: FetchImplementation
  private authHooks: ApiAuthHooks

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? ''
    this.fetchImplementation = options.fetch ?? ((input, init) => fetch(input, init))
    this.authHooks = {
      getAccessToken: options.getAccessToken,
      onUnauthorized: options.onUnauthorized,
      onError: options.onError,
    }
  }

  configureAuth(hooks: ApiAuthHooks): void {
    this.authHooks = {
      getAccessToken: hooks.getAccessToken,
      onUnauthorized: hooks.onUnauthorized,
      onError: hooks.onError,
    }
  }

  async request<T>(
    endpoint: string,
    init: RequestInit = {},
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const response = await this.fetchSuccessfulResponse(endpoint, init, options, false)

    if (response.status === 204) {
      return undefined as T
    }

    const parsedBody = await readResponseBody(response)
    if (parsedBody.rawText === '') {
      return undefined as T
    }

    if (!isSuccessResponse(parsedBody.value)) {
      throw createResponseFormatError(response, parsedBody.value)
    }

    const successResponse = parsedBody.value as SuccessResponse<T>
    return hasResponseData(successResponse) ? successResponse.data : (undefined as T)
  }

  async download(endpoint: string, init: RequestInit = {}): Promise<DownloadResult> {
    const response = await this.fetchSuccessfulResponse(endpoint, init, {}, false)
    return createDownloadResult(response)
  }

  private async fetchSuccessfulResponse(
    endpoint: string,
    init: RequestInit,
    options: ApiRequestOptions,
    requestRetried: boolean,
  ): Promise<Response> {
    assertApiEndpoint(endpoint)

    const headers = new Headers(init.headers)
    if (isFormDataBody(init.body)) {
      headers.delete('Content-Type')
    } else if (typeof init.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const accessToken = await this.authHooks.getAccessToken?.()
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }

    let response: Response

    try {
      response = await this.fetchImplementation(`${this.baseUrl}${endpoint}`, {
        ...init,
        headers,
        credentials: 'include',
      })
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }

      const apiError = new ApiError({
        status: 0,
        code: 'NETWORK_ERROR',
        message: '[API] 서버에 연결할 수 없습니다.',
        originalError: error,
      })
      await this.authHooks.onError?.(apiError)
      throw apiError
    }

    if (response.ok) {
      return response
    }

    const parsedBody = await readResponseBody(response)
    const error = isErrorResponse(parsedBody.value)
      ? new ApiError({
          status: response.status,
          code: parsedBody.value.error.code,
          message: parsedBody.value.error.message,
          responseBody: parsedBody.value,
        })
      : new ApiError({
          status: response.status,
          code: `HTTP_${response.status}`,
          message: `요청을 처리하지 못했습니다. (${response.status})`,
          responseBody: parsedBody.value,
        })

    if (
      response.status === 401 &&
      options.retryOnUnauthorized !== false &&
      this.authHooks.onUnauthorized
    ) {
      const shouldRetry = await this.authHooks.onUnauthorized(error, { requestRetried })

      if (shouldRetry && !requestRetried) {
        return this.fetchSuccessfulResponse(endpoint, init, options, true)
      }
    }

    await this.authHooks.onError?.(error)
    throw error
  }
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value)
}
