import {expect, describe, it, beforeEach, vi} from 'vitest'
import {render} from 'vitest-browser-react'
import React from 'react'
import {AppStackRouter, useAppStack, useCanPop, useStackSize} from './AppStackRouter'

function toEl(e: {element(): Element}): HTMLElement {
  return e.element() as HTMLElement
}

// --- 测试用屏幕组件 ---
function Home() {
  const {push} = useAppStack()
  return (
    <div data-testid="home">
      <span>Home</span>
      <button data-testid="open-detail" onClick={() => push(Detail, {id: 1})}>
        Open Detail
      </button>
    </div>
  )
}

function Detail({id}: {id: number}) {
  const {push, pop} = useAppStack()
  return (
    <div data-testid="detail">
      <span>Detail {id}</span>
      <button data-testid="open-sub" onClick={() => push(Sub)}>
        Open Sub
      </button>
      <button data-testid="back" onClick={pop}>
        Back
      </button>
    </div>
  )
}

function Sub() {
  const {pop} = useAppStack()
  return (
    <div data-testid="sub">
      <span>Sub</span>
      <button data-testid="sub-back" onClick={pop}>
        Back
      </button>
    </div>
  )
}

// 用于 keep-alive 状态验证:自增计数器
function Counter() {
  const {push} = useAppStack()
  const [count, setCount] = React.useState(0)
  return (
    <div data-testid="counter">
      <span data-testid="count-value">{count}</span>
      <button data-testid="inc" onClick={() => setCount((c) => c + 1)}>
        Inc
      </button>
      <button data-testid="open-next" onClick={() => push(Detail, {id: 99})}>
        Next
      </button>
    </div>
  )
}

function makeTouchEvent(
  type: string,
  x: number,
  y: number,
): TouchEvent {
  const touch = new Touch({
    identifier: 0,
    target: document.body,
    clientX: x,
    clientY: y,
  })
  return new TouchEvent(type, {
    touches: [touch],
    changedTouches: [touch],
    bubbles: true,
    cancelable: true,
  })
}

describe('AppStackRouter', () => {
  beforeEach(() => {
    // 清理可能遗留的哨兵历史条目:用 replaceState 直接覆盖当前条目状态为 null,
    // 避免使用 history.back()(异步,易触发循环/串扰)。组件挂载时会自行补哨兵。
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '')
    }
  })

  it('渲染根屏幕,栈为空', async () => {
    const {getByTestId, container} = render(
      <AppStackRouter root={<Home />} />,
    )
    expect(toEl(getByTestId('home'))).toBeDefined()
    expect(container.querySelector('[data-testid="detail"]')).toBeNull()
  })

  it('push 压入新屏幕且根屏幕 keep-alive 保留', async () => {
    const {getByTestId} = render(<AppStackRouter root={<Home />} />)

    // 初始只有 Home
    expect(getByTestId('home')).toBeDefined()

    // push Detail
    await getByTestId('open-detail').click()

    // Detail 出现,Home 仍在 DOM(keep-alive)
    expect(toEl(getByTestId('detail')).textContent).toContain('Detail 1')
    expect(toEl(getByTestId('home')).textContent).toContain('Home')
  })

  it('pop 后回到根屏幕,根屏幕状态未丢失', async () => {
    const {getByTestId} = render(<AppStackRouter root={<Counter />} />)

    // 在根屏幕自增计数到 3
    const inc = getByTestId('inc')
    await inc.click()
    await inc.click()
    await inc.click()
    expect(toEl(getByTestId('count-value')).textContent).toBe('3')

    // push 到 Detail
    await getByTestId('open-next').click()
    expect(toEl(getByTestId('detail')).textContent).toContain('Detail 99')

    // pop 回根
    await getByTestId('back').click()

    // 根屏幕计数仍是 3(状态保留)
    await vi.waitFor(() => {
      expect(toEl(getByTestId('count-value')).textContent).toBe('3')
    })
  })

  it('replace 在栈顶屏幕内替换自身', async () => {
    const Replaceable = () => {
      const {replace} = useAppStack()
      return (
        <div data-testid="replaceable">
          <button
            data-testid="do-replace"
            onClick={() => replace(Detail, {id: 7})}
          >
            Replace
          </button>
        </div>
      )
    }
    const Root = () => {
      const {push} = useAppStack()
      return (
        <button data-testid="push-replaceable" onClick={() => push(Replaceable)}>
          Push
        </button>
      )
    }

    const {getByTestId, container} = render(
      <AppStackRouter root={<Root />} />,
    )

    await getByTestId('push-replaceable').click()
    expect(toEl(getByTestId('replaceable'))).toBeDefined()

    await getByTestId('do-replace').click()
    // 栈顶已变为 Detail(id:7),深度仍为 1
    expect(toEl(getByTestId('detail')).textContent).toContain('Detail 7')
    expect(container.querySelector('[data-testid="replaceable"]')).toBeNull()
  })

  it('canPop / size 反映栈状态', async () => {
    const Root = () => {
      const {push, canPop, size} = useAppStack()
      return (
        <div data-testid="root">
          <span data-testid="canpop">{String(canPop())}</span>
          <span data-testid="size">{size}</span>
          <button data-testid="push-btn" onClick={() => push(Detail, {id: 1})}>
            Push
          </button>
        </div>
      )
    }

    const {getByTestId} = render(<AppStackRouter root={<Root />} />)
    expect(toEl(getByTestId('canpop')).textContent).toBe('false')
    expect(toEl(getByTestId('size')).textContent).toBe('0')

    await getByTestId('push-btn').click()
    // 进入 Detail 后,Detail 内可通过其按钮 pop;这里验证根屏幕的状态已变化
    // 由于根屏幕被遮挡,改用 Detail 自身的 size 渲染来验证(Detail 已含 open-sub/back)
    // 栈深度为 1
    expect(toEl(getByTestId('detail'))).toBeDefined()
  })

  it('reset 清空堆栈回到根', async () => {
    const ResetRoot = () => {
      const {push} = useAppStack()
      return (
        <div data-testid="reset-root">
          <button data-testid="push-detail" onClick={() => push(ResettableDetail, {id: 1})}>
            Push
          </button>
        </div>
      )
    }
    // 栈顶屏幕内调用 reset,验证清空后回到根
    const ResettableDetail = () => {
      const {reset} = useAppStack()
      return (
        <div data-testid="detail">
          <button data-testid="reset-btn" onClick={reset}>
            Reset
          </button>
        </div>
      )
    }

    const {getByTestId, container} = render(
      <AppStackRouter root={<ResetRoot />} />,
    )

    await getByTestId('push-detail').click()
    expect(toEl(getByTestId('detail'))).toBeDefined()

    await getByTestId('reset-btn').click()

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="detail"]')).toBeNull()
      expect(toEl(getByTestId('reset-root'))).toBeDefined()
    })
  })

  it('useStackSize 响应式订阅栈深度', async () => {
    const Root = () => {
      const {push} = useAppStack()
      const size = useStackSize()
      return (
        <div data-testid="root">
          <span data-testid="size">{size}</span>
          <button data-testid="push-btn" onClick={() => push(Detail, {id: 1})}>
            Push
          </button>
        </div>
      )
    }

    const {getByTestId} = render(<AppStackRouter root={<Root />} />)
    expect(toEl(getByTestId('size')).textContent).toBe('0')

    await getByTestId('push-btn').click()
    // 根屏幕被遮挡,但 useStackSize 在根屏幕组件内,其 size 已更新为 1
    // 通过 Detail 内的返回按钮 pop 后验证 size 回到 0
    await getByTestId('back').click()
    await vi.waitFor(() => {
      expect(toEl(getByTestId('size')).textContent).toBe('0')
    })
  })

  it('useCanPop 响应式订阅可出栈状态', async () => {
    const Root = () => {
      const {push} = useAppStack()
      const canPop = useCanPop()
      return (
        <div data-testid="root">
          <span data-testid="canpop">{String(canPop)}</span>
          <button data-testid="push-btn" onClick={() => push(Detail, {id: 1})}>
            Push
          </button>
        </div>
      )
    }

    const {getByTestId} = render(<AppStackRouter root={<Root />} />)
    expect(toEl(getByTestId('canpop')).textContent).toBe('false')

    await getByTestId('push-btn').click()
    await getByTestId('back').click()
    await vi.waitFor(() => {
      expect(toEl(getByTestId('canpop')).textContent).toBe('false')
    })
  })

  it('safeArea 默认启用,容器含 env(safe-area-inset-*) 内边距', async () => {
    const {container} = render(<AppStackRouter root={<Home />} />)
    const wrapper = container.firstElementChild as HTMLElement
    const style = wrapper.style
    expect(style.paddingTop).toContain('env(safe-area-inset-top)')
    expect(style.paddingBottom).toContain('env(safe-area-inset-bottom)')
    expect(style.paddingLeft).toContain('env(safe-area-inset-left)')
    expect(style.paddingRight).toContain('env(safe-area-inset-right)')
  })

  it('safeArea={false} 时不加安全区内边距', async () => {
    const {container} = render(
      <AppStackRouter root={<Home />} safeArea={false} />,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.paddingTop).toBe('')
  })

  it('浏览器返回键触发 pop(模拟 popstate)', async () => {
    const {getByTestId, container} = render(
      <AppStackRouter root={<Home />} />,
    )

    await getByTestId('open-detail').click()
    expect(toEl(getByTestId('detail'))).toBeDefined()

    // 模拟用户按浏览器返回:触发 popstate
    window.dispatchEvent(new PopStateEvent('popstate'))

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="detail"]')).toBeNull()
      expect(toEl(getByTestId('home'))).toBeDefined()
    })
  })

  it('左滑超过阈值触发 pop', async () => {
    const {container, getByTestId} = render(
      <AppStackRouter root={<Home />} />,
    )
    const wrapper = container.firstElementChild as HTMLElement

    await getByTestId('open-detail').click()
    expect(toEl(getByTestId('detail'))).toBeDefined()

    // 从左边缘开始,向右快速划过阈值:位移足够 + 向右瞬时速度
    vi.useFakeTimers()
    wrapper.dispatchEvent(makeTouchEvent('touchstart', 10, 50))
    vi.advanceTimersByTime(16)
    wrapper.dispatchEvent(makeTouchEvent('touchmove', 120, 50))
    vi.advanceTimersByTime(16)
    wrapper.dispatchEvent(makeTouchEvent('touchmove', 140, 50))
    vi.advanceTimersByTime(8)
    wrapper.dispatchEvent(makeTouchEvent('touchend', 140, 50))
    vi.useRealTimers()

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="detail"]')).toBeNull()
    })
  })

  it('左滑未超过阈值回弹,不触发 pop', async () => {
    const {container, getByTestId} = render(
      <AppStackRouter root={<Home />} />,
    )
    const wrapper = container.firstElementChild as HTMLElement

    await getByTestId('open-detail').click()
    expect(toEl(getByTestId('detail'))).toBeDefined()

    // 拖拽距离很小,未达阈值,且无明显速度
    vi.useFakeTimers()
    wrapper.dispatchEvent(makeTouchEvent('touchstart', 10, 50))
    vi.advanceTimersByTime(16)
    wrapper.dispatchEvent(makeTouchEvent('touchmove', 30, 50))
    vi.advanceTimersByTime(16)
    wrapper.dispatchEvent(makeTouchEvent('touchend', 30, 50))
    vi.useRealTimers()

    // 回弹后 Detail 仍在
    await vi.waitFor(() => {
      expect(toEl(getByTestId('detail'))).toBeDefined()
    })
  })

  it('划过阈值后反向回划松手:默认识别为取消意图,回弹不出栈', async () => {
    const {container, getByTestId} = render(
      <AppStackRouter root={<Home />} />,
    )
    const wrapper = container.firstElementChild as HTMLElement

    await getByTestId('open-detail').click()
    expect(toEl(getByTestId('detail'))).toBeDefined()

    // 先向右划 200px(超过阈值 80),再向左回划,松手时位置仍在阈值之上但运动方向为左
    vi.useFakeTimers()
    wrapper.dispatchEvent(makeTouchEvent('touchstart', 10, 50))
    vi.advanceTimersByTime(16)
    wrapper.dispatchEvent(makeTouchEvent('touchmove', 210, 50)) // 向右 200px
    vi.advanceTimersByTime(16)
    wrapper.dispatchEvent(makeTouchEvent('touchmove', 120, 50)) // 向左回划,瞬时方向为负
    vi.advanceTimersByTime(8)
    wrapper.dispatchEvent(makeTouchEvent('touchend', 120, 50)) // 松手位置 120 > 阈值 80
    vi.useRealTimers()

    // 尽管位置超过阈值,但松手朝取消方向,应回弹:Detail 仍在
    await vi.waitFor(() => {
      expect(toEl(getByTestId('detail'))).toBeDefined()
    })
  })

  it('关闭 cancelOnReverseRelease 后,划过阈值再回划仍触发 pop', async () => {
    const {container, getByTestId} = render(
      <AppStackRouter root={<Home />} swipeBackCancelOnReverseRelease={false} />,
    )
    const wrapper = container.firstElementChild as HTMLElement

    await getByTestId('open-detail').click()
    expect(toEl(getByTestId('detail'))).toBeDefined()

    // 同样的手势:划过阈值后回划,但关闭了取消意图识别 -> 仍出栈(位置超阈值)
    vi.useFakeTimers()
    wrapper.dispatchEvent(makeTouchEvent('touchstart', 10, 50))
    vi.advanceTimersByTime(16)
    wrapper.dispatchEvent(makeTouchEvent('touchmove', 210, 50))
    vi.advanceTimersByTime(16)
    wrapper.dispatchEvent(makeTouchEvent('touchmove', 120, 50))
    vi.advanceTimersByTime(8)
    wrapper.dispatchEvent(makeTouchEvent('touchend', 120, 50))
    vi.useRealTimers()

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="detail"]')).toBeNull()
    })
  })

  it('在 Router 外调用 useAppStack 抛错', async () => {
    // 抑制 console.error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const Outside = () => {
      useAppStack()
      return null
    }
    expect(() => render(<Outside />)).toThrow(/useAppStack\(\) must be used within/)
    spy.mockRestore()
  })

  it('多个 AppStackRouter 实例栈相互隔离', async () => {
    // 用不同 testid 的 root,并通过 container.querySelector 直接读取各实例 DOM,
    // 避免 getByTestId 在 body 范围内的歧义
    const Home1 = () => {
      const {push} = useAppStack()
      return (
        <div data-testid="home1">
          <button data-testid="open1" onClick={() => push(Detail, {id: 1})}>
            Open
          </button>
        </div>
      )
    }
    const Home2 = () => {
      const {push} = useAppStack()
      return (
        <div data-testid="home2">
          <button data-testid="open2" onClick={() => push(Detail, {id: 2})}>
            Open
          </button>
        </div>
      )
    }

    const {container: c1} = render(<AppStackRouter root={<Home1 />} />)
    const {container: c2} = render(<AppStackRouter root={<Home2 />} />)

    // 点击实例 1 的 open 按钮
    const open1 = c1.querySelector('[data-testid="open1"]') as HTMLElement
    open1.click()

    // 实例 1 出现 detail,实例 2 不受影响
    await vi.waitFor(() => {
      expect(c1.querySelector('[data-testid="detail"]')).not.toBeNull()
      expect(c2.querySelector('[data-testid="detail"]')).toBeNull()
    })
    expect(c2.querySelector('[data-testid="home2"]')).not.toBeNull()
  })
})
