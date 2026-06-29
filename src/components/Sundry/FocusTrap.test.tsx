import { expect, describe, it, beforeEach, afterEach, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import React from 'react'
import { FocusTrap, type FocusDirection } from './FocusTrap'

function toEl(e: { element(): Element }): HTMLElement {
  return e.element() as HTMLElement
}



describe('FocusTrap', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  it('默认 Tab/Shift+Tab 在可聚焦元素间循环', async () => {
    const { getByTestId } = render(
      <FocusTrap>
        <input data-testid="input1" />
        <button data-testid="btn1">Button 1</button>
        <button data-testid="btn2">Button 2</button>
      </FocusTrap>,
      { container },
    )

    const input1 = toEl(getByTestId('input1'))
    const btn1 = toEl(getByTestId('btn1'))
    const btn2 = toEl(getByTestId('btn2'))

    input1.focus()
    expect(document.activeElement).toBe(input1)

    btn1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(btn1)

    btn1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(btn2)

    btn2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(input1)

    input1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(btn2)
  })

  it('disabled 时取消焦点劫持', async () => {
    const { getByTestId } = render(
      <FocusTrap disabled>
        <input data-testid="input1" />
        <button data-testid="btn1">Button</button>
      </FocusTrap>,
      { container },
    )

    const btn1 = toEl(getByTestId('btn1'))

    const handled = btn1.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )

    expect(handled).toBe(true)
  })

  it('keyMap 支持自定义按键导航', async () => {
    const { getByTestId } = render(
      <FocusTrap keyMap={{ ArrowDown: 'next', ArrowUp: 'prev' }}>
        <input data-testid="input1" />
        <button data-testid="btn1">Button 1</button>
        <button data-testid="btn2">Button 2</button>
      </FocusTrap>,
      { container },
    )

    const input1 = toEl(getByTestId('input1'))
    const btn1 = toEl(getByTestId('btn1'))
    const btn2 = toEl(getByTestId('btn2'))

    input1.focus()

    input1.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(btn1)

    btn1.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(btn2)

    btn2.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(document.activeElement).toBe(btn1)
  })

  it('keyMap 支持左右方向键导航', async () => {
    const { getByTestId } = render(
      <FocusTrap keyMap={{ ArrowRight: 'next', ArrowLeft: 'prev' }}>
        <input data-testid="input1" />
        <button data-testid="btn1">Button 1</button>
      </FocusTrap>,
      { container },
    )

    const input1 = toEl(getByTestId('input1'))
    const btn1 = toEl(getByTestId('btn1'))

    input1.focus()

    input1.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(btn1)

    btn1.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(document.activeElement).toBe(input1)
  })

  it('keyMap 可与 Tab 共存', async () => {
    const { getByTestId } = render(
      <FocusTrap keyMap={{ ArrowDown: 'next' }}>
        <input data-testid="input1" />
        <button data-testid="btn1">Button 1</button>
      </FocusTrap>,
      { container },
    )

    const input1 = toEl(getByTestId('input1'))
    const btn1 = toEl(getByTestId('btn1'))

    input1.focus()

    input1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(btn1)

    btn1.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(input1)
  })

  it('onNavigate 支持自定义焦点解析', async () => {
    const navigate = (
      _current: HTMLElement | null,
      _elements: HTMLElement[],
      direction: FocusDirection,
    ) => {
      if (direction === 'next') return _elements[_elements.length - 1]
      return _elements[0]
    }

    const { getByTestId } = render(
      <FocusTrap onNavigate={navigate}>
        <input data-testid="input1" />
        <button data-testid="btn1">Button 1</button>
        <button data-testid="btn2">Button 2</button>
      </FocusTrap>,
      { container },
    )

    const input1 = toEl(getByTestId('input1'))
    const btn2 = toEl(getByTestId('btn2'))

    input1.focus()

    input1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(btn2)
  })

  it('autoFocus 挂载时自动聚焦第一个元素', async () => {
    const { getByTestId } = render(
      <FocusTrap autoFocus>
        <input data-testid="input1" />
        <button data-testid="btn1">Button</button>
      </FocusTrap>,
      { container },
    )

    const input1 = toEl(getByTestId('input1'))
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(input1)
    })
  })

  it('空 tabbable 元素时不报错', async () => {
    const { getByTestId } = render(
      <FocusTrap>
        <div data-testid="div1">No focusable</div>
      </FocusTrap>,
      { container },
    )

    const div1 = toEl(getByTestId('div1'))
    div1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
  })

  it('focusableOptions 透传给 getTabbableElements', async () => {
    const captured: { elements: HTMLElement[] } = { elements: [] }

    const { getByTestId } = render(
      <FocusTrap
        focusableOptions={{ displayCheck: 'none' }}
        onNavigate={(current, elements) => {
          captured.elements = elements
          return current
        }}
      >
        <button data-testid="btn1" style={{ display: 'none' }}>
          Hidden
        </button>
        <button data-testid="btn2">Visible</button>
      </FocusTrap>,
      { container },
    )

    const btn2 = toEl(getByTestId('btn2'))
    btn2.focus()
    btn2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))

    expect(captured.elements.length).toBe(2)
  })

  it('未被 keyMap 覆盖的按键不拦截', async () => {
    const { getByTestId } = render(
      <FocusTrap keyMap={{ ArrowDown: 'next' }}>
        <input data-testid="input1" />
        <button data-testid="btn1">Button</button>
      </FocusTrap>,
      { container },
    )

    const btn1 = toEl(getByTestId('btn1'))

    const handled = btn1.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
    )

    expect(handled).toBe(true)
  })
})
