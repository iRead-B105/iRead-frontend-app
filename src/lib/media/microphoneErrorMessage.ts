const MICROPHONE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  NotAllowedError: '마이크 사용 권한이 꺼져 있어요.\n브라우저 설정에서 마이크 권한을 허용한 뒤 다시 시도해 주세요.',
  NotFoundError: '연결된 마이크를 찾을 수 없어요. 마이크 연결을 확인한 뒤 다시 시도해 주세요.',
  NotReadableError: '마이크를 사용할 수 없어요. 다른 앱에서 마이크를 사용 중인지 확인해 주세요.',
  AbortError: '마이크 연결이 중단됐어요. 잠시 후 다시 시도해 주세요.',
}

export function resolveMicrophoneErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    const name = String(error.name)
    const message = MICROPHONE_ERROR_MESSAGES[name]
    if (message) return message
  }

  return '마이크 연결을 확인하지 못했어요. 마이크 연결과 브라우저 권한을 확인한 뒤 다시 시도해 주세요.'
}
