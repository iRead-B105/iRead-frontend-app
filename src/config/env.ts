export type DataSource = 'mock' | 'api'

export interface LearnerEnvironment {
  readonly learnerDataSource: DataSource
  readonly apiBaseUrl: string
  readonly backendUrl: string
}

export interface LearnerEnvironmentInput {
  readonly VITE_LEARNER_DATA_SOURCE?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_BACKEND_URL?: string
}

function parseSource(value: string | undefined): DataSource {
  if (value === undefined || value === '') return 'mock'
  if (value === 'mock' || value === 'api') return value
  throw new TypeError(
    `[아동 환경설정] VITE_LEARNER_DATA_SOURCE는 mock 또는 api여야 합니다. 현재 값: ${value}`,
  )
}

function parseOrigin(value: string | undefined, name: string): string {
  if (!value) return ''
  const parsed = new URL(value)
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash ||
    value.endsWith('/')
  ) {
    throw new TypeError(`[아동 환경설정] ${name}에는 HTTP(S) origin만 지정할 수 있습니다.`)
  }
  return parsed.origin
}

export function resolveLearnerEnvironment(
  input: LearnerEnvironmentInput,
  options: { requireBackendOrigin?: boolean } = {},
): LearnerEnvironment {
  const learnerDataSource = parseSource(input.VITE_LEARNER_DATA_SOURCE)
  const apiBaseUrl = parseOrigin(input.VITE_API_BASE_URL, 'VITE_API_BASE_URL')
  const backendUrl = parseOrigin(input.VITE_BACKEND_URL, 'VITE_BACKEND_URL')

  if (options.requireBackendOrigin && learnerDataSource === 'api' && !apiBaseUrl && !backendUrl) {
    throw new TypeError(
      '[아동 환경설정] 로컬 API 모드에는 VITE_BACKEND_URL이 필요합니다.',
    )
  }

  return { learnerDataSource, apiBaseUrl, backendUrl }
}
