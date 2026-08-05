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

    expect(wrapper.get('#login-title').text()).toBe('선생님이 먼저 로그인해 주세요.')
    expect(wrapper.get('#login-title').find('br').exists()).toBe(false)
    expect(wrapper.findAll('.login-step')).toHaveLength(2)
    expect(wrapper.get('.login-step--active').text()).toBe('1교사 로그인')
    expect(wrapper.findAll('.login-field-label').map((label) => label.text())).toEqual([
      '이메일 주소',
      '비밀번호',
    ])
    expect(wrapper.get('#teacher-password').attributes('type')).toBe('password')
    await wrapper.get('.password-toggle').trigger('click')
    expect(wrapper.get('#teacher-password').attributes('type')).toBe('text')
    expect(wrapper.get('.password-toggle').attributes('aria-label')).toBe('비밀번호 숨기기')

    await wrapper.get('#teacher-email').setValue('teacher@example.com')
    await wrapper.get('#teacher-password').setValue('password')
    await wrapper.get('form.login-form').trigger('submit')
    await flushPromises()
    await wrapper.get('[role="radio"]').trigger('click')
    await wrapper.get('form.student-form').trigger('submit')
    await flushPromises()

    expect(loginStudent).toHaveBeenCalledWith('20')
    expect(resolveLearningEntry).toHaveBeenCalledWith(true)
    expect(router.currentRoute.value.name).toBe('skill-challenge')
  })

  it('연결된 아동을 한 페이지에 세 명씩 보여주고 이전과 다음으로 이동한다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const session = useLearnerSessionStore(pinia)
    const students = Array.from({ length: 7 }, (_, index) => ({
      studentId: String(index + 1),
      name: `학습자${index + 1}`,
      age: index === 0 ? null : 8,
      profileColor: '#71a9ef',
      profileImageUrl: index === 0 ? '/images/student-profile.png' : null,
    }))
    vi.spyOn(session, 'loginTeacher').mockImplementation(async () => {
      session.linkedStudents = students
      return true
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/login', name: 'learner-login', component: LearnerLoginView }],
    })
    await router.push('/login')
    await router.isReady()
    const wrapper = mount(
      { template: '<RouterView />' },
      { global: { plugins: [pinia, router] } },
    )

    await wrapper.get('#teacher-email').setValue('teacher@example.com')
    await wrapper.get('#teacher-password').setValue('password')
    await wrapper.get('form.login-form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('#login-title').text()).toBe('아동 프로필을 선택해 주세요.')
    expect(wrapper.get('#login-title').find('br').exists()).toBe(false)
    expect(wrapper.get('.login-step--active').text()).toBe('2아동 프로필 선택')
    expect(wrapper.get('.back-button').text()).toBe('이전')
    expect(wrapper.get('.student-page-button--previous').attributes('aria-label')).toBe('이전 프로필 보기')
    expect(wrapper.get('.student-page-button--next').attributes('aria-label')).toBe('다음 프로필 보기')
    expect(wrapper.find('.student-page-button--previous svg').exists()).toBe(true)
    expect(wrapper.find('.student-page-button--next svg').exists()).toBe(true)
    expect(wrapper.findAll('.student-card small').map((item) => item.text())).not.toContain('학습자')
    expect(wrapper.get('.student-avatar img').attributes('src')).toBe('/images/student-profile.png')
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('1 / 3')

    await wrapper.get('.student-page-button:last-child').trigger('click')
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('학습자4')
    expect(wrapper.text()).toContain('2 / 3')

    await wrapper.get('.student-page-button:last-child').trigger('click')
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('학습자7')
    expect(wrapper.text()).toContain('3 / 3')

    await wrapper.get('.student-page-button:first-child').trigger('click')
    expect(wrapper.text()).toContain('학습자4')
    expect(wrapper.text()).toContain('2 / 3')
  })
})
