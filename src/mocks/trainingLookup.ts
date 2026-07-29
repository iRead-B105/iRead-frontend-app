// 훈련 데이터 조회/검증 헬퍼
// 라우트 가드와 뷰에서 카테고리/레슨 ID의 유효성을 검사할 때 사용합니다.

import type { TrainingCategory, TrainingCategoryId, TrainingLessonSummary } from '@/types/training'
import { trainingCategories } from './trainingCategories'
import { getLessonById } from './trainingLessons'

export const getAllCategories = (): TrainingCategory[] => trainingCategories

export const getCategoryById = (id: string): TrainingCategory | null => {
  return trainingCategories.find((c) => c.id === id) ?? null
}

export const isValidCategoryId = (id: string): id is TrainingCategoryId => {
  return trainingCategories.some((c) => c.id === id)
}

// 특정 카테고리 안의 레슨 요약 조회
export const findLessonSummary = (
  categoryId: string,
  lessonId: string,
): TrainingLessonSummary | null => {
  const category = getCategoryById(categoryId)
  if (!category) return null
  return category.lessons.find((l) => l.id === lessonId) ?? null
}

// 해당 레슨이 (1) 존재하고 (2) 플레이 준비가 되었는지 검사
export const isPlayableLesson = (categoryId: string, lessonId: string): boolean => {
  const summary = findLessonSummary(categoryId, lessonId)
  if (!summary || !summary.isReady) return false
  return getLessonById(lessonId) !== null
}
