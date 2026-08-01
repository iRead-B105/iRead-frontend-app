// @vitest-environment jsdom

import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import { useLearnerSessionStore } from '@/stores/learnerSession'
import LearnerLoginView from './LearnerLoginView.vue'

describe('LearnerLoginView 학습 진입 흐름', () => {
  it('신규 아동 세션이면 학습 진입 상태를 조회하고 실력 도전으로 이동한다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const session = useLearnerSessionStore(pinia)
    const student = {
      studentId: '20',
      name: '새봄',
      age: 8,
      profileColor: '#FFD166',
      profileImageUrl: null,
    }
    vi.spyOn(session, 'loginTeacher').mockImplementation(async () => {
      session.linkedStudents = [student]
      return true
    })
    const loginStudent = vi.spyOn(session, 'loginStudent').mockResolvedValue(true)
    const resolveLearningEntry = vi.spyOn(session, 'resolveLearningEntry').mockResolvedValue({
      studentId: '20',
      entryStatus: 'CHALLENGE_REQUIRED',
      testCurriculumId: null,
      completedQuestions: 0,
      totalQuestions: 9,
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'learner-login', component: LearnerLoginView },
        { path: '/home', name: 'learner-home', component: { template: '<div>홈</div>' } },
        { path: '/challenge', name: 'skill-challenge', component: { template: '<div>실력 도전</div>' } },
      ],
    })
    await router.push('/login')
    await router.isReady()
    const wrapper = mount(
      { template: '<RouterView />' },
      { global: { plugins: [pinia, router] } },
    )

    await wrapper.get('input[aria-label="선생님 아이디"]').setValue('teacher@example.com')
    await wrapper.get('input[aria-label="비밀번호"]').setValue('password')
    await wrapper.get('form.login-form').trigger('submit')
    await flushPromises()
    await wrapper.get('[role="radio"]').trigger('click')
    await wrapper.get('form.student-form').trigger('submit')
    await flushPromises()

    expect(loginStudent).toHaveBeenCalledWith('20')
    expect(resolveLearningEntry).toHaveBeenCalledWith(true)
    expect(router.currentRoute.value.name).toBe('skill-challenge')
  })
})
