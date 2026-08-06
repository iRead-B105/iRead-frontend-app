// 브라우저 마이크 권한 상태 조회와 감시
//
// getUserMedia 는 호출한 그 순간의 권한만 알려준다. 한 번 허용받은 뒤 사용자가
// 브라우저 설정에서 마이크를 차단하면 다음 getUserMedia 호출 때까지 알 수 없어서,
// 화면은 계속 "연결됨"으로 남는다. Permissions API 로 권한 변화를 구독해
// 차단되는 즉시 화면 상태를 되돌린다.
//
// 'microphone' 은 표준 PermissionName 목록에 없고 일부 브라우저는 query 에서
// 예외를 던지므로, 조회 실패는 오류가 아니라 'unsupported' 로 다룬다.

export type MicrophonePermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

const MICROPHONE_PERMISSION_NAME = 'microphone' as PermissionName

const queryPermissionStatus = async (): Promise<PermissionStatus | null> => {
  if (typeof navigator === 'undefined') return null
  const permissions = navigator.permissions
  if (typeof permissions?.query !== 'function') return null

  try {
    return await permissions.query({ name: MICROPHONE_PERMISSION_NAME })
  } catch {
    // Permissions API 가 'microphone' 을 모르는 브라우저.
    return null
  }
}

export async function queryMicrophonePermission(): Promise<MicrophonePermission> {
  const status = await queryPermissionStatus()
  return status ? (status.state as MicrophonePermission) : 'unsupported'
}

// 권한 변화를 구독한다. 구독 시점의 상태도 한 번 알려주고,
// 반환된 함수를 호출하면 구독을 해제한다.
export function watchMicrophonePermission(
  onChange: (permission: MicrophonePermission) => void,
): () => void {
  let status: PermissionStatus | null = null
  let disposed = false

  const notifyCurrentState = () => {
    if (status) onChange(status.state as MicrophonePermission)
  }

  void queryPermissionStatus().then((resolved) => {
    // 구독이 이미 해제됐다면 리스너를 남기지 않는다.
    if (disposed) return

    if (!resolved) {
      onChange('unsupported')
      return
    }

    status = resolved
    status.addEventListener('change', notifyCurrentState)
    notifyCurrentState()
  })

  return () => {
    disposed = true
    status?.removeEventListener('change', notifyCurrentState)
    status = null
  }
}
