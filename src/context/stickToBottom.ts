import type { InjectionKey, Ref } from 'vue'
import type { ScrollToBottom, StopScroll } from '../core/engine'
import { inject } from 'vue'

export interface StickToBottomContext {
  scrollRef: Ref<HTMLElement | null>
  contentRef: Ref<HTMLElement | null>
  isAtBottom: Ref<boolean>
  isNearBottom: Ref<boolean>
  escapedFromLock: Ref<boolean>
  scrollToBottom: ScrollToBottom
  stopScroll: StopScroll
}

export const StickToBottomKey: InjectionKey<StickToBottomContext> = Symbol('StickToBottom')

export function useStickToBottomContext(): StickToBottomContext {
  const ctx = inject(StickToBottomKey, null)
  if (!ctx) {
    throw new Error('useStickToBottomContext must be used within <StickToBottom>')
  }
  return ctx
}
