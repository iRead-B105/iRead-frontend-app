<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDailyCurriculum } from '@/composables/useDailyCurriculum'
import { useDeviceStatus } from '@/composables/useDeviceStatus'
import { learnerDataSource } from '@/config/learnerDataSource'
import {
  getTrainingTypeMapping,
  selectableTrainingTemplates,
} from '@/features/learner/content/trainingTemplateMapping'
import { getLessonById } from '@/mocks/trainingLessons'
import { getCachedStudent } from '@/services/learnerDataRepository'
import { useDeveloperMode } from '@/composables/useDeveloperMode'
import {
  advanceToNextDemoTraining,
  advanceDemoLearningDay,
  resetDemoLearningProgress,
  type DeveloperCheatResult,
} from '@/services/developerCheatService'

const route = useRoute()
const router = useRouter()
const dailyCurriculum = useDailyCurriculum()
const open = ref(route.query.debugPanel === '1')
const busyAction = ref<'reset' | 'next-day' | null>(null)
const forcingNextTraining = ref(false)
const message = ref('')
const errorMessage = ref('')
const activeStudent = computed(() => getCachedStudent())
const apiCheatsAvailable = learnerDataSource === 'api'
const { setEnabled: setDeveloperMode } = useDeveloperMode()
const {
  physicalEyeTrackerConnected,
  virtualEyeTrackerConnected,
  setVirtualEyeTrackerConnected,
} = useDeviceStatus()

// 진행 가능 템플릿 31개 각각을 미리보기 버튼으로 만든다 (레슨 화면은 공유될 수 있음)
const templatePreviews = selectableTrainingTemplates
  .flatMap((template) => {
    const mapping = getTrainingTypeMapping(template.trainingType)
    if (!mapping) return []
    const lesson = getLessonById(mapping.lessonId)
    return lesson
      ? [{
          templateId: template.templateId,
          name: template.name,
          categoryId: mapping.categoryId,
          lessonId: mapping.lessonId,
          activityType: lesson.activityType,
        }]
      : []
  })
  .map((preview, index) => ({ ...preview, order: index + 1 }))
let pendingGazePoint: { clientX: number; clientY: number } | null = null
let gazeAnimationFrame = 0

const emitVirtualGaze = () => {
  gazeAnimationFrame = 0
  const point = pendingGazePoint
  pendingGazePoint = null
  if (!virtualEyeTrackerConnected.value || !point) return
  window.dispatchEvent(new CustomEvent('iread:gaze', {
    detail: {
      ...point,
      x: point.clientX,
      y: point.clientY,
      rawClientX: point.clientX,
      rawClientY: point.clientY,
      source: 'mouse',
      valid: true,
      headPoseStable: true,
    },
  }))
}

const handleVirtualGazePointer = (event: PointerEvent) => {
  if (!virtualEyeTrackerConnected.value) return
  pendingGazePoint = { clientX: event.clientX, clientY: event.clientY }
  if (!gazeAnimationFrame) gazeAnimationFrame = window.requestAnimationFrame(emitVirtualGaze)
}

const toggleVirtualEyeTracker = () => {
  setVirtualEyeTrackerConnected(!virtualEyeTrackerConnected.value)
}

const forceMoveToNextTraining = async () => {
  if (forcingNextTraining.value) return
  forcingNextTraining.value = true

  try {
    const currentLessonId = String(route.params.lessonId ?? '')
    const isDebugPreview = route.query.debug === '1'

    if (isDebugPreview) {
      const currentPreviewIndex = templatePreviews.findIndex(
        (preview) => preview.lessonId === currentLessonId,
      )
      // 같은 레슨 화면을 공유하는 템플릿은 건너뛰고 다음 화면으로 이동한다
      const nextPreview = templatePreviews
        .slice(Math.max(currentPreviewIndex, 0) + 1)
        .find((preview) => preview.lessonId !== currentLessonId)

      if (!nextPreview) {
        window.alert('다음 미리보기 훈련이 없습니다.')
        return
      }

      await router.push({
        name: 'training-lesson',
        params: { categoryId: nextPreview.categoryId, lessonId: nextPreview.lessonId },
        query: { debug: '1' },
      })
      return
    }

    await dailyCurriculum.reloadCurrentCurriculum()
    const routeTrainingId = typeof route.query.trainingId === 'string'
      ? route.query.trainingId
      : ''
    const routeTrainingIndex = dailyCurriculum.curriculumItems.findIndex(
      (item) => item.trainingId === routeTrainingId,
    )
    const routeTraining = dailyCurriculum.curriculumItems[routeTrainingIndex]
    const currentTrainingIndex = routeTrainingIndex >= 0 && routeTraining?.status !== 'LOCKED'
      ? routeTrainingIndex
      : dailyCurriculum.currentIndex.value
    const currentTraining = dailyCurriculum.curriculumItems[currentTrainingIndex]

    if (!currentTraining || !dailyCurriculum.curriculumItems[currentTrainingIndex + 1]) {
      window.alert('다음 훈련이 없습니다.')
      return
    }

    const result = await advanceToNextDemoTraining(
      activeStudent.value.studentId,
      currentTraining.trainingId,
    )
    await dailyCurriculum.reloadCurrentCurriculum()
    const nextTraining = dailyCurriculum.curriculumItems.find(
      (item) => item.trainingId === String(result.nextTrainingId),
    )

    if (!nextTraining) {
      throw new Error('서버에서 해제한 다음 훈련을 찾을 수 없습니다.')
    }

    const alreadyOnNextTraining = routeTrainingId === nextTraining.trainingId
    await router.push({
      name: 'training-lesson',
      params: {
        categoryId: nextTraining.categoryId,
        lessonId: nextTraining.lesson.id,
      },
      query: { trainingId: nextTraining.trainingId },
    })
    if (alreadyOnNextTraining) window.location.reload()
  } catch (error) {
    window.alert(error instanceof Error
      ? `다음 훈련으로 이동하지 못했습니다.\n${error.message}`
      : '다음 훈련으로 이동하지 못했습니다.')
  } finally {
    forcingNextTraining.value = false
  }
}

onMounted(() => {
  window.addEventListener('pointermove', handleVirtualGazePointer, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', handleVirtualGazePointer)
  if (gazeAnimationFrame) window.cancelAnimationFrame(gazeAnimationFrame)
  pendingGazePoint = null
  setVirtualEyeTrackerConnected(false)
})

watch(
  () => route.query.debugPanel,
  (value) => {
    if (value === '1') open.value = true
  },
)

const close = () => {
  open.value = false
}

const openDebugLesson = (categoryId: string, lessonId: string) => {
  close()
  void router.push({
    name: 'training-lesson',
    params: { categoryId, lessonId },
    query: { debug: '1' },
  })
}

const navigate = (name: string) => {
  close()
  void router.push({ name })
}

const describeResult = (result: DeveloperCheatResult) =>
  `커리큘럼 #${result.curriculumId} · ${result.trainingCount}개 훈련 · ${result.curriculumStatus}`

const runServerCheat = async (
  action: 'reset' | 'next-day',
  request: (studentId: string) => Promise<DeveloperCheatResult>,
) => {
  if (!apiCheatsAvailable || busyAction.value) return
  const prompt = action === 'reset'
    ? `${activeStudent.value.name}의 데모 학습 진행을 처음 상태로 되돌릴까요?`
    : `${activeStudent.value.name}의 현재 커리큘럼을 완료하고 다음날 커리큘럼을 실제 생성할까요?`
  if (!window.confirm(prompt)) return

  busyAction.value = action
  message.value = ''
  errorMessage.value = ''
  try {
    const result = await request(activeStudent.value.studentId)
    message.value = action === 'reset'
      ? `학습 진행을 초기화했습니다. ${describeResult(result)}`
      : `다음날 커리큘럼을 생성했습니다. ${describeResult(result)}`
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : '치트 요청을 처리하지 못했습니다.'
  } finally {
    busyAction.value = null
  }
}

const applyAndOpenTraining = () => {
  close()
  void router.push({ name: 'training-home' }).then(() => window.location.reload())
}

const reloadPage = () => window.location.reload()
</script>

<template>
  <button
    class="developer-cheat-trigger"
    type="button"
    aria-label="개발자 치트 메뉴 열기"
    aria-haspopup="dialog"
    @click="open = true"
  >
    DEV
  </button>

  <div
    v-if="open"
    class="developer-cheat-backdrop"
    role="presentation"
    @click.self="close"
  >
    <section
      class="developer-cheat-menu"
      role="dialog"
      aria-modal="true"
      aria-labelledby="developer-cheat-title"
    >
      <header class="developer-cheat-header">
        <div>
          <span>DEVELOPMENT ONLY</span>
          <h2 id="developer-cheat-title">학습 테스트 치트 메뉴</h2>
          <p>{{ activeStudent.name }} · #{{ activeStudent.studentId }}</p>
        </div>
        <button type="button" aria-label="치트 메뉴 닫기" @click="close">×</button>
      </header>

      <div class="developer-cheat-content">
        <section class="developer-cheat-section">
          <div class="developer-cheat-section-heading">
            <div>
              <h3>학습 상태</h3>
              <p>demo 백엔드의 실제 커리큘럼 상태를 변경합니다.</p>
            </div>
            <span :class="{ unavailable: !apiCheatsAvailable }">
              {{ apiCheatsAvailable ? 'API 연결' : 'MOCK 모드' }}
            </span>
          </div>

          <div class="developer-cheat-action-grid">
            <button
              type="button"
              :disabled="forcingNextTraining"
              @click="forceMoveToNextTraining"
            >
              <strong>다음 훈련으로 이동</strong>
              <span>현재 훈련을 완료 처리하고 다음 훈련 열기</span>
            </button>
            <button
              type="button"
              class="danger"
              :disabled="!apiCheatsAvailable || busyAction !== null"
              @click="runServerCheat('reset', resetDemoLearningProgress)"
            >
              <strong>학습 진행 초기화</strong>
              <span>선택 학습자의 데모 커리큘럼을 처음 상태로 복원</span>
            </button>
            <button
              type="button"
              :disabled="!apiCheatsAvailable || busyAction !== null"
              @click="runServerCheat('next-day', advanceDemoLearningDay)"
            >
              <strong>다음날로 진행</strong>
              <span>현재 학습 완료 → 다음 개인화 커리큘럼 생성</span>
            </button>
            <button
              type="button"
              class="eye-tracker"
              :class="{ connected: virtualEyeTrackerConnected }"
              :disabled="physicalEyeTrackerConnected"
              :aria-pressed="virtualEyeTrackerConnected"
              @click="toggleVirtualEyeTracker"
            >
              <strong>{{ physicalEyeTrackerConnected
                ? '실제 아이트래커 연결됨'
                : virtualEyeTrackerConnected
                  ? '가상 아이트래커 해제'
                  : '가상 아이트래커 연결' }}</strong>
              <span>{{ virtualEyeTrackerConnected
                ? '마우스 포인터를 시선으로 보내는 중'
                : '마우스 포인터를 시선처럼 사용' }}</span>
            </button>
            <button type="button" @click="reloadPage">
              <strong>현재 화면 새로고침</strong>
              <span>서버 데이터와 화면 상태를 다시 불러오기</span>
            </button>
            <button type="button" class="danger" @click="setDeveloperMode(false)">
              <strong>DEV 모드 끄기</strong>
              <span>로고를 다시 5번 눌러 켤 수 있어요</span>
            </button>
          </div>

          <p v-if="message" class="developer-cheat-message success">
            {{ message }}
            <button type="button" @click="applyAndOpenTraining">생성된 학습 열기</button>
          </p>
          <p v-if="errorMessage" class="developer-cheat-message error">{{ errorMessage }}</p>
        </section>

        <section class="developer-cheat-section">
          <div class="developer-cheat-section-heading">
            <div>
              <h3>화면 바로가기</h3>
              <p>테스트할 학습자 화면으로 즉시 이동합니다.</p>
            </div>
          </div>
          <div class="developer-cheat-shortcuts">
            <button type="button" @click="navigate('learner-home')">메인</button>
            <button type="button" @click="navigate('training-home')">글자 연습</button>
            <button type="button" @click="navigate('story-selection')">이야기 나라</button>
            <button type="button" @click="navigate('growth')">나의 성장</button>
            <button type="button" @click="navigate('skill-challenge')">실력 검증</button>
          </div>
        </section>

        <section class="developer-cheat-section">
          <div class="developer-cheat-section-heading">
            <div>
              <h3>전체 학습 UI 미리보기</h3>
              <p>서버 진도와 무관하게 진행 가능 훈련 {{ templatePreviews.length }}종을 하나씩 엽니다.</p>
            </div>
            <span>{{ templatePreviews.length }}개</span>
          </div>
          <div class="developer-cheat-lesson-grid">
            <button
              v-for="preview in templatePreviews"
              :key="preview.templateId"
              type="button"
              @click="openDebugLesson(preview.categoryId, preview.lessonId)"
            >
              <strong>{{ preview.order }}. {{ preview.name }}</strong>
              <span>{{ preview.activityType }} · {{ preview.lessonId }}</span>
            </button>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped src="@/styles/developer/DeveloperCheatMenu.css"></style>
