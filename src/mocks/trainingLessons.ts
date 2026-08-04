// 플레이 가능한 레슨 목업 데이터
// 각 훈련 대분류별로 한 레슨씩만 실제로 동작합니다.
// 나머지 레슨은 "이 훈련은 준비하고 있어요." 처리됩니다.

import type { TrainingLesson } from '@/types/training'
import { personalizeRuntimeValue } from '@/services/learnerDataRepository'
import { traceConsonantLesson, traceSyllableLesson, traceVowelLesson } from './gazeTraceLessons'
import { letterSoundChoiceLesson, wordFirstSoundChoiceLesson } from './audioChoiceLessons'
import { basicLetterBuildLesson, batchimLetterBuildLesson, doubleBatchimLetterBuildLesson } from './letterBuildLessons'
import { removeBatchimLesson, replaceSyllableLesson } from './soundManipulationLessons'
import {
  batchimWordReadingLesson,
  nonwordReadingLesson,
  realWordReadingLesson,
  shortSentenceWordReadingLesson,
} from './wordReadingLessons'
import { sentenceReadingLesson } from './sentenceReadingLessons'
import { shortPassageReadingLesson } from './shortPassageReadingLessons'
import { pictureSentenceLesson } from './pictureSentenceLessons'
import {
  batchimSoundLesson,
  consonantSoundLesson,
  similarSoundLesson,
  vowelSoundLesson,
} from './phonicsLessons'
import {
  fillBlankLesson,
  repeatSentenceLesson,
  sentenceOrderLesson,
} from './shortTextLessons'
import {
  phraseReadingLesson,
  reReadLesson,
  shortStoryLesson,
  wordChainLesson,
} from './fluencyLessons'

// 음운 인식 - 같은 소리 찾기 (낱말을 듣고 같은 첫소리의 낱말 선택)
export const sameSoundLesson: TrainingLesson = {
  id: 'same-sound',
  categoryId: 'phonological-awareness',
  title: '비슷한 소리 찾기',
  description: '두 낱말의 첫소리가 같은지 들어봐요.',
  activityType: 'listen-and-select',
  estimatedMinutes: 10,
  questions: [
    {
      id: 'q1',
      instruction: '비슷한 소리를 찾아봐!',
      subInstruction: "'가방'과 같은 소리로 시작하는 낱말은?",
      targetText: '가방',
      targetSound: 'ㄱ',
      choices: [
        { id: 'scissors', text: '가위' },
        { id: 'butterfly', text: '나비' },
        { id: 'hat', text: '모자' },
      ],
      answer: 'scissors',
      feedback: {
        correct: '잘 들었어요! 가방과 가위는 같은 소리로 시작해요.',
        retry: '소리를 다시 듣고 골라봐요.',
      },
    },
    {
      id: 'q2',
      instruction: '비슷한 소리를 찾아봐!',
      subInstruction: "'나비'와 같은 소리로 시작하는 낱말은?",
      targetText: '나비',
      targetSound: 'ㄴ',
      choices: [
        { id: 'bridge', text: '다리' },
        { id: 'tree', text: '나무' },
        { id: 'lion', text: '사자' },
      ],
      answer: 'tree',
      feedback: {
        correct: '맞아요! 나비와 나무는 같은 소리로 시작해요.',
        retry: '천천히 한 번 더 들어봐요.',
      },
    },
    {
      id: 'q3',
      instruction: '비슷한 소리를 찾아봐!',
      subInstruction: "'모자'와 같은 소리로 시작하는 낱말은?",
      targetText: '모자',
      targetSound: 'ㅁ',
      choices: [
        { id: 'sand', text: '모래' },
        { id: 'train', text: '기차' },
        { id: 'rabbit', text: '토끼' },
      ],
      answer: 'sand',
      feedback: {
        correct: '잘 찾았어요! 모자와 모래는 같은 소리로 시작해요.',
        retry: '첫 소리를 다시 들어봐요.',
      },
    },
    {
      id: 'q4',
      instruction: '비슷한 소리를 찾아봐!',
      subInstruction: "'사과'와 같은 소리로 시작하는 낱말은?",
      targetText: '사과',
      targetSound: 'ㅅ',
      choices: [
        { id: 'lion', text: '사자' },
        { id: 'banana', text: '바나나' },
        { id: 'train', text: '기차' },
      ],
      answer: 'lion',
      feedback: {
        correct: '맞아요! 사과와 사자는 같은 소리로 시작해요.',
        retry: '소리를 다시 듣고 찾아봐요.',
      },
    },
    {
      id: 'q5',
      instruction: '비슷한 소리를 찾아봐!',
      subInstruction: "'토끼'와 같은 소리로 시작하는 낱말은?",
      targetText: '토끼',
      targetSound: 'ㅌ',
      choices: [
        { id: 'tomato', text: '토마토' },
        { id: 'hat', text: '모자' },
        { id: 'butterfly', text: '나비' },
      ],
      answer: 'tomato',
      feedback: {
        correct: '훌륭해요! 토끼와 토마토는 같은 소리로 시작해요.',
        retry: '한 번 더 천천히 들어봐요.',
        completed: '같은 소리 찾기를 모두 마쳤어요!',
      },
    },
  ],
}

// 음운 인식 - 첫소리 찾기 (글자 카드로 첫소리 선택)
export const firstSoundLesson: TrainingLesson = {
  id: 'first-sound',
  categoryId: 'phonological-awareness',
  title: '첫소리 찾기',
  description: '단어를 듣고 첫 번째 소리를 찾아요.',
  activityType: 'listen-and-select',
  estimatedMinutes: 10,
  questions: [
    {
      id: 'q1',
      instruction: '첫소리를 찾아봐요.',
      subInstruction: "'가방'의 첫소리는 무엇일까요?",
      targetText: '가방',
      targetSound: 'ㄱ',
      // 리소스 추가 필요: 가방 그림 PNG
      targetImageLabel: '가방 그림',
      choices: [
        { id: 'g', letter: { jamo: 'ㄱ', type: 'consonant' } },
        { id: 'n', letter: { jamo: 'ㄴ', type: 'consonant' } },
        { id: 'm', letter: { jamo: 'ㅁ', type: 'consonant' } },
      ],
      answer: 'g',
      hint: {
        level1: '가방의 맨 앞 소리를 천천히 들어봐요. "가~방"',
        level2: 'ㄱ 소리를 찾아봐요.',
        highlightChoiceId: 'g',
      },
      feedback: {
        correct: '잘 찾았어요! 가방의 첫소리는 ㄱ이네요.',
        retry: '다시 한번 들어볼까요?',
      },
    },
    {
      id: 'q2',
      instruction: '첫소리를 찾아봐요.',
      subInstruction: "'나비'의 첫소리는 무엇일까요?",
      targetText: '나비',
      targetSound: 'ㄴ',
      // 리소스 추가 필요: 나비 그림 PNG
      targetImageLabel: '나비 그림',
      choices: [
        { id: 'd', letter: { jamo: 'ㄷ', type: 'consonant' } },
        { id: 'n', letter: { jamo: 'ㄴ', type: 'consonant' } },
        { id: 's', letter: { jamo: 'ㅅ', type: 'consonant' } },
      ],
      answer: 'n',
      hint: {
        level1: '나비의 맨 앞 소리를 천천히 들어봐요. "나~비"',
        level2: 'ㄴ 소리를 찾아봐요.',
        highlightChoiceId: 'n',
      },
      feedback: {
        correct: '멋지게 찾았어요! 나비의 첫소리는 ㄴ이네요.',
        retry: '괜찮아요. 한 번 더 해봐요.',
      },
    },
    {
      id: 'q3',
      instruction: '첫소리를 찾아봐요.',
      subInstruction: "'모자'의 첫소리는 무엇일까요?",
      targetText: '모자',
      targetSound: 'ㅁ',
      // 리소스 추가 필요: 모자 그림 PNG
      targetImageLabel: '모자 그림',
      choices: [
        { id: 'm', letter: { jamo: 'ㅁ', type: 'consonant' } },
        { id: 'b', letter: { jamo: 'ㅂ', type: 'consonant' } },
        { id: 'j', letter: { jamo: 'ㅈ', type: 'consonant' } },
      ],
      answer: 'm',
      hint: {
        level1: '모자의 맨 앞 소리를 천천히 들어봐요. "모~자"',
        level2: 'ㅁ 소리를 찾아봐요.',
        highlightChoiceId: 'm',
      },
      feedback: {
        correct: '소리를 아주 잘 들었어요! 모자의 첫소리는 ㅁ이네요.',
        retry: '천천히 다시 들어볼까요?',
      },
    },
    {
      id: 'q4',
      instruction: '첫소리를 찾아봐요.',
      subInstruction: "'다리'의 첫소리는 무엇일까요?",
      targetText: '다리',
      targetSound: 'ㄷ',
      // 리소스 추가 필요: 다리 그림 PNG
      targetImageLabel: '다리 그림',
      choices: [
        { id: 't', letter: { jamo: 'ㅌ', type: 'consonant' } },
        { id: 'd', letter: { jamo: 'ㄷ', type: 'consonant' } },
        { id: 'r', letter: { jamo: 'ㄹ', type: 'consonant' } },
      ],
      answer: 'd',
      hint: {
        level1: '다리의 맨 앞 소리를 천천히 들어봐요. "다~리"',
        level2: 'ㄷ 소리를 찾아봐요.',
        highlightChoiceId: 'd',
      },
      feedback: {
        correct: '훌륭해요! 다리의 첫소리는 ㄷ이네요.',
        retry: '천천히 다시 골라봐요.',
      },
    },
    {
      id: 'q5',
      instruction: '첫소리를 찾아봐요.',
      subInstruction: "'사과'의 첫소리는 무엇일까요?",
      targetText: '사과',
      targetSound: 'ㅅ',
      // 리소스 추가 필요: 사과 그림 PNG
      targetImageLabel: '사과 그림',
      choices: [
        { id: 's', letter: { jamo: 'ㅅ', type: 'consonant' } },
        { id: 'k', letter: { jamo: 'ㅋ', type: 'consonant' } },
        { id: 'c', letter: { jamo: 'ㅊ', type: 'consonant' } },
      ],
      answer: 's',
      hint: {
        level1: '사과의 맨 앞 소리를 천천히 들어봐요. "사~과"',
        level2: 'ㅅ 소리를 찾아봐요.',
        highlightChoiceId: 's',
      },
      feedback: {
        correct: '한 번에 찾았네요! 사과의 첫소리는 ㅅ이네요.',
        retry: '다시 한번 해볼까요?',
        completed: '첫소리 찾기를 모두 마쳤어요! ㄱ, ㄴ, ㅁ, ㄷ, ㅅ 소리를 연습했어요.',
      },
    },
  ],
}

// 음운 인식 - 끝소리 찾기 (낱말을 듣고 받침 소리 선택)
export const lastSoundLesson: TrainingLesson = {
  id: 'last-sound',
  categoryId: 'phonological-awareness',
  title: '끝소리 찾기',
  description: '낱말을 듣고 마지막 소리를 찾아요.',
  activityType: 'listen-and-select',
  estimatedMinutes: 10,
  questions: [
    {
      id: 'q1',
      instruction: '끝소리를 찾아봐요.',
      subInstruction: "'산'의 끝소리는 무엇일까요?",
      targetText: '산',
      targetSound: 'ㄴ',
      choices: [
        { id: 'n', letter: { jamo: 'ㄴ', type: 'consonant' } },
        { id: 'm', letter: { jamo: 'ㅁ', type: 'consonant' } },
        { id: 'r', letter: { jamo: 'ㄹ', type: 'consonant' } },
      ],
      answer: 'n',
      feedback: {
        correct: '잘 찾았어요! 산의 끝소리는 ㄴ이에요.',
        retry: '낱말의 마지막 소리를 다시 들어봐요.',
      },
    },
    {
      id: 'q2',
      instruction: '끝소리를 찾아봐요.',
      subInstruction: "'밤'의 끝소리는 무엇일까요?",
      targetText: '밤',
      targetSound: 'ㅁ',
      choices: [
        { id: 'r', letter: { jamo: 'ㄹ', type: 'consonant' } },
        { id: 'm', letter: { jamo: 'ㅁ', type: 'consonant' } },
        { id: 'g', letter: { jamo: 'ㄱ', type: 'consonant' } },
      ],
      answer: 'm',
      feedback: {
        correct: '맞아요! 밤의 끝소리는 ㅁ이에요.',
        retry: '끝부분을 천천히 다시 들어봐요.',
      },
    },
    {
      id: 'q3',
      instruction: '끝소리를 찾아봐요.',
      subInstruction: "'달'의 끝소리는 무엇일까요?",
      targetText: '달',
      targetSound: 'ㄹ',
      choices: [
        { id: 'n', letter: { jamo: 'ㄴ', type: 'consonant' } },
        { id: 'r', letter: { jamo: 'ㄹ', type: 'consonant' } },
        { id: 'b', letter: { jamo: 'ㅂ', type: 'consonant' } },
      ],
      answer: 'r',
      feedback: {
        correct: '잘 들었어요! 달의 끝소리는 ㄹ이에요.',
        retry: '마지막 소리에 귀 기울여봐요.',
      },
    },
    {
      id: 'q4',
      instruction: '끝소리를 찾아봐요.',
      subInstruction: "'책'의 끝소리는 무엇일까요?",
      targetText: '책',
      targetSound: 'ㄱ',
      choices: [
        { id: 'g', letter: { jamo: 'ㄱ', type: 'consonant' } },
        { id: 's', letter: { jamo: 'ㅅ', type: 'consonant' } },
        { id: 'm', letter: { jamo: 'ㅁ', type: 'consonant' } },
      ],
      answer: 'g',
      feedback: {
        correct: '맞아요! 책의 끝소리는 ㄱ이에요.',
        retry: '책의 끝부분을 다시 들어봐요.',
      },
    },
    {
      id: 'q5',
      instruction: '끝소리를 찾아봐요.',
      subInstruction: "'옷'의 끝소리는 무엇일까요?",
      targetText: '옷',
      targetSound: 'ㄷ',
      choices: [
        { id: 'd', letter: { jamo: 'ㄷ', type: 'consonant' } },
        { id: 's', letter: { jamo: 'ㅅ', type: 'consonant' } },
        { id: 'n', letter: { jamo: 'ㄴ', type: 'consonant' } },
      ],
      answer: 'd',
      feedback: {
        correct: '훌륭해요! 옷의 끝에서 ㄷ 소리가 나요.',
        retry: '소리 나는 끝부분을 다시 들어봐요.',
        completed: '끝소리 찾기를 모두 마쳤어요!',
      },
    },
  ],
}

// 음운 인식 - 음절 빼기(음절 생략): 원래 낱말에서 한 소리를 빼 목표 낱말 만들기
export const soundSplitLesson: TrainingLesson = {
  id: 'sound-split',
  categoryId: 'phonological-awareness',
  title: '음절 빼기',
  description: '낱말에서 소리 하나를 빼고 들은 낱말을 만들어요.',
  activityType: 'sound-omit',
  estimatedMinutes: 12,
  questions: [
    {
      id: 'q1',
      instruction: '한 소리를 빼봐요.',
      subInstruction: '바나나에서 소리 하나를 빼고, 들은 낱말을 만들어요.',
      targetText: '바나나',
      audioText: '바나',
      soundParts: ['바', '나', '나'],
      answer: '바나',
      feedback: { correct: '맞아요! 바나나에서 나를 빼면 바나가 돼요.', retry: '들은 소리와 다른 한 조각을 다시 찾아봐요.' },
    },
    {
      id: 'q2',
      instruction: '한 소리를 빼봐요.',
      subInstruction: '고구마에서 소리 하나를 빼고, 들은 낱말을 만들어요.',
      targetText: '고구마',
      audioText: '고마',
      soundParts: ['고', '구', '마'],
      answer: '고마',
      feedback: { correct: '잘했어요! 고구마에서 구를 빼면 고마가 돼요.', retry: '들은 소리에는 없는 조각을 찾아봐요.' },
    },
    {
      id: 'q3',
      instruction: '한 소리를 빼봐요.',
      subInstruction: '코끼리에서 소리 하나를 빼고, 들은 낱말을 만들어요.',
      targetText: '코끼리',
      audioText: '코리',
      soundParts: ['코', '끼', '리'],
      answer: '코리',
      feedback: { correct: '맞아요! 코끼리에서 끼를 빼면 코리가 돼요.', retry: '목표 소리를 다시 듣고 다른 조각을 빼봐요.' },
    },
    {
      id: 'q4',
      instruction: '한 소리를 빼봐요.',
      subInstruction: '기차표에서 소리 하나를 빼고, 들은 낱말을 만들어요.',
      targetText: '기차표',
      audioText: '기차',
      soundParts: ['기', '차', '표'],
      answer: '기차',
      feedback: { correct: '잘했어요! 기차표에서 표를 빼면 기차가 돼요.', retry: '들은 낱말의 끝소리를 다시 확인해봐요.' },
    },
    {
      id: 'q5',
      instruction: '한 소리를 빼봐요.',
      subInstruction: '무지개에서 소리 하나를 빼고, 들은 낱말을 만들어요.',
      targetText: '무지개',
      audioText: '지개',
      soundParts: ['무', '지', '개'],
      answer: '지개',
      feedback: { correct: '훌륭해요! 무지개에서 무를 빼면 지개가 돼요.', retry: '처음 소리부터 천천히 비교해봐요.', completed: '소리 나누기를 모두 마쳤어요!' },
    },
  ],
}

// 음운 인식 - 소리 합치기 (나뉜 소리를 듣고 음절 카드를 순서대로 배치)
export const soundCombineLesson: TrainingLesson = {
  id: 'sound-combine',
  categoryId: 'phonological-awareness',
  title: '소리 합치기',
  description: '나뉜 소리를 듣고 하나의 낱말로 모아요.',
  activityType: 'sound-blend',
  estimatedMinutes: 12,
  questions: [
    {
      id: 'q1',
      instruction: '소리를 합쳐봐요.',
      subInstruction: '들은 소리를 차례로 모아보세요.',
      combined: '가방',
      soundParts: ['가', '방'],
      choices: [
        { id: 'bang', text: '방' },
        { id: 'na', text: '나' },
        { id: 'ga', text: '가' },
      ],
      answer: 'ga|bang',
      feedback: { correct: '맞아요! 가와 방을 합치면 가방이 돼요.', retry: '소리의 순서를 다시 들어봐요.' },
    },
    {
      id: 'q2',
      instruction: '소리를 합쳐봐요.',
      subInstruction: '들은 소리를 차례로 모아보세요.',
      combined: '나비',
      soundParts: ['나', '비'],
      choices: [
        { id: 'bi', text: '비' },
        { id: 'mo', text: '모' },
        { id: 'na', text: '나' },
      ],
      answer: 'na|bi',
      feedback: { correct: '잘했어요! 나와 비를 합치면 나비가 돼요.', retry: '첫 소리부터 다시 모아봐요.' },
    },
    {
      id: 'q3',
      instruction: '소리를 합쳐봐요.',
      subInstruction: '들은 소리를 차례로 모아보세요.',
      combined: '모자',
      soundParts: ['모', '자'],
      choices: [
        { id: 'ja', text: '자' },
        { id: 'sa', text: '사' },
        { id: 'mo', text: '모' },
      ],
      answer: 'mo|ja',
      feedback: { correct: '맞아요! 모와 자를 합치면 모자가 돼요.', retry: '나뉜 소리를 다시 들어봐요.' },
    },
    {
      id: 'q4',
      instruction: '소리를 합쳐봐요.',
      subInstruction: '들은 소리를 차례로 모아보세요.',
      combined: '사과',
      soundParts: ['사', '과'],
      choices: [
        { id: 'gwa', text: '과' },
        { id: 'sa', text: '사' },
        { id: 'ga', text: '가' },
      ],
      answer: 'sa|gwa',
      feedback: { correct: '잘 모았어요! 사와 과를 합치면 사과가 돼요.', retry: '두 소리의 순서를 다시 들어봐요.' },
    },
    {
      id: 'q5',
      instruction: '소리를 합쳐봐요.',
      subInstruction: '들은 소리를 차례로 모아보세요.',
      combined: '기차',
      soundParts: ['기', '차'],
      choices: [
        { id: 'cha', text: '차' },
        { id: 'na', text: '나' },
        { id: 'gi', text: '기' },
      ],
      answer: 'gi|cha',
      feedback: { correct: '훌륭해요! 기와 차를 합치면 기차가 돼요.', retry: '소리를 다시 듣고 차례로 모아봐요.', completed: '소리 합치기를 모두 마쳤어요!' },
    },
  ],
}

// 유창성 - 문장 따라 읽기 (모범 음성 듣기 + 녹음)
export const followSentenceLesson: TrainingLesson = {
  id: 'follow-sentence',
  categoryId: 'fluency',
  title: '문장 따라 읽기',
  description: '모범 음성을 듣고 따라 읽어요.',
  activityType: 'word-reading-grid',
  estimatedMinutes: 10,
  questions: [
    {
      id: 'q1',
      instruction: '문장을 따라 읽어봐요.',
      subInstruction: '모범 음성을 듣고 따라 읽어요.',
      targetText: '토끼가 산으로 가요.',
      phraseChunks: ['토끼가', '산으로', '가요.'],
      answer: 'q1',
      hint: { level1: '천천히 따라 읽어봐요.', level2: '토끼가 / 산으로 / 가요.' },
      feedback: {
        correct: '잘 읽었어요! 자연스럽게 읽네요.',
        retry: '천천히 다시 읽어볼까요?',
      },
    },
    {
      id: 'q2',
      instruction: '문장을 따라 읽어봐요.',
      subInstruction: '모범 음성을 듣고 따라 읽어요.',
      targetText: '노란 나비가 날아가요.',
      phraseChunks: ['노란', '나비가', '날아가요.'],
      answer: 'q2',
      hint: { level1: '나비가 어디로 날아가나요?', level2: '노란 / 나비가 / 날아가요.' },
      feedback: {
        correct: '멋지게 읽었어요! 발음이 또렷하네요.',
        retry: '괜찮아요. 한 번 더 읽어봐요.',
      },
    },
    {
      id: 'q3',
      instruction: '문장을 따라 읽어봐요.',
      subInstruction: '모범 음성을 듣고 따라 읽어요.',
      targetText: '민수는 작은 공을 잡아요.',
      phraseChunks: ['민수는', '작은', '공을', '잡아요.'],
      answer: 'q3',
      hint: { level1: '민수가 무엇을 잡나요?', level2: '민수는 / 작은 / 공을 / 잡아요.' },
      feedback: {
        correct: '훌륭해요! 문장을 또박또박 읽었네요.',
        retry: '천천히 다시 읽어볼까요?',
      },
    },
    {
      id: 'q4',
      instruction: '문장을 따라 읽어봐요.',
      subInstruction: '모범 음성을 듣고 따라 읽어요.',
      targetText: '오늘은 햇빛이 따뜻해요.',
      phraseChunks: ['오늘은', '햇빛이', '따뜻해요.'],
      answer: 'q4',
      hint: { level1: '오늘 날씨가 어떠한가요?', level2: '오늘은 / 햇빛이 / 따뜻해요.' },
      feedback: {
        correct: '잘 읽었어요! 감정이 살아있네요.',
        retry: '천천히 다시 읽어봐요.',
        completed: '문장 따라 읽기를 모두 마쳤어요! 문장을 자연스럽게 익혔어요.',
      },
    },
  ],
}

// 레슨 맵 (레슨 ID로 레슨 데이터 조회)
export const lessonMap: Record<string, TrainingLesson> = {
  'trace-consonant': traceConsonantLesson,
  'trace-vowel': traceVowelLesson,
  'trace-syllable': traceSyllableLesson,
  'letter-sound-choice': letterSoundChoiceLesson,
  'word-first-sound-choice': wordFirstSoundChoiceLesson,
  'build-basic-letter': basicLetterBuildLesson,
  'build-batchim-letter': batchimLetterBuildLesson,
  'build-double-batchim-letter': doubleBatchimLetterBuildLesson,
  'remove-batchim': removeBatchimLesson,
  'replace-syllable': replaceSyllableLesson,
  'read-real-words': realWordReadingLesson,
  'read-batchim-words': batchimWordReadingLesson,
  'read-nonwords': nonwordReadingLesson,
  'read-short-sentences': shortSentenceWordReadingLesson,
  'read-sentences': sentenceReadingLesson,
  'read-short-passage': shortPassageReadingLesson,
  'same-sound': sameSoundLesson,
  'first-sound': firstSoundLesson,
  'last-sound': lastSoundLesson,
  'sound-split': soundSplitLesson,
  'sound-combine': soundCombineLesson,
  'consonant-sound': consonantSoundLesson,
  'vowel-sound': vowelSoundLesson,
  'batchim-sound': batchimSoundLesson,
  'similar-sound': similarSoundLesson,
  'repeat-sentence': repeatSentenceLesson,
  'fill-blank': fillBlankLesson,
  'match-picture': pictureSentenceLesson,
  'sentence-order': sentenceOrderLesson,
  'word-chain': wordChainLesson,
  'follow-sentence': followSentenceLesson,
  'phrase-reading': phraseReadingLesson,
  're-read': reReadLesson,
  'short-story': shortStoryLesson,
}

interface DevPreviewDefinition {
  id: string
  title: string
  sourceLessonIds: string[]
}

const devPreviewDefinitions: DevPreviewDefinition[] = [
  {
    id: 'gaze-trace',
    title: '따라 보기 UI',
    sourceLessonIds: ['trace-consonant', 'trace-vowel', 'trace-syllable'],
  },
  {
    id: 'audio-letter-choice',
    title: '소리 듣고 글자 고르기 UI',
    sourceLessonIds: ['letter-sound-choice', 'word-first-sound-choice'],
  },
  {
    id: 'listen-and-select',
    title: '듣고 카드 고르기 UI',
    sourceLessonIds: ['same-sound', 'first-sound', 'last-sound', 'batchim-sound'],
  },
  {
    id: 'sound-choice',
    title: '비슷한 소리 고르기 UI',
    sourceLessonIds: ['consonant-sound', 'vowel-sound', 'similar-sound'],
  },
  {
    id: 'sound-blend',
    title: '소리 합치기 UI',
    sourceLessonIds: ['sound-combine'],
  },
  {
    id: 'letter-build',
    title: '글자 만들기 UI',
    sourceLessonIds: ['build-basic-letter', 'build-batchim-letter', 'build-double-batchim-letter'],
  },
  {
    id: 'sound-manipulation',
    title: '소리 바꾸기 UI',
    sourceLessonIds: ['replace-syllable'],
  },
  {
    id: 'sound-omit',
    title: '소리 빼기 UI',
    sourceLessonIds: ['remove-batchim', 'sound-split'],
  },
  {
    id: 'word-reading-grid',
    title: '눈으로 보고 읽기 UI',
    sourceLessonIds: [
      'read-real-words',
      'read-batchim-words',
      'read-nonwords',
      'read-short-sentences',
      'read-sentences',
      'read-short-passage',
      'follow-sentence',
      'word-chain',
      'phrase-reading',
      're-read',
      'short-story',
      'repeat-sentence',
    ],
  },
  {
    id: 'fill-blank',
    title: '빈칸 채우기 UI',
    sourceLessonIds: ['fill-blank'],
  },
  {
    id: 'sentence-choice',
    title: '그림·문장 연결 UI',
    sourceLessonIds: ['match-picture'],
  },
  {
    id: 'sentence-order',
    title: '문장 조립 UI',
    sourceLessonIds: ['sentence-order'],
  },
]

export const devPreviewSourceLessonIds = devPreviewDefinitions.flatMap(
  (definition) => definition.sourceLessonIds,
)

export const devPreviewLessons: TrainingLesson[] = devPreviewDefinitions.map((definition) => {
  const sourceLessons = definition.sourceLessonIds.map((lessonId) => {
    const lesson = lessonMap[lessonId]
    if (!lesson) throw new Error(`DEV 미리보기 원본 훈련을 찾을 수 없습니다: ${lessonId}`)
    return lesson
  })
  const firstLesson = sourceLessons[0]
  if (!firstLesson) throw new Error(`DEV 미리보기 훈련 구성이 비어 있습니다: ${definition.id}`)
  if (sourceLessons.some((lesson) => lesson.activityType !== firstLesson.activityType)) {
    throw new Error(`DEV 미리보기 화면 유형이 서로 다릅니다: ${definition.id}`)
  }

  return {
    id: `dev-preview-${definition.id}`,
    categoryId: firstLesson.categoryId,
    title: definition.title,
    description: '같은 화면을 사용하는 훈련의 대표 문제를 하나씩 확인합니다.',
    activityType: firstLesson.activityType,
    estimatedMinutes: 1,
    questions: sourceLessons.map((lesson) => {
      const question = lesson.questions[0]
      if (!question) throw new Error(`DEV 미리보기 원본 문항이 없습니다: ${lesson.id}`)
      return {
        ...question,
        id: `dev-${definition.id}-${lesson.id}`,
      }
    }),
  }
})

const devPreviewLessonMap: Record<string, TrainingLesson> = Object.fromEntries(
  devPreviewLessons.map((lesson) => [lesson.id, lesson]),
)

// DEV 메뉴 개편 전에 공유된 미리보기 URL도 계속 열리게 한다.
// 화면은 현재 통합 Activity를 그대로 사용하고 ID만 호환한다.
const legacyDevPreviewLessonAliases: Readonly<Record<string, string>> = {
  'dev-preview-first-sound': 'dev-preview-listen-and-select',
  'dev-preview-word-first-sound-choice': 'dev-preview-audio-letter-choice',
}

export const getLessonById = (id: string): TrainingLesson | null => {
  const canonicalId = legacyDevPreviewLessonAliases[id] ?? id
  const lesson = lessonMap[canonicalId] ?? devPreviewLessonMap[canonicalId]
  if (!lesson) return null
  return personalizeRuntimeValue(canonicalId === id ? lesson : { ...lesson, id })
}
