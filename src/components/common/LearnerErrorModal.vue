<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useLearnerErrorModalStore } from '@/stores/learnerErrorModal'

const errorModal = useLearnerErrorModalStore()

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && errorModal.visible) errorModal.close()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="learner-error-modal">
      <div
        v-if="errorModal.visible"
        class="learner-error-backdrop"
        role="presentation"
        @click.self="errorModal.close"
      >
        <section
          class="learner-error-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="learner-error-name"
        >
          <span class="learner-error-icon" aria-hidden="true">!</span>
          <h2 id="learner-error-name">{{ errorModal.errorName }}</h2>
          <button type="button" autofocus @click="errorModal.close">확인</button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.learner-error-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(26, 45, 76, 0.48);
  backdrop-filter: blur(5px);
}

.learner-error-dialog {
  width: min(420px, 100%);
  padding: 34px 28px 26px;
  border: 5px solid #fff;
  border-radius: 30px;
  background: #fff8e8;
  box-shadow: 0 18px 0 rgba(69, 91, 130, 0.18), 0 28px 60px rgba(24, 39, 66, 0.3);
  text-align: center;
}

.learner-error-icon {
  display: grid;
  width: 66px;
  height: 66px;
  margin: 0 auto 18px;
  place-items: center;
  border-radius: 50%;
  background: #ff7d66;
  color: #fff;
  font-size: 42px;
  font-weight: 900;
  line-height: 1;
}

.learner-error-dialog h2 {
  margin: 0;
  color: #354b78;
  font-family: inherit;
  font-size: clamp(24px, 5cqw, 34px);
  font-weight: 900;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.learner-error-dialog button {
  min-width: 150px;
  margin-top: 28px;
  padding: 14px 28px;
  border: 0;
  border-radius: 999px;
  background: #587dd8;
  box-shadow: 0 6px 0 #3e5fae;
  color: #fff;
  font: inherit;
  font-size: 22px;
  font-weight: 900;
  cursor: pointer;
}

.learner-error-dialog button:active {
  transform: translateY(4px);
  box-shadow: 0 2px 0 #3e5fae;
}

.learner-error-modal-enter-active,
.learner-error-modal-leave-active {
  transition: opacity 160ms ease;
}

.learner-error-modal-enter-active .learner-error-dialog,
.learner-error-modal-leave-active .learner-error-dialog {
  transition: transform 160ms ease;
}

.learner-error-modal-enter-from,
.learner-error-modal-leave-to {
  opacity: 0;
}

.learner-error-modal-enter-from .learner-error-dialog,
.learner-error-modal-leave-to .learner-error-dialog {
  transform: scale(0.92);
}
</style>
