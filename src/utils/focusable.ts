const candidateSelectors = [
  'input:not([inert]):not([inert] *)',
  'select:not([inert]):not([inert] *)',
  'textarea:not([inert]):not([inert] *)',
  'a[href]:not([inert]):not([inert] *)',
  'area[href]:not([inert]):not([inert] *)',
  'button:not([inert]):not([inert] *)',
  '[tabindex]:not(slot):not([inert]):not([inert] *)',
  'audio[controls]:not([inert]):not([inert] *)',
  'video[controls]:not([inert]):not([inert] *)',
  '[contenteditable]:not([contenteditable="false"]):not([inert]):not([inert] *)',
  'details>summary:first-of-type:not([inert]):not([inert] *)',
  'details:not([inert]):not([inert] *)',
] as const

const candidateSelector = candidateSelectors.join(',')

const focusableCandidateSelector = [
  ...candidateSelectors,
  'iframe:not([inert]):not([inert] *)',
].join(',')

const elementMatches =
  typeof Element === 'undefined'
    ? () => false
    : Element.prototype.matches ||
      (Element.prototype as Element & {msMatchesSelector?: typeof Element.prototype.matches})
        .msMatchesSelector ||
      (Element.prototype as Element & {webkitMatchesSelector?: typeof Element.prototype.matches})
        .webkitMatchesSelector

function matches(node: Element, selector: string): boolean {
  return elementMatches ? elementMatches.call(node, selector) : false
}

export interface FocusableOptions {
  /**
   * @description_en Whether to include the container element in results.
   * @description_zh 是否将容器元素本身纳入结果。
   * @default false
   */
  includeContainer?: boolean
  /**
   * @description_en Traverse open shadow roots. Pass a function for custom shadow resolution.
   * @description_zh 是否遍历 open shadow root；也可传入函数自定义 shadow 解析。
   * @default true
   */
  getShadowRoot?: boolean | GetShadowRootFn
  /**
   * @description_en Strategy for visibility checks.
   * @description_zh 可见性检查策略。
   * @default 'full'
   */
  displayCheck?: 'full' | 'full-native' | 'legacy-full' | 'non-zero-area' | 'none'
}

type GetShadowRootFn = (element: Element) => ShadowRoot | boolean | undefined

interface CandidateScope {
  scopeParent: Element
  candidates: Array<Element | CandidateScope>
}

interface ResolvedOptions {
  includeContainer: boolean
  getShadowRoot: boolean | GetShadowRootFn
  displayCheck: NonNullable<FocusableOptions['displayCheck']>
}

interface SortableTabbable {
  documentOrder: number
  tabIndex: number
  item: Element | CandidateScope
  isScope: boolean
  content: Element[]
}

const defaultOptions: ResolvedOptions = {
  includeContainer: false,
  getShadowRoot: true,
  displayCheck: 'full',
}

function resolveOptions(options?: FocusableOptions): ResolvedOptions {
  return {
    includeContainer: options?.includeContainer ?? defaultOptions.includeContainer,
    getShadowRoot: options?.getShadowRoot ?? defaultOptions.getShadowRoot,
    displayCheck: options?.displayCheck ?? defaultOptions.displayCheck,
  }
}

function getRootNode(element: Element): Node {
  return element.getRootNode()
}

function isInert(node: Node | null | undefined, lookUp = true): boolean {
  if (!(node instanceof Element)) {
    return false
  }

  const inertAttr = node.getAttribute('inert')
  const inert = inertAttr === '' || inertAttr === 'true'

  if (inert) {
    return true
  }

  if (!lookUp) {
    return false
  }

  if (typeof node.closest === 'function') {
    return node.closest('[inert]') !== null
  }

  return isInert(node.parentElement, true)
}

function isContentEditable(node: Element): boolean {
  const value = node.getAttribute('contenteditable')
  return value === '' || value === 'true'
}

function hasTabIndex(node: Element): boolean {
  return !Number.isNaN(Number.parseInt(node.getAttribute('tabindex') ?? '', 10))
}

/**
 * @description_zh 获取元素的有效 tab 顺序值（含浏览器默认映射）。
 * @description_en Returns the effective tab order for an element, including browser defaults.
 */
export function getTabIndex(node: Element): number {
  if (!(node instanceof HTMLElement)) {
    return -1
  }

  if (node.tabIndex < 0) {
    if (
      (/^(AUDIO|VIDEO|DETAILS)$/i.test(node.tagName) || isContentEditable(node)) &&
      !hasTabIndex(node)
    ) {
      return 0
    }
  }

  return node.tabIndex
}

function getSortOrderTabIndex(node: Element, isScope: boolean): number {
  const tabIndex = getTabIndex(node)

  if (tabIndex < 0 && isScope && !hasTabIndex(node)) {
    return 0
  }

  return tabIndex
}

function isInput(node: Element): node is HTMLInputElement {
  return node.tagName === 'INPUT'
}

function isHiddenInput(node: Element): boolean {
  return isInput(node) && node.type === 'hidden'
}

function isDetailsWithSummary(node: Element): boolean {
  return (
    node.tagName === 'DETAILS' &&
    Array.prototype.some.call(node.children, (child: Element) => child.tagName === 'SUMMARY')
  )
}

function getCheckedRadio(
  nodes: HTMLInputElement[],
  form: HTMLFormElement | null,
): HTMLInputElement | undefined {
  for (const node of nodes) {
    if (node.checked && node.form === form) {
      return node
    }
  }
  return undefined
}

function isTabbableRadio(node: HTMLInputElement): boolean {
  if (!node.name) {
    return true
  }

  const radioScope = node.form ?? getRootNode(node)
  const queryRadios = (name: string) =>
    (radioScope as ParentNode).querySelectorAll<HTMLInputElement>(
      `input[type="radio"][name="${CSS.escape(name)}"]`,
    )

  const radioSet = queryRadios(node.name)
  const checked = getCheckedRadio(Array.from(radioSet), node.form)
  return !checked || checked === node
}

function isNonTabbableRadio(node: Element): boolean {
  return isInput(node) && node.type === 'radio' && !isTabbableRadio(node)
}

function isNodeAttached(node: Element): boolean {
  let nodeRoot = getRootNode(node)
  let nodeRootHost = nodeRoot instanceof ShadowRoot ? nodeRoot.host : undefined
  let attached = false

  if (nodeRoot && nodeRoot !== node) {
    attached = Boolean(
      nodeRootHost?.ownerDocument?.contains(nodeRootHost) || node.ownerDocument?.contains(node),
    )

    while (!attached && nodeRootHost) {
      nodeRoot = getRootNode(nodeRootHost)
      nodeRootHost = nodeRoot instanceof ShadowRoot ? nodeRoot.host : undefined
      attached = Boolean(nodeRootHost?.ownerDocument?.contains(nodeRootHost))
    }
  }

  return attached
}

function isZeroArea(node: Element): boolean {
  const {width, height} = node.getBoundingClientRect()
  return width === 0 && height === 0
}

function isHidden(node: Element, options: ResolvedOptions): boolean {
  if (options.displayCheck === 'none') {
    return false
  }

  if (options.displayCheck === 'full-native' && 'checkVisibility' in node) {
    const visible = (node as HTMLElement).checkVisibility({
      checkOpacity: false,
      opacityProperty: false,
      contentVisibilityAuto: true,
      visibilityProperty: true,
      checkVisibilityCSS: true,
    })
    return !visible
  }

  const {visibility} = getComputedStyle(node)
  if (visibility === 'hidden' || visibility === 'collapse') {
    return true
  }

  const isDirectSummary = matches(node, 'details>summary:first-of-type')
  const nodeUnderDetails = isDirectSummary ? node.parentElement : node
  if (nodeUnderDetails && matches(nodeUnderDetails, 'details:not([open]) *')) {
    return true
  }

  if (
    options.displayCheck === 'full' ||
    options.displayCheck === 'full-native' ||
    options.displayCheck === 'legacy-full'
  ) {
    if (typeof options.getShadowRoot === 'function') {
      const originalNode = node
      let current: Element | null = node

      while (current) {
        const parentElement: Element | null = current.parentElement
        const rootNode: Node = getRootNode(current)

        if (
          parentElement &&
          !parentElement.shadowRoot &&
          options.getShadowRoot(parentElement) === true
        ) {
          return isZeroArea(current)
        }

        if (current.assignedSlot) {
          current = current.assignedSlot
        } else if (!parentElement && rootNode !== current.ownerDocument) {
          current = rootNode instanceof ShadowRoot ? rootNode.host : null
        } else {
          current = parentElement
        }
      }

      node = originalNode
    }

    if (isNodeAttached(node)) {
      return node.getClientRects().length === 0
    }

    if (options.displayCheck !== 'legacy-full') {
      return true
    }
  } else if (options.displayCheck === 'non-zero-area') {
    return isZeroArea(node)
  }

  return false
}

function isDisabledFromFieldset(node: Element): boolean {
  if (!/^(INPUT|BUTTON|SELECT|TEXTAREA)$/i.test(node.tagName)) {
    return false
  }

  let parentNode = node.parentElement
  while (parentNode) {
    if (parentNode.tagName === 'FIELDSET' && (parentNode as HTMLFieldSetElement).disabled) {
      for (let i = 0; i < parentNode.children.length; i++) {
        const child = parentNode.children.item(i)
        if (child?.tagName === 'LEGEND') {
          return matches(parentNode, 'fieldset[disabled] *') ? true : !child.contains(node)
        }
      }
      return true
    }
    parentNode = parentNode.parentElement
  }

  return false
}

function isDisabledElement(node: HTMLElement): boolean {
  return 'disabled' in node && Boolean((node as HTMLInputElement).disabled)
}

function isFocusableCandidate(node: Element, options: ResolvedOptions): boolean {
  if (!(node instanceof HTMLElement)) {
    return false
  }

  if (
    isDisabledElement(node) ||
    isHiddenInput(node) ||
    isHidden(node, options) ||
    isDetailsWithSummary(node) ||
    isDisabledFromFieldset(node)
  ) {
    return false
  }

  return true
}

function isTabbableCandidate(node: Element, options: ResolvedOptions): boolean {
  if (isNonTabbableRadio(node) || getTabIndex(node) < 0) {
    return false
  }

  return isFocusableCandidate(node, options)
}

function isShadowRootTabbable(shadowHostNode: Element): boolean {
  const tabIndex = Number.parseInt(shadowHostNode.getAttribute('tabindex') ?? '', 10)
  if (Number.isNaN(tabIndex) || tabIndex >= 0) {
    return true
  }
  return false
}

function getCandidates(
  container: Element,
  includeContainer: boolean,
  filter: (node: Element) => boolean,
  selector = candidateSelector,
): Element[] {
  if (isInert(container)) {
    return []
  }

  const candidates = Array.from(container.querySelectorAll(selector))
  if (includeContainer && matches(container, selector)) {
    candidates.unshift(container)
  }

  return candidates.filter(filter)
}

function getCandidatesIteratively(
  elements: Element[],
  includeContainer: boolean,
  options: ResolvedOptions,
  filter: (node: Element) => boolean,
  flatten: boolean,
  selector: string,
  shadowRootFilter?: (shadowHostNode: Element) => boolean,
): Array<Element | CandidateScope> {
  const candidates: Array<Element | CandidateScope> = []
  const elementsToCheck = [...elements]

  while (elementsToCheck.length > 0) {
    const element = elementsToCheck.shift()
    if (!element) {
      continue
    }

    if (isInert(element, false)) {
      continue
    }

    if (element.tagName === 'SLOT') {
      const slot = element as HTMLSlotElement
      const assigned = slot.assignedElements()
      const content = assigned.length > 0 ? assigned : Array.from(element.children)
      const nestedCandidates = getCandidatesIteratively(
        content,
        true,
        options,
        filter,
        flatten,
        selector,
        shadowRootFilter,
      )

      if (flatten) {
        candidates.push(...nestedCandidates)
      } else {
        candidates.push({
          scopeParent: element,
          candidates: nestedCandidates,
        })
      }
      continue
    }

    if (
      matches(element, selector) &&
      filter(element) &&
      (includeContainer || !elements.includes(element))
    ) {
      candidates.push(element)
    }

    const getShadowRootOption = options.getShadowRoot
    const shadowRoot: ShadowRoot | boolean | undefined =
      element.shadowRoot ??
      (typeof getShadowRootOption === 'function' ? getShadowRootOption(element) : undefined)

    const validShadowRoot =
      Boolean(shadowRoot) &&
      !isInert(shadowRoot as Node, false) &&
      (!shadowRootFilter || shadowRootFilter(element))

    if (validShadowRoot) {
      const nestedCandidates = getCandidatesIteratively(
        shadowRoot === true
          ? Array.from(element.children)
          : Array.from((shadowRoot as ShadowRoot).children),
        true,
        options,
        filter,
        flatten,
        selector,
        shadowRootFilter,
      )

      if (flatten) {
        candidates.push(...nestedCandidates)
      } else {
        candidates.push({
          scopeParent: element,
          candidates: nestedCandidates,
        })
      }
    } else {
      elementsToCheck.unshift(...Array.from(element.children))
    }
  }

  return candidates
}

function sortOrderedTabbables(a: SortableTabbable, b: SortableTabbable): number {
  return a.tabIndex === b.tabIndex ? a.documentOrder - b.documentOrder : a.tabIndex - b.tabIndex
}

function sortByTabOrder(candidates: Array<Element | CandidateScope>): Element[] {
  const regularTabbables: Element[] = []
  const orderedTabbables: SortableTabbable[] = []

  candidates.forEach((item, index) => {
    const isScope = 'scopeParent' in item
    const element = isScope ? item.scopeParent : item
    const candidateTabIndex = getSortOrderTabIndex(element, isScope)
    const elements = isScope ? sortByTabOrder(item.candidates) : [element]

    if (candidateTabIndex === 0) {
      regularTabbables.push(...elements)
    } else {
      orderedTabbables.push({
        documentOrder: index,
        tabIndex: candidateTabIndex,
        item,
        isScope,
        content: elements,
      })
    }
  })

  return orderedTabbables
    .sort(sortOrderedTabbables)
    .flatMap((sortable) => sortable.content)
    .concat(regularTabbables)
}

function collectCandidates(
  container: Element,
  options: ResolvedOptions,
  filter: (node: Element) => boolean,
  flatten: boolean,
  selector: string,
  shadowRootFilter?: (shadowHostNode: Element) => boolean,
): Element[] {
  if (options.getShadowRoot) {
    return getCandidatesIteratively(
      [container],
      options.includeContainer,
      options,
      filter,
      flatten,
      selector,
      shadowRootFilter,
    ) as Element[]
  }

  return getCandidates(container, options.includeContainer, filter, selector)
}

function toHTMLElementList(elements: Element[]): HTMLElement[] {
  return elements.filter((element): element is HTMLElement => element instanceof HTMLElement)
}

/**
 * @description_zh 判断单个元素是否可被 programmatic focus（含 tabindex="-1"）。
 * @description_en Whether an element can receive programmatic focus (includes tabindex="-1").
 */
export function isFocusable(node: Element, options?: FocusableOptions): boolean {
  const resolved = resolveOptions(options)

  if (!matches(node, focusableCandidateSelector)) {
    return false
  }

  return isFocusableCandidate(node, resolved)
}

/**
 * @description_zh 判断单个元素是否可通过 Tab 键聚焦。
 * @description_en Whether an element can be focused via the Tab key.
 */
export function isTabbable(node: Element, options?: FocusableOptions): boolean {
  const resolved = resolveOptions(options)

  if (!matches(node, candidateSelector)) {
    return false
  }

  return isTabbableCandidate(node, resolved)
}

/**
 * @description_zh 获取容器内所有可聚焦元素（含 tabindex="-1"）。
 * @description_en Returns all focusable elements within a container (includes tabindex="-1").
 */
export function getFocusableElements(
  container: Element,
  options?: FocusableOptions,
): HTMLElement[] {
  const resolved = resolveOptions(options)
  const candidates = collectCandidates(
    container,
    resolved,
    (node) => isFocusableCandidate(node, resolved),
    true,
    focusableCandidateSelector,
  )
  return toHTMLElementList(candidates)
}

/**
 * @description_zh 获取容器内所有可通过 Tab 键循环聚焦的元素，按 tab 顺序排列。
 * @description_en Returns tabbable elements within a container, sorted by tab order.
 */
export function getTabbableElements(container: Element, options?: FocusableOptions): HTMLElement[] {
  const resolved = resolveOptions(options)

  let candidates: Array<Element | CandidateScope>
  if (resolved.getShadowRoot) {
    candidates = getCandidatesIteratively(
      [container],
      resolved.includeContainer,
      resolved,
      (node) => isTabbableCandidate(node, resolved),
      false,
      candidateSelector,
      isShadowRootTabbable,
    )
  } else {
    candidates = getCandidates(container, resolved.includeContainer, (node) =>
      isTabbableCandidate(node, resolved),
    )
  }

  return toHTMLElementList(sortByTabOrder(candidates))
}
