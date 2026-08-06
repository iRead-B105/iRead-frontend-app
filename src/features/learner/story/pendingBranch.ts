// 진행 중인 이야기 분기 생성을 화면 이동 뒤에도 기억한다.
//
// 선택지를 누르면 Backend 가 AI 로 다음 장면을 만드는 동안 응답을 기다린다.
// 그 사이 아이가 홈으로 나갔다 다시 들어오면 컴포넌트가 새로 만들어져 화면 안의
// 제출 중 표시가 사라지고, 이미 고른 선택지를 또 누를 수 있었다. 같은 분기로
// 생성이 두 번 돌아가므로 탭 안에서 유지되는 sessionStorage 에 기록해 둔다.
//
// 생성이 이미 끝난 경우는 이어보기가 새로 생긴 페이지로 이동하므로 여기서 다루지 않는다.

const STORAGE_KEY = 'iread.learner.pendingStoryBranch'

// 생성이 실패하거나 탭이 죽어 기록만 남는 경우에도 분기가 영영 막히지 않게 한다.
// Backend 의 AI 읽기 제한(210s)보다 넉넉하게 잡는다.
const PENDING_TTL_MS = 5 * 60 * 1000

type PendingBranch = {
  readonly storyId: string
  readonly lineId: string
  readonly startedAt: number
}

const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    // 저장소가 차단된 환경(사생활 보호 모드 등)에서는 기능 없이 동작한다.
    return null
  }
}

const read = (): PendingBranch | null => {
  const raw = storage()?.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PendingBranch>
    if (
      typeof parsed.storyId !== 'string'
      || typeof parsed.lineId !== 'string'
      || typeof parsed.startedAt !== 'number'
    ) return null
    return { storyId: parsed.storyId, lineId: parsed.lineId, startedAt: parsed.startedAt }
  } catch {
    return null
  }
}

export function markStoryBranchPending(storyId: string, lineId: string, now = Date.now()): void {
  const pending: PendingBranch = { storyId, lineId, startedAt: now }
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(pending))
  } catch {
    // 저장에 실패해도 진행 자체를 막지 않는다.
  }
}

export function clearStoryBranchPending(): void {
  try {
    storage()?.removeItem(STORAGE_KEY)
  } catch {
    // 지우기 실패는 TTL 이 정리한다.
  }
}

/** 이 분기의 생성 요청이 아직 끝나지 않았는가. 오래된 기록은 만료로 본다. */
export function isStoryBranchPending(
  storyId: string,
  lineId: string,
  now = Date.now(),
): boolean {
  const pending = read()
  if (!pending) return false
  if (now - pending.startedAt > PENDING_TTL_MS) {
    clearStoryBranchPending()
    return false
  }
  return pending.storyId === storyId && pending.lineId === lineId
}
