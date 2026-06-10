import { toValue, watch, type MaybeRefOrGetter } from 'vue'

import { useAsyncData } from '@/shared/composables/useAsyncData'

import { getSchemeById } from '../api'

export function useScheme(schemeId: MaybeRefOrGetter<string | number | null | undefined>) {
  const request = useAsyncData(
    () => getSchemeById(toValue(schemeId) as string | number),
    { immediate: false },
  )

  watch(
    () => toValue(schemeId),
    async (nextSchemeId) => {
      if (nextSchemeId === null || nextSchemeId === undefined || nextSchemeId === '') {
        request.reset()
        return
      }

      await request.refetch()
    },
    { immediate: true },
  )

  return request
}
