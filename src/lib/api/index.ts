import { appEnvironment } from '@/config/runtimeEnv'
import {
  ApiClient,
  type ApiAuthHooks,
  type ApiClientOptions,
  type ApiRequestOptions,
} from './apiClient'
import type { DownloadResult } from './download'

export * from './apiClient'
export * from './apiError'
export * from './apiTypes'
export * from './download'
export * from './isAbortError'

export const apiClient = new ApiClient({
  baseUrl: appEnvironment.apiBaseUrl,
})

export function configureApiAuth(hooks: ApiAuthHooks): void {
  apiClient.configureAuth(hooks)
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  return new ApiClient(options)
}

export function apiRequest<T>(
  endpoint: string,
  init: RequestInit = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  return apiClient.request<T>(endpoint, init, options)
}

export function downloadFile(endpoint: string, init: RequestInit = {}): Promise<DownloadResult> {
  return apiClient.download(endpoint, init)
}
