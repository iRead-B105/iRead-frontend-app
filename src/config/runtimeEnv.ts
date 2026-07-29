import { resolveLearnerEnvironment } from './env'

export const appEnvironment = resolveLearnerEnvironment(import.meta.env)
