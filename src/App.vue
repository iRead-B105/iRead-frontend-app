<script setup lang="ts">
import LearnerErrorModal from '@/components/common/LearnerErrorModal.vue'
import UnsupportedViewportNotice from '@/components/common/UnsupportedViewportNotice.vue'
import DevLogOverlay from '@/components/developer/DevLogOverlay.vue'
import { useTobiiGazeBridge } from '@/composables/useTobiiGazeBridge'

// Keep the local Tobii WebSocket bridge alive across every learner route.
// Header instances may consume the shared state, but route changes must not
// tear down the gaze producer.
// Start the bridge as soon as the learner app mounts, before the learner route
// or header is rendered. The header only observes this shared connection state.
useTobiiGazeBridge({ autoConnect: true })
</script>

<template>
  <RouterView />
  <LearnerErrorModal />
  <UnsupportedViewportNotice />
  <DevLogOverlay />
</template>
