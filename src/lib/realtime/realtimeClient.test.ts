import { describe, expect, it, vi } from 'vitest'
import { RealtimeClient } from './realtimeClient'

function eventStream(payload: unknown): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: student-data-changed\ndata: ${JSON.stringify(payload)}\n\n`))
      controller.close()
    },
  })
}

describe('RealtimeClient', () => {
  it('SSE 데이터 이벤트를 구조화된 변경 이벤트로 전달한다', async () => {
    const payload = {
      eventId: 'event-1',
      studentId: 2001,
      resource: 'CURRICULUM',
      resourceId: 190001,
      changeType: 'UPDATED',
      occurredAt: '2026-07-31T10:00:00Z',
      version: 1,
    } as const
    const onEvent = vi.fn()
    const client = new RealtimeClient({
      endpoint: '/api/app/realtime/events',
      onEvent,
      openStream: vi.fn().mockResolvedValue(new Response(eventStream(payload))),
    })

    client.start()
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledWith(payload))
    client.stop()
  })

  it('잘못된 이벤트 본문은 화면 갱신으로 전달하지 않는다', async () => {
    const onEvent = vi.fn()
    const client = new RealtimeClient({
      endpoint: '/api/app/realtime/events',
      onEvent,
      openStream: vi.fn().mockResolvedValue(new Response(eventStream({ studentId: 2001 }))),
    })

    client.start()
    await new Promise((resolve) => globalThis.setTimeout(resolve, 10))
    client.stop()

    expect(onEvent).not.toHaveBeenCalled()
  })
})
