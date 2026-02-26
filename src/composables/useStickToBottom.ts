import type { Ref } from 'vue'
import type { ScrollToBottom, StickToBottomOptions, StopScroll } from '../core/engine'
import { onBeforeUnmount, ref, watchEffect } from 'vue'
import { createStickToBottomEngine } from '../core/engine'

export interface UseStickToBottomReturn {
  scrollRef: Ref<HTMLElement | null>
  contentRef: Ref<HTMLElement | null>
  isAtBottom: Ref<boolean>
  isNearBottom: Ref<boolean>
  escapedFromLock: Ref<boolean>
  scrollToBottom: ScrollToBottom
  stopScroll: StopScroll
  setOptions: (options: Partial<StickToBottomOptions>) => void
}

export function useStickToBottom(options: StickToBottomOptions = {}): UseStickToBottomReturn {
  const scrollRef = ref<HTMLElement | null>(null)
  const contentRef = ref<HTMLElement | null>(null)

  const isAtBottom = ref(options.initial !== false)
  const isNearBottom = ref(false)
  const escapedFromLock = ref(false)

  const engine = createStickToBottomEngine(options)
  let unsubscribe: (() => void) | null = null

  watchEffect((onCleanup) => {
    if (!scrollRef.value || !contentRef.value)
      return

    engine.attach(scrollRef.value, contentRef.value)
    unsubscribe = engine.onChange((s) => {
      isAtBottom.value = s.isAtBottom
      isNearBottom.value = s.isNearBottom
      escapedFromLock.value = s.escapedFromLock
    })

    onCleanup(() => {
      unsubscribe?.()
      unsubscribe = null
      engine.detach()
    })
  })

  onBeforeUnmount(() => {
    engine.destroy()
  })

  return {
    scrollRef,
    contentRef,
    isAtBottom,
    isNearBottom,
    escapedFromLock,
    scrollToBottom: (opts?) => engine.scrollToBottom(opts),
    stopScroll: () => engine.stopScroll(),
    setOptions: next => engine.setOptions(next),
  }
}

export default useStickToBottom
