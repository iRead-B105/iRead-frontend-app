// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import UnsupportedViewportNotice from './UnsupportedViewportNotice.vue'

type MediaQueryOverrides = { coarsePointer?: boolean; hoverCapable?: boolean }

const setViewport = (
  width: number,
  height: number,
  { coarsePointer = false, hoverCapable = true }: MediaQueryOverrides = {},
) => {
  vi.stubGlobal('innerWidth', width)
  vi.stubGlobal('innerHeight', height)
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('pointer: coarse') ? coarsePointer : hoverCapable,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

let wrapper: ReturnType<typeof mount> | null = null

const mountNotice = () => {
  wrapper = mount(UnsupportedViewportNotice, { attachTo: document.body })
  return wrapper
}

afterEach(() => {
  // Teleport 대상을 직접 비우면 Vue 가 추적하던 노드가 사라져 다음 렌더가 깨진다.
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
})

describe('UnsupportedViewportNotice', () => {
  it('학습용 PC 화면에서는 아무것도 보여주지 않는다', () => {
    setViewport(1920, 1200)

    mountNotice()

    expect(document.body.textContent).not.toContain('모바일은 지원하지 않습니다')
  })

  it('휴대폰에서는 모바일 미지원 안내를 보여준다', () => {
    setViewport(390, 844, { coarsePointer: true, hoverCapable: false })

    mountNotice()

    expect(document.body.textContent).toContain('모바일은 지원하지 않습니다')
    expect(document.body.textContent).toContain('휴대폰과 태블릿에서는 사용할 수 없어요')
  })

  it('창이 작을 때는 화면을 키우라고 안내하고 현재 크기를 알려준다', () => {
    setViewport(800, 600)

    mountNotice()

    expect(document.body.textContent).toContain('모바일은 지원하지 않습니다')
    expect(document.body.textContent).toContain('창을 키우거나')
    expect(document.body.textContent).toContain('800×600')
  })

  it('창을 키우면 안내가 사라진다', async () => {
    setViewport(800, 600)
    const wrapper = mountNotice()
    expect(document.body.textContent).toContain('모바일은 지원하지 않습니다')

    setViewport(1600, 900)
    window.dispatchEvent(new Event('resize'))
    await wrapper.vm.$nextTick()

    expect(document.body.textContent).not.toContain('모바일은 지원하지 않습니다')
  })
})
