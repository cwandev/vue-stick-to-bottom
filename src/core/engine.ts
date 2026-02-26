export interface SpringAnimation {
  /**
   * A value from 0 to 1, on how much to damp the animation.
   * 0 means no damping, 1 means full damping.
   * @default 0.7
   */
  damping?: number
  /**
   * The stiffness of how fast/slow the animation gets up to speed.
   * @default 0.05
   */
  stiffness?: number
  /**
   * The inertial mass associated with the animation.
   * Higher numbers make the animation slower.
   * @default 1.25
   */
  mass?: number
}

export type Animation = ScrollBehavior | SpringAnimation

export interface ScrollElements {
  scrollElement: HTMLElement
  contentElement: HTMLElement
}

export type GetTargetScrollTop = (
  targetScrollTop: number,
  context: ScrollElements,
) => number

export interface StickToBottomOptions extends SpringAnimation {
  resize?: Animation
  initial?: Animation | boolean
  targetScrollTop?: GetTargetScrollTop
}

export type ScrollToBottomOptions
  = | ScrollBehavior
    | {
      animation?: Animation
      /**
       * Whether to wait for any existing scrolls to finish before
       * performing this one. If a number (ms) is passed, it will
       * wait for that duration before performing the scroll.
       * @default false
       */
      wait?: boolean | number
      /**
       * Whether to prevent the user from escaping the scroll
       * by scrolling up with their mouse.
       */
      ignoreEscapes?: boolean
      /**
       * Only scroll to the bottom if we're already at the bottom.
       * @default false
       */
      preserveScrollPosition?: boolean
      /**
       * Extra duration in ms that this scroll event should persist for
       * (in addition to the time it takes to reach the bottom).
       * Not to be confused with the duration of the animation itself —
       * for that, adjust the animation option.
       * @default 0
       */
      duration?: number | Promise<void>
    }

export type ScrollToBottom = (
  options?: ScrollToBottomOptions,
) => Promise<boolean> | boolean

export type StopScroll = () => void

export interface StickToBottomPublicState {
  isAtBottom: boolean
  isNearBottom: boolean
  escapedFromLock: boolean
}

export interface StickToBottomEngine {
  attach: (scrollElement: HTMLElement, contentElement: HTMLElement) => void
  detach: () => void
  destroy: () => void
  setOptions: (options: Partial<StickToBottomOptions>) => void
  getState: () => StickToBottomPublicState
  onChange: (listener: (state: StickToBottomPublicState) => void) => () => void
  scrollToBottom: ScrollToBottom
  stopScroll: StopScroll
}

const DEFAULT_SPRING_ANIMATION = {
  damping: 0.7,
  stiffness: 0.05,
  mass: 1.25,
} as const

const STICK_TO_BOTTOM_OFFSET_PX = 70
const SIXTY_FPS_INTERVAL_MS = 1000 / 60
const RETAIN_ANIMATION_DURATION_MS = 350

let mouseDown = false
let globalMouseListenersReady = false

function ensureGlobalMouseListeners() {
  if (globalMouseListenersReady)
    return
  if (typeof document === 'undefined')
    return
  document.addEventListener('mousedown', () => {
    mouseDown = true
  })
  document.addEventListener('mouseup', () => {
    mouseDown = false
  })
  document.addEventListener('click', () => {
    mouseDown = false
  })
  globalMouseListenersReady = true
}

type RequiredSpring = Readonly<Required<SpringAnimation>>
const animationCache = new Map<string, RequiredSpring>()

function mergeAnimations(...animations: (Animation | boolean | undefined)[]) {
  const result: Required<SpringAnimation> = {
    damping: DEFAULT_SPRING_ANIMATION.damping,
    stiffness: DEFAULT_SPRING_ANIMATION.stiffness,
    mass: DEFAULT_SPRING_ANIMATION.mass,
  }
  let instant = false

  for (const animation of animations) {
    if (animation === 'instant') {
      instant = true
      continue
    }
    if (typeof animation !== 'object' || !animation) {
      continue
    }
    instant = false
    result.damping = animation.damping ?? result.damping
    result.stiffness = animation.stiffness ?? result.stiffness
    result.mass = animation.mass ?? result.mass
  }

  const key = JSON.stringify(result)
  if (!animationCache.has(key)) {
    animationCache.set(key, Object.freeze({ ...result }))
  }

  return instant ? 'instant' : (animationCache.get(key)! as RequiredSpring)
}

interface InternalState extends StickToBottomPublicState {
  scrollElement?: HTMLElement | null
  contentElement?: HTMLElement | null
  resizeObserver?: ResizeObserver

  lastTick?: number
  velocity: number
  accumulated: number
  lastScrollTop?: number
  ignoreScrollToTop?: number
  resizeDifference: number

  animation?: {
    behavior: 'instant' | RequiredSpring
    ignoreEscapes: boolean
    promise: Promise<boolean>
  }
}

export function createStickToBottomEngine(
  initialOptions: StickToBottomOptions = {},
): StickToBottomEngine {
  ensureGlobalMouseListeners()

  let options: StickToBottomOptions = { ...initialOptions }
  const listeners = new Set<(state: StickToBottomPublicState) => void>()

  const state: InternalState = {
    isAtBottom: options.initial !== false,
    isNearBottom: false,
    escapedFromLock: false,
    velocity: 0,
    accumulated: 0,
    resizeDifference: 0,
  }

  function notify() {
    const snapshot = getPublicState()
    for (const l of listeners) l(snapshot)
  }

  function getPublicState(): StickToBottomPublicState {
    return {
      isAtBottom: state.isAtBottom || state.isNearBottom,
      isNearBottom: state.isNearBottom,
      escapedFromLock: state.escapedFromLock,
    }
  }

  function getScrollTop(): number {
    return state.scrollElement?.scrollTop ?? 0
  }

  function setScrollTop(value: number) {
    if (!state.scrollElement)
      return
    state.scrollElement.scrollTop = value
    state.ignoreScrollToTop = state.scrollElement.scrollTop
  }

  function getTargetScrollTop(): number {
    const el = state.scrollElement
    const content = state.contentElement
    if (!el || !content)
      return 0
    return el.scrollHeight - 1 - el.clientHeight
  }

  let lastCalculation:
    | { targetScrollTop: number, calculatedScrollTop: number }
    | undefined

  function getCalculatedTargetScrollTop(): number {
    const el = state.scrollElement
    const content = state.contentElement
    if (!el || !content)
      return 0
    const target = getTargetScrollTop()
    if (!options.targetScrollTop)
      return target
    if (lastCalculation?.targetScrollTop === target) {
      return lastCalculation.calculatedScrollTop
    }
    const calculated = Math.max(
      Math.min(
        options.targetScrollTop(target, {
          scrollElement: el,
          contentElement: content,
        }),
        target,
      ),
      0,
    )
    lastCalculation = { targetScrollTop: target, calculatedScrollTop: calculated }
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        lastCalculation = undefined
      })
    }
    return calculated
  }

  function getScrollDifference(): number {
    return getCalculatedTargetScrollTop() - getScrollTop()
  }

  function computeIsNearBottom(): boolean {
    return getScrollDifference() <= STICK_TO_BOTTOM_OFFSET_PX
  }

  function setIsAtBottom(val: boolean) {
    state.isAtBottom = val
    notify()
  }

  function setEscapedFromLock(val: boolean) {
    state.escapedFromLock = val
    notify()
  }

  function setIsNearBottom(val: boolean) {
    state.isNearBottom = val
    notify()
  }

  function isSelecting(): boolean {
    if (!mouseDown)
      return false
    if (typeof window === 'undefined')
      return false
    const selection = window.getSelection?.()
    if (!selection || !selection.rangeCount)
      return false
    const range = selection.getRangeAt(0)
    const scroll = state.scrollElement
    if (!scroll)
      return false
    const node = range.commonAncestorContainer as Node
    return !!(node && (scroll.contains(node) || node.contains(scroll)))
  }

  const handleScroll = (ev: Event) => {
    if (ev.target !== state.scrollElement)
      return
    const scrollTop = getScrollTop()
    const ignoreScrollToTop = state.ignoreScrollToTop
    let lastScrollTop = state.lastScrollTop ?? scrollTop
    state.lastScrollTop = scrollTop
    state.ignoreScrollToTop = undefined

    if (ignoreScrollToTop && ignoreScrollToTop > scrollTop) {
      lastScrollTop = ignoreScrollToTop
    }

    setIsNearBottom(computeIsNearBottom())

    setTimeout(() => {
      if (state.resizeDifference || scrollTop === ignoreScrollToTop) {
        return
      }

      if (isSelecting()) {
        setEscapedFromLock(true)
        setIsAtBottom(false)
        return
      }

      const isScrollingDown = scrollTop > lastScrollTop
      const isScrollingUp = scrollTop < lastScrollTop

      if (state.animation?.ignoreEscapes) {
        setScrollTop(lastScrollTop)
        return
      }

      if (isScrollingUp) {
        setEscapedFromLock(true)
        setIsAtBottom(false)
      }

      if (isScrollingDown) {
        setEscapedFromLock(false)
      }

      if (!state.escapedFromLock && computeIsNearBottom()) {
        setIsAtBottom(true)
      }
    }, 1)
  }

  const handleWheel = (ev: WheelEvent) => {
    const scroll = state.scrollElement
    if (!scroll)
      return

    let element = ev.target as HTMLElement
    while (element && !['scroll', 'auto'].includes(getComputedStyle(element).overflow)) {
      if (!element.parentElement)
        return
      element = element.parentElement
    }

    if (
      element === scroll
      && ev.deltaY < 0
      && scroll.scrollHeight > scroll.clientHeight
      && !state.animation?.ignoreEscapes
    ) {
      setEscapedFromLock(true)
      setIsAtBottom(false)
    }
  }

  function attach(scrollElement: HTMLElement, contentElement: HTMLElement) {
    detach()
    state.scrollElement = scrollElement
    state.contentElement = contentElement

    if (getComputedStyle(scrollElement).overflow === 'visible') {
      scrollElement.style.overflow = 'auto'
    }

    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    scrollElement.addEventListener('wheel', handleWheel, { passive: true })

    let previousHeight: number | undefined
    state.resizeObserver = new ResizeObserver(([entry]) => {
      const { height } = entry.contentRect
      const difference = height - (previousHeight ?? height)
      state.resizeDifference = difference

      if (getScrollTop() > getTargetScrollTop()) {
        setScrollTop(getTargetScrollTop())
      }

      setIsNearBottom(computeIsNearBottom())

      if (difference >= 0) {
        const animation = mergeAnimations(
          options,
          previousHeight ? options.resize : options.initial,
        )
        scrollToBottom({
          animation,
          wait: true,
          preserveScrollPosition: true,
          duration: animation === 'instant' ? undefined : RETAIN_ANIMATION_DURATION_MS,
        })
      }
      else {
        if (computeIsNearBottom()) {
          setEscapedFromLock(false)
          setIsAtBottom(true)
        }
      }

      previousHeight = height

      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (state.resizeDifference === difference) {
              state.resizeDifference = 0
            }
          }, 1)
        })
      }
    })

    state.resizeObserver.observe(contentElement)
  }

  function detach() {
    if (state.scrollElement) {
      state.scrollElement.removeEventListener('scroll', handleScroll)
      state.scrollElement.removeEventListener('wheel', handleWheel)
    }
    state.resizeObserver?.disconnect()
    state.resizeObserver = undefined
    state.scrollElement = undefined
    state.contentElement = undefined
  }

  function destroy() {
    detach()
    listeners.clear()
  }

  function setOptions(next: Partial<StickToBottomOptions>) {
    options = { ...options, ...next }
  }

  function scrollToBottom(scrollOptions: ScrollToBottomOptions = {}): Promise<boolean> | boolean {
    const opts: Exclude<ScrollToBottomOptions, string> = typeof scrollOptions === 'string'
      ? { animation: scrollOptions }
      : scrollOptions

    if (!opts.preserveScrollPosition) {
      setIsAtBottom(true)
    }

    const waitElapsed = Date.now() + (Number(opts.wait) || 0)
    const behavior = mergeAnimations(options, opts.animation)
    const { ignoreEscapes = false } = opts

    let durationElapsed: number
    let startTarget = getCalculatedTargetScrollTop()

    if (opts.duration instanceof Promise) {
      opts.duration.finally(() => {
        durationElapsed = Date.now()
      })
    }
    else {
      durationElapsed = waitElapsed + (opts.duration ?? 0)
    }

    const next = async (): Promise<boolean> => {
      const promise = new Promise<boolean>((resolve) => {
        if (typeof requestAnimationFrame === 'undefined') {
          resolve(false)
          return
        }
        requestAnimationFrame(() => resolve(true))
      }).then(() => {
        if (!state.isAtBottom) {
          state.animation = undefined
          return false
        }

        const scrollTop = getScrollTop()
        const tick
          = typeof performance !== 'undefined' ? performance.now() : Date.now()
        const tickDelta = (tick - (state.lastTick ?? tick)) / SIXTY_FPS_INTERVAL_MS
        state.animation ||= { behavior, promise, ignoreEscapes }

        if (state.animation.behavior === behavior) {
          state.lastTick = tick
        }

        if (isSelecting()) {
          return next()
        }

        if (waitElapsed > Date.now()) {
          return next()
        }

        if (scrollTop < Math.min(startTarget, getCalculatedTargetScrollTop())) {
          if (state.animation?.behavior === behavior) {
            if (behavior === 'instant') {
              setScrollTop(getCalculatedTargetScrollTop())
              return next()
            }

            const b = behavior as RequiredSpring
            state.velocity = (b.damping * state.velocity + b.stiffness * getScrollDifference()) / b.mass
            state.accumulated += state.velocity * tickDelta
            const before = getScrollTop()
            setScrollTop(before + state.accumulated)
            if (getScrollTop() !== before) {
              state.accumulated = 0
            }
          }
          return next()
        }

        if (durationElapsed > Date.now()) {
          startTarget = getCalculatedTargetScrollTop()
          return next()
        }

        state.animation = undefined

        if (getScrollTop() < getCalculatedTargetScrollTop()) {
          return scrollToBottom({
            animation: mergeAnimations(options, options.resize),
            ignoreEscapes,
            duration: Math.max(0, durationElapsed - Date.now()) || undefined,
          })
        }

        return state.isAtBottom
      })

      return promise.then((isAtBottom) => {
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => {
            if (!state.animation) {
              state.lastTick = undefined
              state.velocity = 0
            }
          })
        }
        return isAtBottom
      })
    }

    if (opts.wait !== true) {
      state.animation = undefined
    }

    if (state.animation?.behavior === behavior) {
      return state.animation.promise
    }

    return next()
  }

  const stopScroll: StopScroll = () => {
    setEscapedFromLock(true)
    setIsAtBottom(false)
  }

  function onChange(listener: (state: StickToBottomPublicState) => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return {
    attach,
    detach,
    destroy,
    setOptions,
    getState: getPublicState,
    onChange,
    scrollToBottom,
    stopScroll,
  }
}

export default createStickToBottomEngine
