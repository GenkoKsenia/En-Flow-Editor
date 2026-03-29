import { useAsyncData } from '@/shared/composables/useAsyncData'

import type { SchemeCard } from '../models'

import { getSchemes } from '../api'
import { toSchemeCard } from '../models'

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
