// 훈련 카테고리 목업 데이터

import type { TrainingCategory } from '@/types/training'

import phonologicalIcon from '@/assets/map/letter-part-alpha.png'
import phonicsIcon from '@/assets/map/낱말카드.png'
import shortTextIcon from '@/assets/map/책1.png'
import fluencyIcon from '@/assets/map/책4.png'

export const trainingCategories: TrainingCategory[] = [
  {
    id: 'phonological-awareness',
    title: '음운 인식 훈련',
    description: '소리를 듣고 찾아봐요.',
    image: phonologicalIcon,
    lessons: [
      { id: 'word-first-sound-choice', categoryId: 'phonological-awareness', title: '낱말 첫소리 고르기', description: '낱말을 듣고 첫소리 글자를 골라요.', activityType: 'audio-letter-choice', estimatedMinutes: 8, isReady: true },
      { id: 'same-sound', categoryId: 'phonological-awareness', title: '같은 소리 찾기', description: '제시된 소리와 같은 소리를 가진 카드를 선택해요.', activityType: 'listen-and-select', estimatedMinutes: 10, isReady: true },
      { id: 'first-sound', categoryId: 'phonological-awareness', title: '첫소리 찾기', description: '단어를 듣고 첫 번째 소리를 선택해요.', activityType: 'listen-and-select', estimatedMinutes: 10, isReady: true },
      { id: 'last-sound', categoryId: 'phonological-awareness', title: '끝소리 찾기', description: '단어를 듣고 마지막 소리를 선택해요.', activityType: 'listen-and-select', estimatedMinutes: 10, isReady: true },
      { id: 'remove-batchim', categoryId: 'phonological-awareness', title: '받침 빼기', description: '받침 소리를 빼서 새 글자를 만들어요.', activityType: 'sound-manipulation', estimatedMinutes: 10, isReady: true },
      { id: 'remove-syllable', categoryId: 'phonological-awareness', title: '음절 빼기', description: '낱말에서 소리 하나를 빼요.', activityType: 'sound-manipulation', estimatedMinutes: 10, isReady: true },
      { id: 'replace-syllable', categoryId: 'phonological-awareness', title: '음절 바꾸기', description: '낱말의 소리 하나를 다른 소리로 바꿔요.', activityType: 'sound-manipulation', estimatedMinutes: 12, isReady: true },
      { id: 'sound-combine', categoryId: 'phonological-awareness', title: '소리 합치기', description: '나누어진 소리를 듣고 하나로 합쳐요.', activityType: 'sound-blend', estimatedMinutes: 12, isReady: true },
    ],
  },
  {
    id: 'phonics',
    title: '파닉스 훈련',
    description: '글자를 모아 소리를 만들어요.',
    image: phonicsIcon,
    lessons: [
      { id: 'trace-consonant', categoryId: 'phonics', title: '자음 따라 보기', description: '눈으로 획을 따라가고 자음 소리를 말해요.', activityType: 'gaze-trace', estimatedMinutes: 8, isReady: true },
      { id: 'trace-vowel', categoryId: 'phonics', title: '모음 따라 보기', description: '눈으로 획을 따라가고 모음 소리를 말해요.', activityType: 'gaze-trace', estimatedMinutes: 8, isReady: true },
      { id: 'trace-syllable', categoryId: 'phonics', title: '글자 따라 보기', description: '눈으로 완성 글자를 따라가고 소리 내어 읽어요.', activityType: 'gaze-trace', estimatedMinutes: 10, isReady: true },
      { id: 'letter-sound-choice', categoryId: 'phonics', title: '글자 소리 고르기', description: '자음과 모음 소리를 듣고 글자를 골라요.', activityType: 'audio-letter-choice', estimatedMinutes: 8, isReady: true },
      { id: 'build-basic-letter', categoryId: 'phonics', title: '기본 글자 만들기', description: '초성과 중성 카드를 모아 글자를 만들어요.', activityType: 'letter-build', estimatedMinutes: 10, isReady: true },
      { id: 'build-batchim-letter', categoryId: 'phonics', title: '받침 글자 만들기', description: '받침까지 넣어 글자를 만들어요.', activityType: 'letter-build', estimatedMinutes: 10, isReady: true },
      { id: 'build-double-batchim-letter', categoryId: 'phonics', title: '겹받침 글자 만들기', description: '겹받침 카드를 넣어 글자를 만들어요.', activityType: 'letter-build', estimatedMinutes: 12, isReady: true },
      { id: 'battle-rabbit', categoryId: 'phonics', title: '토끼와 한글 대결', description: '토끼보다 먼저 낱말을 만들어요.', activityType: 'hangul-battle', estimatedMinutes: 8, isReady: true },
      { id: 'battle-turtle', categoryId: 'phonics', title: '거북이와 한글 대결', description: '거북이보다 먼저 받침 낱말을 만들어요.', activityType: 'hangul-battle', estimatedMinutes: 10, isReady: true },
      { id: 'battle-ant', categoryId: 'phonics', title: '개미와 한글 대결', description: '개미보다 먼저 겹받침 낱말을 만들어요.', activityType: 'hangul-battle', estimatedMinutes: 12, isReady: true },
      { id: 'batchim-sound', categoryId: 'phonics', title: '받침 소리 익히기', description: '받침이 있는 음절의 끝소리를 듣고 선택해요.', activityType: 'listen-and-select', estimatedMinutes: 10, isReady: true },
      { id: 'similar-sound', categoryId: 'phonics', title: '비슷한 소리 구별하기', description: 'ㄱ, ㅋ처럼 비슷하게 들리는 소리를 비교해요.', activityType: 'sound-choice', estimatedMinutes: 12, isReady: true },
    ],
  },
  {
    id: 'short-text',
    title: '짧은 글 훈련',
    description: '짧은 문장을 차근차근 읽어요.',
    image: shortTextIcon,
    lessons: [
      { id: 'repeat-sentence', categoryId: 'short-text', title: '한 문장 따라 읽기', description: '문장을 듣고 따라 읽어봐요.', activityType: 'read-aloud', estimatedMinutes: 8, isReady: true },
      { id: 'fill-blank', categoryId: 'short-text', title: '빈칸에 알맞은 단어 넣기', description: '빈칸에 들어갈 알맞은 단어를 선택해요.', activityType: 'fill-blank', estimatedMinutes: 10, isReady: true },
      { id: 'match-picture', categoryId: 'short-text', title: '그림과 문장 연결하기', description: '그림에 맞는 문장을 골라봐요.', activityType: 'sentence-choice', estimatedMinutes: 10, isReady: true },
      { id: 'hard-word', categoryId: 'short-text', title: '어려운 단어 먼저 읽기', description: '어려운 단어를 음절 단위로 분리해서 읽어요.', activityType: 'read-aloud', estimatedMinutes: 8, isReady: true },
      { id: 'sentence-order', categoryId: 'short-text', title: '문장 전체 조립하기', description: '어절 카드를 빈칸에 놓아 문장을 만들어요.', activityType: 'sentence-order', estimatedMinutes: 12, isReady: true },
    ],
  },
  {
    id: 'fluency',
    title: '유창성 훈련',
    description: '문장을 자연스럽게 읽어봐요.',
    image: fluencyIcon,
    lessons: [
      { id: 'read-real-words', categoryId: 'fluency', title: '낱말 읽기', description: '네 낱말을 눈으로 보고 소리 내어 읽어요.', activityType: 'word-reading-grid', estimatedMinutes: 8, isReady: true },
      { id: 'read-nonwords', categoryId: 'fluency', title: '새 낱말 읽기', description: '처음 보는 낱말도 소리 내어 읽어요.', activityType: 'word-reading-grid', estimatedMinutes: 8, isReady: true },
      { id: 'read-sentences', categoryId: 'fluency', title: '문장 읽기', description: '한 문장을 왼쪽부터 또박또박 읽어요.', activityType: 'sentence-reading', estimatedMinutes: 9, isReady: true },
      { id: 'read-short-passage', categoryId: 'fluency', title: '짧은 글 읽기', description: '문장을 차례대로 이어 읽어요.', activityType: 'sentence-reading', estimatedMinutes: 10, isReady: true },
      { id: 'word-chain', categoryId: 'fluency', title: '단어 이어 읽기', description: '단어를 이어서 자연스럽게 읽어요.', activityType: 'read-aloud', estimatedMinutes: 8, isReady: true },
      { id: 'follow-sentence', categoryId: 'fluency', title: '문장 따라 읽기', description: '모범 읽기를 듣고 따라 읽어봐요.', activityType: 'read-aloud', estimatedMinutes: 10, isReady: true },
      { id: 'phrase-reading', categoryId: 'fluency', title: '끊어 읽기', description: '적절한 곳에서 끊어서 읽어요.', activityType: 'read-aloud', estimatedMinutes: 10, isReady: true },
      { id: 're-read', categoryId: 'fluency', title: '같은 문장 다시 읽기', description: '같은 문장을 여러 번 반복해서 읽어요.', activityType: 'read-aloud', estimatedMinutes: 8, isReady: true },
      { id: 'short-story', categoryId: 'fluency', title: '짧은 이야기 읽기', description: '짧은 이야기를 자연스럽게 읽어요.', activityType: 'read-aloud', estimatedMinutes: 12, isReady: true },
    ],
  },
]
