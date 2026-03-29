import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'

type AsyncDataOptions<TData> = {
  immediate?: boolean
  initialData?: TData
}

type AsyncDataResult<TData> = {
  data: ShallowRef<TData>
  error: Ref<Error | null>
  isLoading: Ref<boolean>
  isFetched: Ref<boolean>
  refetch: () => Promise<TData | null>
  reset: () => void
}

export function useAsyncData<TData>(
  loader: () => Promise<TData>,
  options: { initialData: TData; immediate?: boolean },
): AsyncDataResult<TData>
export function useAsyncData<TData>(
  loader: () => Promise<TData>,
  options?: { immediate?: boolean },
): AsyncDataResult<TData | null>
export function useAsyncData<TData>(
  loader: () => Promise<TData>,
  options?: AsyncDataOptions<TData>,
): AsyncDataResult<TData | null> {
  const hasInitialData = Object.prototype.hasOwnProperty.call(options ?? {}, 'initialData')
  const initialData = (hasInitialData ? options?.initialData : null) as TData | null

  const data = shallowRef<TData | null>(initialData)
  const error = ref<Error | null>(null)
  const isLoading = ref(false)
  const isFetched = ref(false)

  async function refetch(): Promise<TData | null> {
    isLoading.value = true
    error.value = null

    try {
      const nextData = await loader()
      data.value = nextData
      isFetched.value = true
      return nextData
    } catch (cause) {
      error.value = toError(cause)
      isFetched.value = true
      return null
    } finally {
      isLoading.value = false
    }
  }

  function reset(): void {
    data.value = initialData
    error.value = null
    isLoading.value = false
    isFetched.value = false
  }

  if (options?.immediate !== false) {
    void refetch()
  }

  return {
    data,
    error,
    isLoading,
    isFetched,
    refetch,
    reset,
  }
}

function toError(cause: unknown): Error {
  if (cause instanceof Error) {
    return cause
  }

  return new Error('Unknown error')
}
