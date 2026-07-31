import { learnerApiClient } from '@/features/learner/learnerApiClient'
import { isAbortError } from '@/lib/api/isAbortError'

export type RealtimeResource = 'STUDENT' | 'CURRICULUM' | 'TRAINING' | 'TEST' | 'STORY' | 'GAZE'
export type RealtimeConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface RealtimeEvent {
  readonly eventId: string
  readonly studentId: number
  readonly resource: RealtimeResource
  readonly resourceId: number | null
  readonly changeType: string
  readonly occurredAt: string
  readonly version: number
}

type StreamOpener = (
  endpoint: string,
  init?: RequestInit,
) => Promise<Response>

export interface RealtimeClientOptions {
  readonly endpoint: string
  readonly onEvent: (event: RealtimeEvent) => void | Promise<void>
  readonly onStateChange?: (state: RealtimeConnectionState) => void
  readonly openStream?: StreamOpener
  readonly reconnectDelayMs?: number
}

const RESOURCES = new Set<RealtimeResource>([
  'STUDENT',
  'CURRICULUM',
  'TRAINING',
  'TEST',
  'STORY',
  'GAZE',
])

function parseEvent(value: unknown): RealtimeEvent | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<RealtimeEvent>
  if (
    typeof candidate.eventId !== 'string'
    || typeof candidate.studentId !== 'number'
    || !RESOURCES.has(candidate.resource as RealtimeResource)
    || (candidate.resourceId !== null && typeof candidate.resourceId !== 'number')
    || typeof candidate.changeType !== 'string'
    || typeof candidate.occurredAt !== 'string'
    || typeof candidate.version !== 'number'
  ) {
    return null
  }
  return candidate as RealtimeEvent
}

function parseBlock(block: string): RealtimeEvent | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
  if (!data) return null
  try {
    return parseEvent(JSON.parse(data) as unknown)
  } catch {
    return null
  }
}

async function consumeStream(
  response: Response,
  onEvent: RealtimeClientOptions['onEvent'],
  signal: AbortSignal,
): Promise<void> {
  if (!response.body) throw new TypeError('[실시간 연동] SSE 응답 본문이 없습니다.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const blocks = buffer.split(/\r?\n\r?\n/)
      buffer = blocks.pop() ?? ''
      for (const block of blocks) {
        const event = parseBlock(block)
        if (event) await onEvent(event)
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function wait(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeoutId = globalThis.setTimeout(resolve, delayMs)
    signal.addEventListener('abort', () => {
      globalThis.clearTimeout(timeoutId)
      resolve()
    }, { once: true })
  })
}

export class RealtimeClient {
  private readonly options: RealtimeClientOptions
  private controller: AbortController | null = null
  private state: RealtimeConnectionState = 'disconnected'

  constructor(options: RealtimeClientOptions) {
    this.options = options
  }

  start(): void {
    if (this.controller) return
    this.controller = new AbortController()
    void this.run(this.controller.signal)
  }

  stop(): void {
    this.controller?.abort()
    this.controller = null
    this.setState('disconnected')
  }

  private async run(signal: AbortSignal): Promise<void> {
    let firstAttempt = true
    while (!signal.aborted) {
      this.setState(firstAttempt ? 'connecting' : 'reconnecting')
      try {
        const response = await (this.options.openStream
          ?? ((endpoint, init) => learnerApiClient.openStream(endpoint, init)))(
          this.options.endpoint,
          { signal },
        )
        firstAttempt = false
        this.setState('connected')
        await consumeStream(response, this.options.onEvent, signal)
      } catch (error) {
        if (signal.aborted || isAbortError(error)) return
      }
      if (!signal.aborted) {
        await wait(this.options.reconnectDelayMs ?? 1_000, signal)
      }
    }
  }

  private setState(state: RealtimeConnectionState): void {
    if (this.state === state) return
    this.state = state
    this.options.onStateChange?.(state)
  }
}
