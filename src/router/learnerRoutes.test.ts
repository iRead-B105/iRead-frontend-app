import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { learnerRoutes } from './learnerRoutes'

describe('learner skill challenge routes', () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [learnerRoutes],
  })

  it('resolves a challenge question without using the training path', () => {
    const route = router.resolve({
      name: 'skill-challenge-lesson',
      params: {
        trackId: 'phonological',
        testId: '101',
      },
    })

    expect(route.path).toBe('/learner/challenge/phonological/101')
    expect(route.name).toBe('skill-challenge-lesson')
  })

  it('resolves the per-question completion inside the challenge path', () => {
    const route = router.resolve({
      name: 'skill-challenge-question-complete',
      params: {
        trackId: 'fluency',
        testId: '109',
      },
    })

    expect(route.path).toBe('/learner/challenge/fluency/109/complete')
  })
})
