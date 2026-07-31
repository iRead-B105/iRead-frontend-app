import './styles/index.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './app/router'
import { configureLearnerApiAuth } from '@/features/learner/learnerApiClient'
import { useLearnerSessionStore } from '@/stores/learnerSession'
import { useLearnerErrorModalStore } from '@/stores/learnerErrorModal'
import { configureLearnerAuthApiErrors } from '@/features/learner/auth/apiLearnerAuthRepository'
import { installLearnerRealtimeSync } from '@/realtime/installLearnerRealtimeSync'

const app = createApp(App)
const pinia = createPinia()
const learnerSession = useLearnerSessionStore(pinia)
const learnerErrorModal = useLearnerErrorModalStore(pinia)

configureLearnerApiAuth({
  getAccessToken: () => learnerSession.accessToken,
  onUnauthorized: (_error, context) =>
    learnerSession.handleUnauthorized(context.requestRetried),
  onError: (error) => learnerErrorModal.show(error),
})
configureLearnerAuthApiErrors((error) => learnerErrorModal.show(error))
installLearnerRealtimeSync(pinia, router)

app.config.errorHandler = (error) => {
  learnerErrorModal.show(error, '화면 처리 오류')
}

window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault()
  learnerErrorModal.show(event.reason, '요청 처리 오류')
})

app.use(pinia)
app.use(router)
app.mount('#app')
