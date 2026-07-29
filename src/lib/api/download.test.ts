// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import { ApiClient, type FetchImplementation } from './apiClient'
import { getDownloadFileName } from './download'

describe('getDownloadFileName', () => {
  it('UTF-8 확장 filename을 해석한다', () => {
    expect(
      getDownloadFileName("attachment; filename*=UTF-8''%ED%9B%88%EB%A0%A8-%EA%B2%B0%EA%B3%BC.csv"),
    ).toBe('훈련-결과.csv')
  })

  it('기본 filename을 해석하고 경로 구분자를 제거한다', () => {
    expect(getDownloadFileName('attachment; filename="../reports/result.json"')).toBe('result.json')
  })

  it('filename이 없으면 undefined를 반환한다', () => {
    expect(getDownloadFileName('attachment')).toBeUndefined()
    expect(getDownloadFileName(null)).toBeUndefined()
  })
})

describe('ApiClient.download', () => {
  it('Blob, Content-Type과 Content-Disposition 파일명을 반환한다', async () => {
    const fetchMock = vi.fn<FetchImplementation>()
    fetchMock.mockResolvedValue(
      new Response('studentId,accuracy\n1,98', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="training-result.csv"',
        },
      }),
    )
    const client = new ApiClient({
      baseUrl: 'https://api.example.com',
      fetch: fetchMock,
    })

    const result = await client.download('/api/admin/training/1/2/export?format=CSV', {
      method: 'POST',
    })

    expect(result.fileName).toBe('training-result.csv')
    expect(result.contentType).toBe('text/csv')
    await expect(result.blob.text()).resolves.toBe('studentId,accuracy\n1,98')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/admin/training/1/2/export?format=CSV',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    )
  })
})
