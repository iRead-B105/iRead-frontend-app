<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import iReadLoginLogo from '@/assets/header/iread-login.png'
import learnerLoginBackground from '@/assets/backgrounds/learner-login-background.png'
import { resolveAuthenticatedProfileImage } from '@/features/learner/auth'
import type { LearnerStudent } from '@/features/learner/model'
import { useLearnerSessionStore } from '@/stores/learnerSession'
import { useLearnerErrorModalStore } from '@/stores/learnerErrorModal'
import { preloadSelectedStudentStoryLibrary } from '@/services/learnerDataRepository'

const router = useRouter()
const learnerSession = useLearnerSessionStore()
const errorModal = useLearnerErrorModalStore()
const loginStep = ref<'teacher' | 'student'>('teacher')
const loginId = ref('')
const password = ref('')
const linkedStudents = ref<LearnerStudent[]>([])
const selectedStudentId = ref('')
const studentPage = ref(0)
const errorMessage = ref('')
const isLoading = ref(false)
const showPassword = ref(false)
const studentsPerPage = 3
const totalStudentPages = computed(() => Math.ceil(linkedStudents.value.length / studentsPerPage))
const paginatedStudents = computed(() => {
  const start = studentPage.value * studentsPerPage
  return linkedStudents.value.slice(start, start + studentsPerPage)
})

const routeFromLearningEntry = async () => {
  const entry = await learnerSession.resolveLearningEntry(true)
  await router.push({
    name: entry.entryStatus === 'HOME' ? 'learner-home' : 'skill-challenge',
  })
}

const handleTeacherLogin = async () => {
  if (!loginId.value.trim() || !password.value) {
    errorMessage.value = '아이디와 비밀번호를 모두 입력해 주세요.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    await learnerSession.loginTeacher({
      email: loginId.value.trim(),
      password: password.value,
    })
    linkedStudents.value = await Promise.all(
      learnerSession.linkedStudents.map(async (student) => ({
        ...student,
        profileImageUrl: await resolveAuthenticatedProfileImage(
          student.studentId,
          student.profileImageUrl,
          learnerSession.bootstrapToken,
        ).catch(() => null),
      })),
    )
    studentPage.value = 0
    loginStep.value = 'student'
  } catch (error) {
    errorModal.show(error, '교수자 로그인 오류')
  } finally {
    isLoading.value = false
  }
}

const handleStudentLogin = async () => {
  const student = linkedStudents.value.find((item) => item.studentId === selectedStudentId.value)
  if (!student) {
    errorMessage.value = '학습할 아동을 선택해 주세요.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const authenticated = await learnerSession.loginStudent(student.studentId)
    if (!authenticated) throw new Error('아동 학습 세션을 시작할 수 없습니다.')
    void preloadSelectedStudentStoryLibrary().catch(() => undefined)
    await routeFromLearningEntry()
  } catch (error) {
    errorModal.show(error, '아동 학습 세션 오류')
  } finally {
    isLoading.value = false
  }
}

const retryLearningEntry = async () => {
  isLoading.value = true
  try {
    await routeFromLearningEntry()
  } catch (error) {
    errorModal.show(error, '학습 시작 상태 조회 오류')
  } finally {
    isLoading.value = false
  }
}

const returnToTeacherLogin = () => {
  loginStep.value = 'teacher'
  selectedStudentId.value = ''
  studentPage.value = 0
  linkedStudents.value = []
  errorMessage.value = ''
  learnerSession.cancelStudentSelection()
}

const changeStudentPage = (offset: number) => {
  const lastPage = Math.max(totalStudentPages.value - 1, 0)
  studentPage.value = Math.min(Math.max(studentPage.value + offset, 0), lastPage)
  selectedStudentId.value = ''
  errorMessage.value = ''
}
</script>

<template>
  <main
    class="login-page"
    :style="{ '--login-background-image': `url(${learnerLoginBackground})` }"
  >
    <div class="login-shell">
      <div class="login-logo-frame">
        <img :src="iReadLoginLogo" alt="아이리드" class="login-logo" />
      </div>

      <section
        class="login-card"
        :class="{
          'login-card--content-fit':
            (loginStep === 'teacher' && !learnerSession.authenticated) ||
            (loginStep === 'student' && linkedStudents.length > 0),
        }"
        aria-labelledby="login-title"
      >
        <ol class="login-steps" aria-label="로그인 단계">
          <li
            class="login-step"
            :class="{ 'login-step--active': loginStep === 'teacher' }"
            :aria-current="loginStep === 'teacher' ? 'step' : undefined"
          >
            <span>1</span>
            <span class="sr-only">교사 로그인</span>
          </li>
          <li class="login-step-connector" aria-hidden="true"></li>
          <li
            class="login-step"
            :class="{ 'login-step--active': loginStep === 'student' }"
            :aria-current="loginStep === 'student' ? 'step' : undefined"
          >
            <span>2</span>
            <span class="sr-only">아동 프로필 선택</span>
          </li>
        </ol>
        <h1 id="login-title" class="login-title">
          <template v-if="loginStep === 'teacher'">
            선생님이 먼저 로그인해 주세요.
          </template>
          <template v-else>
            아동 프로필을 선택해 주세요.
          </template>
        </h1>
        <section v-if="learnerSession.authenticated" class="student-empty" aria-live="polite">
          <span aria-hidden="true">🌱</span>
          <strong>학습 시작 상태를 다시 확인해요</strong>
          <p>인터넷 연결을 확인하고 다시 시도해 주세요.</p>
          <button type="button" class="login-button" :disabled="isLoading" @click="retryLearningEntry">
            {{ isLoading ? '확인 중...' : '다시 시도' }}
          </button>
        </section>

        <form
          v-else-if="loginStep === 'teacher'"
          class="login-form"
          @submit.prevent="handleTeacherLogin"
        >
          <div class="login-field">
            <label class="login-field-label" for="teacher-email">이메일 주소</label>
            <div class="login-input-wrapper">
              <svg class="login-input-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                id="teacher-email"
                v-model="loginId"
                type="email"
                placeholder="teacher@example.com"
                autocomplete="username"
                @input="errorMessage = ''"
              />
            </div>
          </div>

          <div class="login-field">
            <label class="login-field-label" for="teacher-password">비밀번호</label>
            <div class="login-input-wrapper">
              <svg class="login-input-icon" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <input
                id="teacher-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="비밀번호를 입력해 주세요"
                autocomplete="current-password"
                @input="errorMessage = ''"
              />
              <button
                type="button"
                class="password-toggle"
                :aria-label="showPassword ? '비밀번호 숨기기' : '비밀번호 표시하기'"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m3 3 18 18" />
                  <path d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-2.1 2.8M6.6 6.6C3.6 8.4 2 12 2 12s3.5 6 10 6c1 0 1.9-.1 2.7-.4" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                </svg>
              </button>
            </div>
          </div>

          <p v-if="errorMessage" class="login-error" role="alert">{{ errorMessage }}</p>

          <button
            type="submit"
            class="login-button"
            :disabled="isLoading"
            :aria-busy="isLoading"
          >
            {{ isLoading ? '확인 중...' : '다음' }}
          </button>
        </form>

        <form v-else-if="linkedStudents.length" class="student-form" @submit.prevent="handleStudentLogin">
          <div
            class="student-browser"
            :class="{ 'student-browser--single-page': totalStudentPages <= 1 }"
          >
            <button
              v-if="totalStudentPages > 1"
              type="button"
              class="student-page-button student-page-button--previous"
              :disabled="studentPage === 0"
              aria-label="이전 프로필 보기"
              @click="changeStudentPage(-1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <div class="student-grid" role="radiogroup" aria-label="연결된 아동">
              <button
                v-for="student in paginatedStudents"
                :key="student.studentId"
                class="student-card"
                :class="{ selected: selectedStudentId === student.studentId }"
                type="button"
                role="radio"
                :aria-checked="selectedStudentId === student.studentId"
                @click="selectedStudentId = student.studentId; errorMessage = ''"
              >
                <span class="student-avatar" :style="{ '--profile-color': student.profileColor }">
                  <img
                    v-if="student.profileImageUrl"
                    :src="student.profileImageUrl"
                    alt=""
                    aria-hidden="true"
                  />
                  <template v-else>{{ student.name.slice(0, 1) }}</template>
                </span>
                <strong>{{ student.name }}</strong>
                <small v-if="student.age !== null">{{ student.age }}세</small>
              </button>
            </div>

            <button
              v-if="totalStudentPages > 1"
              type="button"
              class="student-page-button student-page-button--next"
              :disabled="studentPage >= totalStudentPages - 1"
              aria-label="다음 프로필 보기"
              @click="changeStudentPage(1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>

          <p
            v-if="totalStudentPages > 1"
            class="student-page-status"
            aria-live="polite"
          >
            {{ studentPage + 1 }} / {{ totalStudentPages }}
          </p>

          <p v-if="errorMessage" class="login-error" role="alert">{{ errorMessage }}</p>

          <div class="student-actions">
            <button type="button" class="back-button" @click="returnToTeacherLogin">이전</button>
            <button type="submit" class="login-button" :disabled="isLoading">
              {{ isLoading ? '시작 중...' : '학습 시작' }}
            </button>
          </div>
        </form>

        <section v-else class="student-empty" aria-live="polite">
          <span aria-hidden="true">🌱</span>
          <strong>연결된 아동이 없어요</strong>
          <p>교수자용 서비스에서 아동을 먼저 등록해 주세요.</p>
          <button type="button" class="back-button" @click="returnToTeacherLogin">로그아웃</button>
        </section>
      </section>
    </div>
  </main>
</template>

<style scoped src="@/styles/common/LoginView.css"></style>
