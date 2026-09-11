import {describe, expect, it, vi} from 'vitest'
import {flipAnimate} from './flip'

describe('flipAnimate', () => {
  it('应该在一次布局变更后用 transform 反向补偿', () => {
    const list = document.createElement('div')
    const el = document.createElement('div')
    el.style.width = '100px'
    el.style.height = '20px'
    list.appendChild(el)
    document.body.appendChild(list)

    const animation = flipAnimate(el, () => {
      list.prepend(document.createElement('div')) // 把 el 挤到下面
    })

    expect(animation).toBeInstanceOf(Animation)
    expect(list.children[1]).toBe(el)

    animation.cancel()
    list.remove()
  })

  it('Invert 阶段的起始 transform 应等于位移差', () => {
    const list = document.createElement('div')
    const spacer = document.createElement('div')
    spacer.style.width = '100px'
    spacer.style.height = '50px'

    const el = document.createElement('div')
    el.style.width = '100px'
    el.style.height = '20px'

    list.appendChild(el)
    document.body.appendChild(list)

    const firstTop = el.getBoundingClientRect().top

    // 注意：flipAnimate 返回后动画已开始播放，Invert 的 transform 会把元素
    // 视觉上拽回旧位置，因此在外部测量 lastTop 会得到旧位置。真实的新位置必须
    // 在布局变更之后、动画启动之前测量。
    let lastTop = firstTop
    const animation = flipAnimate(el, () => {
      list.prepend(spacer)
      lastTop = el.getBoundingClientRect().top
    })

    const dy = Math.round(firstTop - lastTop)
    expect(dy).toBe(-50) // prepend 后元素向下移了 50px

    // 初始 keyframe 应包含反向位移（WAAPI 会把小数舍入为整数像素）
    const keyframes = (animation.effect as KeyframeEffect).getKeyframes() as {transform?: string}[]
    expect(keyframes[0]?.transform).toContain(`translate(0px, ${dy}px)`)

    animation.cancel()
    list.remove()
  })

  it('默认不做 scale 补偿', () => {
    const el = document.createElement('div')
    el.style.width = '100px'
    el.style.height = '20px'
    document.body.appendChild(el)

    const animation = flipAnimate(el, () => {
      el.style.width = '50px' // 尺寸变化
    })

    const keyframes = (animation.effect as KeyframeEffect).getKeyframes() as {transform?: string}[]
    expect(keyframes[0]?.transform).not.toContain('scale')

    animation.cancel()
    el.remove()
  })

  it('scale 选项开启时应对尺寸变化做 scale 补偿', () => {
    const el = document.createElement('div')
    el.style.width = '100px'
    el.style.height = '20px'
    document.body.appendChild(el)

    const animation = flipAnimate(
      el,
      () => {
        el.style.width = '50px' // 100 → 50：sx = 2
        el.style.height = '10px'
      },
      {scale: true},
    )

    const keyframes = (animation.effect as KeyframeEffect).getKeyframes() as {transform?: string}[]
    expect(keyframes[0]?.transform).toContain('scale(2, 2)')

    animation.cancel()
    el.remove()
  })

  it('应该把选项传给动画', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    const animation = flipAnimate(el, () => {}, {
      duration: 123,
      easing: 'linear',
    })

    expect(animation.effect?.getTiming().duration).toBe(123)
    expect(animation.effect?.getTiming().easing).toBe('linear')

    animation.cancel()
    el.remove()
  })

  it('布局变更回调应该在测量之间执行恰好一次', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    const layoutChange = vi.fn()
    const animation = flipAnimate(el, layoutChange)

    expect(layoutChange).toHaveBeenCalledTimes(1)
    animation.cancel()
    el.remove()
  })
})
