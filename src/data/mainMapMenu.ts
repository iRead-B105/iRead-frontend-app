export interface MainMapMenuItem {
  id: 'growth' | 'game' | 'letter' | 'challenge'
  label: string
  color: string
  position: { left: string; top: string }
}

export const mainMapMenu: MainMapMenuItem[] = [
  { id: 'growth', label: '나의 성장', color: 'var(--learner-color-growth)', position: { left: '23%', top: '27%' } },
  { id: 'game', label: '이야기 나라', color: 'var(--learner-color-game)', position: { left: '50%', top: 'calc(15% - 10px)' } },
  { id: 'letter', label: '글자 연습', color: 'var(--learner-color-learning)', position: { left: '78%', top: '29%' } },
  { id: 'challenge', label: '실력 도전', color: 'var(--learner-color-challenge)', position: { left: '52%', top: '56%' } },
]
