import { ApiError } from '@/lib/api'

export class LearnerContractUnavailableError extends ApiError {
  constructor(code: string, message: string) {
    super({
      status: 501,
      code,
      message,
    })
    this.name = 'LearnerContractUnavailableError'
  }
}
