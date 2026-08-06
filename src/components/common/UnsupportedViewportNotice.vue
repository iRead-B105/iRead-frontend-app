<script setup lang="ts">
// 휴대폰·터치 전용 기기에서 아동 앱을 열었을 때 지원하지 않는다고 알린다.
// 훈련 화면 위에 덮는 것이 아니라 화면 전체를 대신해, 쓸 수 없는 UI를
// 아이가 만지지 못하게 한다.
import { computed } from 'vue'
import {
  MIN_VIEWPORT_HEIGHT,
  MIN_VIEWPORT_WIDTH,
  useViewportSupport,
} from '@/composables/useViewportSupport'

const { conditions, unsupportedReason } = useViewportSupport()

const description = computed(() =>
  unsupportedReason.value === 'touch-only'
    ? '아이리드는 시선 추적기와 마이크를 함께 쓰는 훈련이라 휴대폰과 태블릿에서는 사용할 수 없어요.'
    : '화면이 너무 작아 훈련 화면을 담을 수 없어요. 창을 키우거나 큰 화면에서 열어 주세요.',
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="unsupportedReason"
      class="unsupported-viewport"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="unsupported-viewport-title"
    >
      <section class="unsupported-viewport-panel">
        <span class="unsupported-viewport-icon" aria-hidden="true">🖥️</span>
        <h1 id="unsupported-viewport-title">모바일은 지원하지 않습니다</h1>
        <p>{{ description }}</p>
        <p class="unsupported-viewport-hint">
          컴퓨터에서 아이리드를 열어 주세요.<br />
          필요한 최소 화면 크기는 {{ MIN_VIEWPORT_WIDTH }}&times;{{ MIN_VIEWPORT_HEIGHT }}
          이고, 지금은 {{ conditions.width }}&times;{{ conditions.height }}예요.
        </p>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.unsupported-viewport {
  position: fixed;
  inset: 0;
  /* 학습 화면·오류 모달(10000)보다 위에 둬서 조작을 완전히 막는다. */
  z-index: 20000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: linear-gradient(180deg, #eaf4ff 0%, #fff8e8 100%);
  overflow-y: auto;
}

.unsupported-viewport-panel {
  box-sizing: border-box;
  width: min(560px, 100%);
  padding: 32px 28px;
  border: 5px solid #fff;
  border-radius: 28px;
  background: #fff;
  box-shadow: 0 16px 0 rgb(69 91 130 / 14%), 0 26px 56px rgb(24 39 66 / 24%);
  color: #173454;
  text-align: center;
}

.unsupported-viewport-icon {
  display: block;
  margin-bottom: 12px;
  font-size: 52px;
  line-height: 1;
}

.unsupported-viewport-panel h1 {
  margin: 0 0 14px;
  font-size: 26px;
  font-weight: var(--learner-font-weight-bold, 700);
}

.unsupported-viewport-panel p {
  margin: 0 0 10px;
  font-size: 17px;
  line-height: 1.55;
}

.unsupported-viewport-hint {
  margin: 16px 0 0;
  padding-top: 14px;
  border-top: 2px solid #eaf0f7;
  color: #617990;
  font-size: 15px;
}
</style>
