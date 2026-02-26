import type { App } from 'vue'
import StickToBottom from './components/StickToBottom.vue'

export { default as StickToBottom } from './components/StickToBottom.vue'
export type { StickToBottomProps } from './components/StickToBottom.vue'

export { default as useStickToBottom } from './composables/useStickToBottom'
export type { UseStickToBottomReturn } from './composables/useStickToBottom'

export { useStickToBottomContext } from './context/stickToBottom'
export type { StickToBottomContext } from './context/stickToBottom'

export * from './types'

export default {
  install(app: App) {
    app.component('StickToBottom', StickToBottom)
  },
}
