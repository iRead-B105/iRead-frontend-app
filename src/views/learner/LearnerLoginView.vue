<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import iReadLoginLogo from '@/assets/header/iread-login.png'
import { resolveAuthenticatedProfileImage } from '@/features/learner/auth'
import type { LearnerStudent } from '@/features/learner/model'
import { useLearnerSessionStore } from '@/stores/learnerSession'
import { useLearnerErrorModalStore } from '@/stores/learnerErrorModal'
import { preloadSelectedStudentStoryLibrary } from '@/services/learnerDataRepository'
import userIcon from '@/assets/icons/user.svg'
import lockIcon from '@/assets/icons/lock.svg'

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
  <main class="login-page">
    <div class="cloud cloud-left" aria-hidden="true"></div>
    <div class="cloud cloud-right" aria-hidden="true"></div>

    <div class="login-shell">
      <div class="login-logo-frame">
        <img :src="iReadLoginLogo" alt="아이리드" class="login-logo" />
      </div>

      <section class="login-card" aria-labelledby="login-title">
        <p class="login-step">{{ loginStep === 'teacher' ? '1 / 2' : '2 / 2' }}</p>
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
          <label class="login-input-wrapper">
            <span class="sr-only">아이디</span>
            <img class="user-icon" :src="userIcon" alt="" aria-hidden="true" />
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
            <img class="lock-icon" :src="lockIcon" alt="" aria-hidden="true" />
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
          <div class="student-browser">
            <button
              v-if="totalStudentPages > 1"
              type="button"
              class="student-page-button student-page-button--previous"
              :disabled="studentPage === 0"
              aria-label="이전 아동 목록"
              @click="changeStudentPage(-1)"
            >
              <span aria-hidden="true">‹</span>
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
              aria-label="다음 아동 목록"
              @click="changeStudentPage(1)"
            >
              <span aria-hidden="true">›</span>
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
            <button type="button" class="back-button" @click="returnToTeacherLogin">교사 로그인</button>
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
