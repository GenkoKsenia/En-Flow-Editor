import type { SchemeCard } from '@/models'

import { getSchemes } from '@/api/schemes'
import { toSchemeCard } from '@/models'

import { useAsyncData } from './useAsyncData'

export function useSchemesList() {
  return useAsyncData(
    async () => {
      const schemes = await getSchemes()
      return schemes.map(toSchemeCard)
    },
    {
      initialData: [] as SchemeCard[],
    },
  )
}
