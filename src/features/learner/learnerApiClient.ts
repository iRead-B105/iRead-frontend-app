import { appEnvironment } from '@/config/runtimeEnv'
import { createApiClient, type ApiAuthHooks } from '@/lib/api'

export const learnerApiClient = createApiClient({
  baseUrl: appEnvironment.apiBaseUrl,
})

export function configureLearnerApiAuth(hooks: ApiAuthHooks): void {
  learnerApiClient.configureAuth(hooks)
}
