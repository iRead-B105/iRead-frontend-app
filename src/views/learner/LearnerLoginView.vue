<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import iReadMainLogo from '@/assets/header/iread-main.png'
import type { LearnerStudent } from '@/features/learner/model'
import { useLearnerSessionStore } from '@/stores/learnerSession'
import { useLearnerErrorModalStore } from '@/stores/learnerErrorModal'

const router = useRouter()
const learnerSession = useLearnerSessionStore()
const errorModal = useLearnerErrorModalStore()
const loginStep = ref<'teacher' | 'student'>('teacher')
const loginId = ref('')
const password = ref('')
const linkedStudents = ref<LearnerStudent[]>([])
const selectedStudentId = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

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
    linkedStudents.value = learnerSession.linkedStudents.map((student) => ({ ...student }))
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
  linkedStudents.value = []
  errorMessage.value = ''
  learnerSession.cancelStudentSelection()
}
</script>

<template>
  <main class="login-page">
    <div class="cloud cloud-left" aria-hidden="true"></div>
    <div class="cloud cloud-right" aria-hidden="true"></div>

    <div class="login-shell">
      <div class="login-logo-frame">
        <img :src="iReadMainLogo" alt="아이리드" class="login-logo" />
      </div>

      <section class="login-card" aria-labelledby="login-title">
        <p class="login-step">{{ loginStep === 'teacher' ? '1 / 2' : '2 / 2' }}</p>
        <h1 id="login-title" class="login-title">
          {{ loginStep === 'teacher' ? '선생님이 먼저 로그인해 주세요' : '학습할 친구를 골라 주세요' }}
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
          <label class="login-input-wrapper">
            <span class="sr-only">아이디</span>
            <svg class="user-icon" viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="24" cy="16" r="9" />
              <path d="M8 42c1.4-10 7-15 16-15s14.6 5 16 15" />
            </svg>
            <input
              v-model="loginId"
              type="text"
              placeholder="선생님 아이디"
              autocomplete="username"
              aria-label="선생님 아이디"
              @input="errorMessage = ''"
            />
          </label>

          <label class="login-input-wrapper">
            <span class="sr-only">비밀번호</span>
            <svg class="lock-icon" viewBox="0 0 48 48" aria-hidden="true">
              <rect x="10" y="21" width="28" height="21" rx="6" />
              <path d="M16 21v-6a8 8 0 0 1 16 0v6" />
              <circle cx="24" cy="31" r="2.5" />
            </svg>
            <input
              v-model="password"
              type="password"
              placeholder="비밀번호"
              autocomplete="current-password"
              aria-label="비밀번호"
              @input="errorMessage = ''"
            />
          </label>

          <p v-if="errorMessage" class="login-error" role="alert">{{ errorMessage }}</p>

          <button type="submit" class="login-button" :disabled="isLoading">
            {{ isLoading ? '확인 중...' : '다음' }}
          </button>
        </form>

        <form v-else-if="linkedStudents.length" class="student-form" @submit.prevent="handleStudentLogin">
          <div class="student-grid" role="radiogroup" aria-label="연결된 아동">
            <button
              v-for="student in linkedStudents"
              :key="student.studentId"
              class="student-card"
              :class="{ selected: selectedStudentId === student.studentId }"
              type="button"
              role="radio"
              :aria-checked="selectedStudentId === student.studentId"
              @click="selectedStudentId = student.studentId; errorMessage = ''"
            >
              <span class="student-avatar" :style="{ '--profile-color': student.profileColor }">
                {{ student.name.slice(0, 1) }}
              </span>
              <strong>{{ student.name }}</strong>
              <small>{{ student.age === null ? '학습자' : `${student.age}세` }}</small>
            </button>
          </div>

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
