const parseStudyDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(year, month - 1, day)

  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null
  }

  return parsed
}

export const formatCurriculumStudyDate = (
  studyDate: string | null | undefined,
  today = new Date(),
): string => {
  const date = studyDate ? (parseStudyDate(studyDate) ?? today) : today
  return `${date.getMonth() + 1}월 ${date.getDate()}일`
}
