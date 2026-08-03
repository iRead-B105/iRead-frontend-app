<script setup lang="ts">
import LearnerErrorModal from '@/components/common/LearnerErrorModal.vue'
import { useTobiiGazeBridge } from '@/composables/useTobiiGazeBridge'

// Keep the local Tobii WebSocket bridge alive across every learner route.
// Header instances may consume the shared state, but route changes must not
// tear down the gaze producer.
useTobiiGazeBridge()
</script>

<template>
  <RouterView />
  <LearnerErrorModal />
</template>
