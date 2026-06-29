import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {getFocusableElements, getTabbableElements, isFocusable, isTabbable} from './focusable'

describe('focusable utils', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  it('识别基础可聚焦元素', () => {
    container.innerHTML = `
      <button id="btn">Button</button>
      <input id="input" />
      <a id="link" href="#">Link</a>
      <a id="no-link">No Link</a>
    `

    const btn = container.querySelector('#btn')!
    const input = container.querySelector('#input')!
    const link = container.querySelector('#link')!
    const noLink = container.querySelector('#no-link')!

    expect(isFocusable(btn)).toBe(true)
    expect(isTabbable(btn)).toBe(true)
    expect(isFocusable(input)).toBe(true)
    expect(isFocusable(link)).toBe(true)
    expect(isFocusable(noLink)).toBe(false)
    expect(isTabbable(noLink)).toBe(false)
  })

  it('区分 focusable 与 tabbable（tabindex=-1）', () => {
    container.innerHTML = `<div id="neg" tabindex="-1">Negative</div>`

    const neg = container.querySelector('#neg')!
    expect(isFocusable(neg)).toBe(true)
    expect(isTabbable(neg)).toBe(false)
    expect(getFocusableElements(container)).toHaveLength(1)
    expect(getTabbableElements(container)).toHaveLength(0)
  })

  it('排除 disabled 与 hidden input', () => {
    container.innerHTML = `
      <button disabled>Disabled</button>
      <input type="hidden" />
      <input disabled />
      <button>Enabled</button>
    `

    expect(getFocusableElements(container)).toHaveLength(1)
    expect(getTabbableElements(container)).toHaveLength(1)
  })

  it('排除不可见元素', () => {
    container.innerHTML = `
      <button id="visible">Visible</button>
      <button id="hidden" style="display: none">Hidden</button>
      <button id="invisible" style="visibility: hidden">Invisible</button>
    `

    expect(getFocusableElements(container).map((el) => el.id)).toEqual(['visible'])
    expect(getTabbableElements(container).map((el) => el.id)).toEqual(['visible'])
  })

  it('排除 inert 容器内的元素', () => {
    container.innerHTML = `
      <button id="outside">Outside</button>
      <div inert>
        <button id="inside">Inside</button>
      </div>
    `

    expect(getFocusableElements(container).map((el) => el.id)).toEqual(['outside'])
  })

  it('处理 fieldset disabled', () => {
    container.innerHTML = `
      <fieldset disabled>
        <legend><input id="legend-input" /></legend>
        <input id="blocked-input" />
      </fieldset>
    `

    expect(isFocusable(container.querySelector('#legend-input')!)).toBe(true)
    expect(isFocusable(container.querySelector('#blocked-input')!)).toBe(false)
  })

  it('radio group 中只有 checked 项 tabbable', () => {
    container.innerHTML = `
      <input type="radio" name="group" id="r1" />
      <input type="radio" name="group" id="r2" checked />
      <input type="radio" name="group" id="r3" />
    `

    expect(isFocusable(container.querySelector('#r1')!)).toBe(true)
    expect(isFocusable(container.querySelector('#r2')!)).toBe(true)
    expect(isTabbable(container.querySelector('#r1')!)).toBe(false)
    expect(isTabbable(container.querySelector('#r2')!)).toBe(true)
    expect(getTabbableElements(container)).toHaveLength(1)
  })

  it('按 tab 顺序排序 tabbable 元素', () => {
    container.innerHTML = `
      <button id="third" tabindex="3">Third</button>
      <button id="first">First</button>
      <button id="second" tabindex="1">Second</button>
    `

    expect(getTabbableElements(container).map((el) => el.id)).toEqual(['second', 'third', 'first'])
  })

  it('includeContainer 包含容器本身', () => {
    container.setAttribute('tabindex', '0')
    container.innerHTML = '<button>Child</button>'

    expect(getFocusableElements(container, {includeContainer: true})).toHaveLength(2)
    expect(getTabbableElements(container, {includeContainer: true})).toHaveLength(2)
  })

  it('遍历 open shadow root', () => {
    const host = document.createElement('div')
    container.appendChild(host)
    const shadow = host.attachShadow({mode: 'open'})
    shadow.innerHTML = '<button id="shadow-btn">Shadow</button>'

    expect(getFocusableElements(host)).toHaveLength(1)
    expect(getTabbableElements(host)).toHaveLength(1)
  })

  it('details 未展开时内部元素不可聚焦', () => {
    container.innerHTML = `
      <details id="details">
        <summary>Summary</summary>
        <button id="inside">Inside</button>
      </details>
    `

    expect(isFocusable(container.querySelector('summary')!)).toBe(true)
    expect(isFocusable(container.querySelector('#inside')!)).toBe(false)
  })

  it('iframe 计入 focusable', () => {
    container.innerHTML = '<iframe title="frame"></iframe><button>Btn</button>'

    expect(getFocusableElements(container)).toHaveLength(2)
    expect(isFocusable(container.querySelector('iframe')!)).toBe(true)
    expect(isTabbable(container.querySelector('iframe')!)).toBe(false)
  })

  it('contenteditable 元素识别', () => {
    container.innerHTML = `
      <div id="editable" contenteditable>Editable</div>
      <div id="editable-true" contenteditable="true">True</div>
      <div id="no-edit" contenteditable="false">Not</div>
    `

    expect(isFocusable(container.querySelector('#editable')!)).toBe(true)
    expect(isTabbable(container.querySelector('#editable')!)).toBe(true)
    expect(isFocusable(container.querySelector('#editable-true')!)).toBe(true)
    expect(isTabbable(container.querySelector('#editable-true')!)).toBe(true)
    expect(isFocusable(container.querySelector('#no-edit')!)).toBe(false)
    expect(isTabbable(container.querySelector('#no-edit')!)).toBe(false)
  })

  it('audio/video controls 元素识别', () => {
    container.innerHTML = `
      <audio id="audio-ctrl" controls></audio>
      <audio id="audio-noctrl"></audio>
      <video id="video-ctrl" controls></video>
      <video id="video-noctrl"></video>
    `

    expect(isFocusable(container.querySelector('#audio-ctrl')!)).toBe(true)
    expect(isFocusable(container.querySelector('#audio-noctrl')!)).toBe(false)
    expect(isFocusable(container.querySelector('#video-ctrl')!)).toBe(true)
    expect(isFocusable(container.querySelector('#video-noctrl')!)).toBe(false)
    expect(isTabbable(container.querySelector('#audio-ctrl')!)).toBe(true)
    expect(isTabbable(container.querySelector('#video-ctrl')!)).toBe(true)
  })

  it('area[href] 计入 focusable', () => {
    container.innerHTML = `
      <map name="testmap">
        <area id="area-href" shape="rect" href="#" coords="0,0,100,100" />
        <area id="area-nohref" shape="rect" coords="0,0,100,100" />
      </map>
    `

    expect(isFocusable(container.querySelector('#area-href')!)).toBe(true)
    expect(isFocusable(container.querySelector('#area-nohref')!)).toBe(false)
  })

  it('displayCheck: none 不过滤隐藏元素', () => {
    container.innerHTML = `
      <button id="visible">V</button>
      <button id="hidden" style="display: none">H</button>
    `
    const opts = {displayCheck: 'none' as const}

    expect(getFocusableElements(container, opts).map((el) => el.id)).toEqual(['visible', 'hidden'])
    expect(getTabbableElements(container, opts).map((el) => el.id)).toEqual(['visible', 'hidden'])
    expect(isFocusable(container.querySelector('#hidden')!, opts)).toBe(true)
    expect(isTabbable(container.querySelector('#hidden')!, opts)).toBe(true)
  })

  it('displayCheck: non-zero-area 过滤零面积元素', () => {
    container.innerHTML = `
      <button id="normal">N</button>
      <button id="zero" style="width:0;height:0;overflow:hidden;padding:0;border:0"></button>
    `
    const opts = {displayCheck: 'non-zero-area' as const}

    const result = getFocusableElements(container, opts)
    expect(result.map((el) => el.id)).toEqual(['normal'])
    expect(isFocusable(container.querySelector('#zero')!, opts)).toBe(false)
  })

  it('非挂载元素在 full displayCheck 下不可聚焦', () => {
    const detached = document.createElement('button')
    expect(isFocusable(detached)).toBe(false)
    expect(isTabbable(detached)).toBe(false)
  })

  it('元素自身带 inert 属性不被识别', () => {
    container.innerHTML = `
      <button id="normal">N</button>
      <button id="self-inert" inert>S</button>
    `
    expect(isFocusable(container.querySelector('#self-inert')!)).toBe(false)
    expect(isTabbable(container.querySelector('#self-inert')!)).toBe(false)
    expect(getFocusableElements(container).map((el) => el.id)).toEqual(['normal'])
  })

  it('嵌套 inert：祖先 inert 过滤后代元素', () => {
    container.innerHTML = `
      <div>
        <button id="ok">OK</button>
      </div>
      <div inert>
        <div>
          <button id="deep">Deep</button>
        </div>
        <input id="deep-input" />
      </div>
    `
    const result = getFocusableElements(container)
    expect(result.map((el) => el.id)).toEqual(['ok'])
  })

  it('tabindex 混合排序：正数 > 零 > 负数不可 tabbable', () => {
    container.innerHTML = `
      <button id="zero-1">Z1</button>
      <button id="pos-5" tabindex="5">P5</button>
      <button id="pos-3" tabindex="3">P3</button>
      <button id="zero-2">Z2</button>
      <button id="neg" tabindex="-1">Neg</button>
      <button id="pos-1" tabindex="1">P1</button>
    `
    const result = getTabbableElements(container)
    expect(result).toHaveLength(5)
    expect(result.map((el) => el.id).slice(0, 3)).toEqual(['pos-1', 'pos-3', 'pos-5'])
    expect(result.map((el) => el.id).slice(3)).toEqual(['zero-1', 'zero-2'])
  })

  it('自定义 getShadowRoot 函数解析 shadow', () => {
    const shadowContainer = document.createElement('div')
    container.appendChild(shadowContainer)
    const closedShadow = shadowContainer.attachShadow({mode: 'closed'})
    const inner = document.createElement('button')
    inner.id = 'inner-btn'
    closedShadow.appendChild(inner)

    const getShadow = (el: Element) => (el === shadowContainer ? closedShadow : undefined)
    const result = getFocusableElements(shadowContainer, {getShadowRoot: getShadow})
    expect(result.map((el) => el.id)).toEqual(['inner-btn'])
  })

  it('select 和 textarea 基础识别', () => {
    container.innerHTML = `
      <select id="sel"><option>A</option></select>
      <textarea id="ta"></textarea>
      <select id="sel-disabled" disabled><option>B</option></select>
    `

    expect(isFocusable(container.querySelector('#sel')!)).toBe(true)
    expect(isTabbable(container.querySelector('#sel')!)).toBe(true)
    expect(isFocusable(container.querySelector('#ta')!)).toBe(true)
    expect(isFocusable(container.querySelector('#sel-disabled')!)).toBe(false)
  })

  it('不同 form 中间名 radio 各自独立 tabbable', () => {
    container.innerHTML = `
      <form id="form-a">
        <input type="radio" name="r" id="a1" />
        <input type="radio" name="r" id="a2" checked />
      </form>
      <form id="form-b">
        <input type="radio" name="r" id="b1" />
        <input type="radio" name="r" id="b2" checked />
      </form>
    `

    expect(getTabbableElements(container).map((el) => el.id)).toEqual(['a2', 'b2'])
    expect(isTabbable(container.querySelector('#a2')!)).toBe(true)
    expect(isTabbable(container.querySelector('#b2')!)).toBe(true)
  })

  it('details 有 summary 时自身可聚焦，无 summary 时不纳入 candidate', () => {
    container.innerHTML = `
      <details id="with-summary">
        <summary>Click</summary>
        <button>Inside</button>
      </details>
      <details id="no-summary">
        <button>Inside</button>
      </details>
    `

    expect(isFocusable(container.querySelector('#with-summary')!)).toBe(false)
    expect(isFocusable(container.querySelector('#no-summary')!)).toBe(true)
  })

  it('多层嵌套 shadow DOM 中收集元素', () => {
    const outer = document.createElement('div')
    container.appendChild(outer)
    const outerShadow = outer.attachShadow({mode: 'open'})
    const mid = document.createElement('div')
    outerShadow.appendChild(mid)
    const innerShadow = mid.attachShadow({mode: 'open'})
    innerShadow.innerHTML = '<button id="deep-shadow-btn">Deep</button>'

    const result = getFocusableElements(outer)
    expect(result.map((el) => el.id)).toEqual(['deep-shadow-btn'])
  })

  it('slot 展开 assigned elements 后收集', () => {
    const host = document.createElement('div')
    container.appendChild(host)
    const shadow = host.attachShadow({mode: 'open'})
    shadow.innerHTML = '<slot></slot>'
    const btn = document.createElement('button')
    btn.id = 'slotted-btn'
    host.appendChild(btn)

    const result = getFocusableElements(host)
    expect(result.map((el) => el.id)).toEqual(['slotted-btn'])
  })

  it('visibility: collapse 等同于 hidden', () => {
    container.innerHTML = `
      <button id="visible">V</button>
      <button id="collapsed" style="visibility: collapse">C</button>
    `

    expect(getFocusableElements(container).map((el) => el.id)).toEqual(['visible'])
    expect(isFocusable(container.querySelector('#collapsed')!)).toBe(false)
  })

  it('空容器返回空数组', () => {
    container.innerHTML = ''
    expect(getFocusableElements(container)).toHaveLength(0)
    expect(getTabbableElements(container)).toHaveLength(0)
  })

  it('displayCheck: full-native 使用 checkVisibility API', () => {
    container.innerHTML = '<button id="btn">X</button>'
    const opt = {displayCheck: 'full-native' as const}
    expect(isFocusable(container.querySelector('#btn')!, opt)).toBe(true)
    expect(isTabbable(container.querySelector('#btn')!, opt)).toBe(true)
  })
})
