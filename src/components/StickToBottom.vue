<script setup lang="ts">
import type { Animation, GetTargetScrollTop, SpringAnimation } from '../core/engine'
import { computed, provide, watch } from 'vue'
import useStickToBottom from '../composables/useStickToBottom'
import { StickToBottomKey } from '../context/stickToBottom'

defineOptions({ name: 'StickToBottom' })

const props = defineProps<StickToBottomProps>()

export interface StickToBottomProps extends SpringAnimation {
  resize?: Animation
  initial?: Animation | boolean
  targetScrollTop?: GetTargetScrollTop
  anchor?: 'auto' | 'none'
}

const { scrollRef, contentRef, isAtBottom, isNearBottom, escapedFromLock, scrollToBottom, stopScroll, setOptions } = useStickToBottom({
  resize: props.resize,
  initial: props.initial,
  targetScrollTop: props.targetScrollTop,
  damping: props.damping,
  stiffness: props.stiffness,
  mass: props.mass,
})

const context = {
  scrollRef,
  contentRef,
  isAtBottom,
  isNearBottom,
  escapedFromLock,
  scrollToBottom,
  stopScroll,
}

provide(StickToBottomKey, context)

defineExpose(context)

watch(
  () => [
    props.resize,
    props.initial,
    props.damping,
    props.stiffness,
    props.mass,
    props.targetScrollTop,
  ],
  () => {
    setOptions({
      resize: props.resize,
      initial: props.initial,
      targetScrollTop: props.targetScrollTop,
      damping: props.damping,
      stiffness: props.stiffness,
      mass: props.mass,
    })
  },
  { flush: 'post' },
)

const overflowAnchor = computed(() => props.anchor ?? 'auto')

const slotProps = computed(() => ({
  isAtBottom: isAtBottom.value,
  isNearBottom: isNearBottom.value,
  escapedFromLock: escapedFromLock.value,
  scrollToBottom,
  stopScroll,
}))
</script>

<template>
  <div style="height: 100%; width: 100%;">
    <div style="position: relative; height: 100%; width: 100%;">
      <div
        ref="scrollRef"
        :style="{
          'overflow-anchor': overflowAnchor,
          'overflow': 'auto',
          'height': '100%',
          'width': '100%',
          'scrollbar-gutter': 'stable both-edges',
        }"
      >
        <div ref="contentRef">
          <slot v-bind="slotProps" />
        </div>
      </div>

      <slot name="overlay" v-bind="slotProps" />
    </div>

    <slot name="after" v-bind="slotProps" />
  </div>
</template>
