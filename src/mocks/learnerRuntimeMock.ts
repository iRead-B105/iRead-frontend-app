/**
 * 백엔드 응답으로 교체될 아동별 런타임 목업 데이터의 단일 원본입니다.
 *
 * 여기에 포함하는 값:
 * - 로그인 후 선택되는 아동과 프로필
 * - 현재 학습 회차와 진행 순서
 * - 아동별 이야기 세션, 진행률, 생성된 본문
 * - 성장 단계, 획득 친구
 *
 * 훈련 종류·버튼 문구·색상처럼 사용자와 무관한 제품 설정은 포함하지 않습니다.
 */

import aliceCover from '@/assets/story/covers/alice-cover.png'
import antAndGrasshopperCover from '@/assets/story/covers/ant-and-grasshopper.png'
import oldManAndSeaCover from '@/assets/story/covers/old-man-and-sea.png'
import aliceFriend from '@/assets/story/characters/alice-friend.png'
import grasshopperFriend from '@/assets/story/characters/grasshopper-friend.png'
import oldFishermanFriend from '@/assets/story/characters/old-fisherman-friend.png'
import storyScene from '@/assets/story/story-reader-turtle-scene-mock.png'
import type { TrainingCategoryId } from '@/types/training'
import type { VillageItem } from '@/types/village'

export interface MockLinkedStudent {
  studentId: string
  name: string
  age: number
  profileColor: string
  profileImageUrl: string | null
}

export type MockCurriculumStatus = 'PREPARING' | 'READY' | 'REST' | 'COMPLETED'

export interface MockCurriculumTraining {
  trainingId: string
  trainingTemplateId: string
  order: number
  categoryId: TrainingCategoryId
  lessonId: string
  unitName: string
  name: string
  status: 'COMPLETED' | 'CURRENT' | 'LOCKED'
}

export interface MockCurrentCurriculum {
  curriculumId: string
  studyDate: string | null
  status: MockCurriculumStatus
  currentOrder: number
  trainings: MockCurriculumTraining[]
}

export type MockStoryStatus = 'UNREAD' | 'IN_PROGRESS' | 'COMPLETED'

export interface MockStoryTemplate {
  templateId: string
  title: string
  coverImageUrl: string
}

export interface MockStorySession {
  storyId: string
  templateId: string
  sessionNumber: number
  createdAt: string
  lastReadAt: string | null
  title: string
  latestBranchSubtitle: string
  coverImageUrl: string
  entryImageUrl: string | null
  status: MockStoryStatus
  progress: number
}

export interface MockStoryPage {
  lineId: string
  order: number
  lines: string[]
  imageUrl: string
  imagePosition?: string
  readAt: string | null
  requiresBranchInput: boolean
}

export interface MockStoryDetail {
  storyId: string
  title: string
  character: string
  branchQuestion: string
  status: 'UNREAD' | 'IN_PROGRESS' | 'COMPLETED'
  currentDay: number
  availableDay: number
  totalDays: number
  pagesPerDay: number
  dayComplete: boolean
  pages: MockStoryPage[]
}

export interface MockGrowthArea {
  areaId: 1 | 2 | 3
  name: string
  learningCount: number
  stage: number
  updatedAt: string
}

const selectedStudent: MockLinkedStudent = {
  studentId: '1001',
  name: '윤정',
  age: 9,
  profileColor: '#f18ca4',
  profileImageUrl: '/images/student-profile-girl.png',
}

export const learnerRuntimeMock = {
  auth: {
    teacherSessionToken: 'mock-teacher-session-token',
    learningAccessToken: 'mock-learning-access-token',
    selectedStudentId: selectedStudent.studentId,
    linkedStudents: [
      selectedStudent,
      {
        studentId: '1002',
        name: '민준',
        age: 10,
        profileColor: '#71a9ef',
        profileImageUrl: '/images/student-profile-boy.png',
      },
      {
        studentId: '1003',
        name: '서아',
        age: 8,
        profileColor: '#9acb62',
        profileImageUrl: '/images/student-profile-girl.png',
      },
    ] satisfies MockLinkedStudent[],
  },

  deviceStatus: {
    eyeTrackerConnected: true,
    microphoneAvailable: true,
    microphoneActive: false,
  },

  currentCurriculum: {
    curriculumId: 'curriculum-round-20260724-01',
    studyDate: '2026-07-24',
    status: 'READY',
    currentOrder: 3,
    trainings: ([
      ['phonological-awareness', 'word-first-sound-choice', '음운 인식', '낱말 첫소리 고르기'],
      ['phonological-awareness', 'same-sound', '음운 인식', '같은 소리 찾기'],
      ['phonological-awareness', 'first-sound', '음운 인식', '첫소리 찾기'],
      ['phonics', 'trace-consonant', '파닉스', '자음 따라 보기'],
      ['phonics', 'trace-vowel', '파닉스', '모음 따라 보기'],
      ['phonics', 'trace-syllable', '파닉스', '글자 따라 보기'],
      ['short-text', 'repeat-sentence', '짧은 글', '한 문장 따라 읽기'],
      ['short-text', 'fill-blank', '짧은 글', '빈칸에 낱말 넣기'],
      ['short-text', 'match-picture', '짧은 글', '그림과 문장 연결하기'],
      ['fluency', 'read-real-words', '유창성', '낱말 읽기'],
    ] as Array<[TrainingCategoryId, string, string, string]>).map(
      ([categoryId, lessonId, unitName, name], index) => ({
      trainingId: `training-${index + 1}`,
      trainingTemplateId: `template-${lessonId}`,
      order: index + 1,
      categoryId,
      lessonId,
      unitName,
      name,
      status: index < 2 ? 'COMPLETED' : index === 2 ? 'CURRENT' : 'LOCKED',
      }),
    ) satisfies MockCurriculumTraining[],
  } satisfies MockCurrentCurriculum,

  storyLibrary: {
    stories: [
      {
        storyId: 'alice',
        templateId: 'alice',
        sessionNumber: 2,
        createdAt: '2026-07-25T14:20:00+09:00',
        lastReadAt: '2026-07-26T18:10:00+09:00',
        title: '이상한 나라의 앨리스',
        latestBranchSubtitle: '웃는 고양이의 비밀 길',
        coverImageUrl: aliceCover,
        entryImageUrl: storyScene,
        status: 'IN_PROGRESS',
        progress: 62,
      },
      {
        storyId: 'ant-and-grasshopper',
        templateId: 'ant-and-grasshopper',
        sessionNumber: 1,
        createdAt: '2026-07-21T10:00:00+09:00',
        lastReadAt: '2026-07-22T16:30:00+09:00',
        title: '개미와 베짱이',
        latestBranchSubtitle: '겨울 창고의 따뜻한 약속',
        coverImageUrl: antAndGrasshopperCover,
        entryImageUrl: storyScene,
        status: 'COMPLETED',
        progress: 100,
      },
    ] satisfies MockStorySession[],
    templates: [
      { templateId: 'alice', title: '이상한 나라의 앨리스', coverImageUrl: aliceCover },
      { templateId: 'ant-and-grasshopper', title: '개미와 베짱이', coverImageUrl: antAndGrasshopperCover },
      { templateId: 'old-man-and-sea', title: '노인과 바다', coverImageUrl: oldManAndSeaCover },
    ] satisfies MockStoryTemplate[],
  },

  storyDetails: {
    'ant-and-grasshopper': {
      storyId: 'ant-and-grasshopper',
      title: '개미와 베짱이',
      character: '개미와 베짱이',
      branchQuestion: '개미와 베짱이는 이제 무엇을 할까요?',
      status: 'COMPLETED',
      currentDay: 10,
      availableDay: 10,
      totalDays: 10,
      pagesPerDay: 10,
      dayComplete: false,
      pages: [
        ['개미는 부지런히 먹이를 옮겼어요.', '작은 곡식도 차곡차곡 쌓았지요.', '베짱이는 나무 아래에서 노래했어요.'],
        ['개미는 겨울을 생각하며 일했어요.', '창고에는 곡식이 가득 모였지요.', '베짱이는 여름 내내 노래를 불렀어요.'],
        ['겨울이 오자 베짱이는 배가 고팠어요.', '베짱이는 개미의 집을 찾아갔지요.', '개미는 따뜻한 음식을 함께 나누었어요.'],
      ].map((lines, index) => ({
        lineId: `ant-line-${index + 1}`,
        order: index + 1,
        lines,
        imageUrl: storyScene,
        readAt: index < 2 ? '2026-07-22T16:30:00+09:00' : null,
        requiresBranchInput: index === 2,
      })),
    },
    'old-man-and-sea': {
      storyId: 'old-man-and-sea',
      title: '노인과 바다',
      character: '노인',
      branchQuestion: '노인은 다음에 어디로 가게 될까요?',
      status: 'IN_PROGRESS',
      currentDay: 1,
      availableDay: 1,
      totalDays: 10,
      pagesPerDay: 10,
      dayComplete: false,
      pages: [
        ['노인은 오늘도 작은 배를 띄웠어요.', '푸른 바다에는 잔잔한 파도가 일었지요.', '반짝이는 물고기 떼가 지나갔어요.'],
        ['노인은 바다의 소리에 귀 기울였어요.', '멀리서 하얀 새 한 마리가 날아왔지요.', '노인은 용기를 내어 노를 저었답니다.'],
        ['노인의 배는 노을빛으로 물들었어요.', '따뜻한 바람이 배를 살며시 밀어 주었지요.', '노인은 바다에 인사하고 돌아왔어요.'],
      ].map((lines, index) => ({
        lineId: `sea-line-${index + 1}`,
        order: index + 1,
        lines,
        imageUrl: storyScene,
        readAt: null,
        requiresBranchInput: index === 2,
      })),
    },
    alice: {
      storyId: 'alice',
      title: '이상한 나라의 앨리스',
      character: '앨리스',
      branchQuestion: '앨리스는 다음에 어떻게 될까요?',
      status: 'IN_PROGRESS',
      currentDay: 1,
      availableDay: 1,
      totalDays: 10,
      pagesPerDay: 10,
      dayComplete: false,
      pages: [
        ['앨리스는 하얀 토끼를 보고 놀랐어요.', '토끼는 시계를 보며 늦었다고 외쳤지요.', '그리고 알록달록한 숲길로 달려갔어요.'],
        ['커다란 악어가 책을 읽고 있었어요.', '앨리스는 악어에게 길을 물어보았지요.', '악어는 이상한 나라의 길을 알려 주었어요.'],
        ['앨리스는 갈림길 앞에서 고민했어요.', '어느 길로 가야 할지 알 수 없었지요.', '앨리스는 용기를 내어 힘차게 걸어갔어요.'],
      ].map((lines, index) => ({
        lineId: `alice-line-${index + 1}`,
        order: index + 1,
        lines,
        imageUrl: storyScene,
        readAt: index < 2 ? '2026-07-26T18:10:00+09:00' : null,
        requiresBranchInput: index === 2,
      })),
    },
  } satisfies Record<string, MockStoryDetail>,

  growthAreas: [
    { areaId: 1, name: '파닉스', learningCount: 5, stage: 1, updatedAt: '2026-07-24T10:00:00+09:00' },
    { areaId: 2, name: '읽기', learningCount: 4, stage: 1, updatedAt: '2026-07-24T10:00:00+09:00' },
    { areaId: 3, name: '유창성', learningCount: 2, stage: 1, updatedAt: '2026-07-24T10:00:00+09:00' },
  ] satisfies MockGrowthArea[],

  storyFriends: [
    { id: 'alice', name: '앨리스', image: aliceFriend, kind: 'character', storyTitle: '이상한 나라의 앨리스', unlocked: false },
    { id: 'old-man-and-sea', name: '산티아고', image: oldFishermanFriend, kind: 'character', storyTitle: '노인과 바다', unlocked: false },
    { id: 'ant-and-grasshopper', name: '노래', image: grasshopperFriend, kind: 'character', storyTitle: '개미와 베짱이', unlocked: true },
  ] satisfies VillageItem[],
} as const
