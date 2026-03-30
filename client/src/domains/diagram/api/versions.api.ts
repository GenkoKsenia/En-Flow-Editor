import { http } from '@/shared/api/http'

export async function updateVersion(versionId: string | number, code: unknown): Promise<void> {
  await http.put(`/Version/put/${versionId}`, code, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
