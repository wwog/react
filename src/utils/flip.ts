/**
 * @en Moving work to the compositor: FLIP animations.
 *
 * Animating layout properties (top/left/width/height) recomputes layout every
 * frame — main-thread work that stutters under load. Animating transform and
 * opacity instead moves an already-painted layer, which the compositor thread
 * handles directly; even a busy main thread can't stop it.
 *
 * But what about animations where the layout genuinely has to change — e.g.
 * deleting a list item makes the items below slide up into place? The FLIP
 * technique (First, Last, Invert, Play) resolves the dilemma: cause exactly
 * ONE layout change and leave the entire movement to transform.
 *
 * 1. First: measure the position before the move.
 * 2. Last: actually change the layout and measure the new position. Layout
 *    happens exactly once, here.
 * 3. Invert: apply a transform to the element in its new position so it
 *    appears to still be in the old one.
 * 4. Play: animate that transform away. This part belongs to the compositor.
 *
 * To the user's eye the element glides from its old spot to its new one, but
 * in reality it has already arrived — the transform briefly drags it back
 * before releasing it into place. Vue's TransitionGroup and Framer Motion's
 * layout animations are FLIP under the hood.
 *
 * @zh 把工作移交给合成器：FLIP 动画。
 *
 * 用布局属性（top/left/width/height）做动画会让每帧都重算布局——主线程工作，负载一高
 * 就卡。改用 transform/opacity 动画移动的是“已绘制的图层”，由合成器线程直接处理，
 * 主线程再忙也不受影响。
 *
 * 可布局确实要变的动画怎么办？——比如删除列表项、下方项平滑上移。FLIP 技术
 * （First, Last, Invert, Play）解决这个两难：只触发恰好一次布局变更，整个移动交给 transform。
 *
 * 1. First：测量移动前的位置。
 * 2. Last：真正改变布局并测量新位置。布局只在这里发生一次。
 * 3. Invert：在新位置上施加 transform，让元素看起来还在旧位置。
 * 4. Play：把该 transform 动画到无。这部分由合成器接管。
 *
 * 用户眼中元素从旧位置滑向新位置，实际上它早已到位——transform 短暂把它拽回，
 * 再松手放回原处。Vue 的 TransitionGroup、Framer Motion 的布局动画底层都是 FLIP。
 */

/**
 * @en Options for {@link flipAnimate}.
 * @zh {@link flipAnimate} 的选项。
 */
export interface FlipAnimateOptions {
  /**
   * @en Animation duration in milliseconds. Default `300`.
   * @zh 动画时长（毫秒），默认 `300`。
   */
  duration?: number
  /**
   * @en Easing for the play phase. Default `'ease-in-out'`.
   * @zh 播放阶段的缓动曲线，默认 `'ease-in-out'`。
   */
  easing?: string
  /**
   * @en If true, animate size changes with `transform: scale` as well
   * (scaling the visual rather than the layout). Default `false`.
   * @zh 若为 true，尺寸变化也用 `transform: scale` 动画（视觉缩放而非布局缩放），
   * 默认 `false`。
   */
  scale?: boolean
}

/**
 * @en Animate a layout change with FLIP: measure, mutate once, then play the
 * inverse transform on the compositor.
 *
 * Solves: reorder/prepend/remove animations that would otherwise animate
 * `top`/`left` and trigger layout on every frame, stuttering whenever the
 * main thread gets busy. With FLIP the layout change happens exactly once
 * (inside the mutation callback) and the entire visible movement is a
 * transform interpolation — smooth even under load.
 *
 * @param element The element that will visually move.
 * @param layoutChange Callback that performs the real DOM mutation (prepend,
 *   reorder, remove-with-collapse, ...). Runs between the First and Last
 *   measurements.
 * @param options See {@link FlipAnimateOptions}.
 * @returns The Animation produced by the play phase.
 *
 * @example
 * ```ts
 * // Moving an item to the top of the list, animated
 * flipAnimate(el, () => {
 *   list.prepend(el) // the one and only layout change
 * })
 *
 * // With options
 * flipAnimate(el, () => list.prepend(el), {duration: 200, easing: 'linear'})
 * ```
 */
export function flipAnimate(
  element: Element,
  layoutChange: () => void,
  options: FlipAnimateOptions = {},
): Animation {
  const {duration = 300, easing = 'ease-in-out', scale = false} = options

  // First: where it is now
  const first = element.getBoundingClientRect()

  // Last: where it ended up. Layout happens exactly once, here
  layoutChange()
  const last = element.getBoundingClientRect()

  const dx = first.left - last.left
  const dy = first.top - last.top

  let invertedTransform = `translate(${dx}px, ${dy}px)`

  if (scale && (first.width !== last.width || first.height !== last.height)) {
    const sx = first.width / last.width
    const sy = first.height / last.height
    invertedTransform += ` scale(${sx}, ${sy})`
  }

  // Invert: make it look like it's back at the old position →
  // Play: release it. The interpolation runs on the compositor.
  return element.animate([{transform: invertedTransform}, {transform: 'none'}], {duration, easing})
}
