import React, {StrictMode, act as reactAct, useEffect, useMemo, useState} from "react";
import {describe, expect, it} from "vitest";
import {render} from "vitest-browser-react";
import {Emitter, Event} from "../utils";
import {useEvent, useEventCallback, useEventValue} from "./useEvent";

/**
 * React 的 act 封装。vitest-browser-react 会在它自己的 act 结束后把 `IS_REACT_ACT_ENVIRONMENT`
 * 复位，于是在测试里直接触发事件（继而触发状态更新）会打出「未配置 act」的告警。在自己的 act 期间
 * 把标志位置回 true，结束后还原。
 */
const act = (callback: () => void): void => {
  const scope = globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean};
  const previous = scope.IS_REACT_ACT_ENVIRONMENT;
  scope.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    reactAct(callback);
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = previous;
  }
};

/** 统计某个 emitter 上「有人开始订阅」的次数（每次 onDidAddListener 记一次）。 */
const createCountedEmitter = <T,>() => {
  let subscriptions = 0;
  const emitter = new Emitter<T>({onDidAddListener: () => subscriptions++});
  return {emitter, count: () => subscriptions};
};

describe("useEvent", () => {
  it("挂载时订阅、卸载时退订", () => {
    const emitter = new Emitter<number>();
    const seen: number[] = [];

    function Listener() {
      useEvent(emitter.event, (value) => seen.push(value));
      return null;
    }

    const {unmount} = render(<Listener />);
    expect(emitter.hasListeners()).toBe(true);

    emitter.fire(1);
    emitter.fire(2);
    expect(seen).toEqual([1, 2]);

    unmount();
    expect(emitter.hasListeners()).toBe(false);

    emitter.fire(3);
    expect(seen).toEqual([1, 2]);
  });

  it("渲染期间不订阅，订阅只发生在 effect 里", () => {
    const emitter = new Emitter<number>();
    const duringRender: boolean[] = [];

    function Listener() {
      // 渲染期订阅会让并发渲染下未提交的分支也挂上监听器
      duringRender.push(emitter.hasListeners());
      useEvent(emitter.event, () => {});
      return null;
    }

    render(<Listener />);

    expect(duringRender).toEqual([false]);
    expect(emitter.hasListeners()).toBe(true);
  });

  it("StrictMode 的挂载 → 卸载 → 再挂载之后，订阅依然生效", () => {
    const emitter = new Emitter<number>();
    const seen: number[] = [];

    function Listener() {
      useEvent(emitter.event, (value) => seen.push(value));
      return null;
    }

    render(
      <StrictMode>
        <Listener />
      </StrictMode>,
    );

    // 把订阅交给 effect 之外的 store、在清理函数里释放的写法，在这里会静默失效
    expect(emitter.hasListeners()).toBe(true);
    emitter.fire(7);
    expect(seen).toEqual([7]);
  });

  it("回调是最新一次渲染的闭包，且重渲染不会重订阅", () => {
    const {emitter, count} = createCountedEmitter<number>();
    const seen: string[] = [];

    function Listener({label}: {label: string}) {
      const [tick, setTick] = useState(0);
      useEvent(emitter.event, (value) => seen.push(`${label}:${value}:${tick}`));
      return (
        <button type="button" onClick={() => setTick((previous) => previous + 1)}>
          tick
        </button>
      );
    }

    const screen = render(<Listener label="first" />);
    emitter.fire(1);

    screen.rerender(<Listener label="second" />);
    emitter.fire(2);

    // 状态更新引起的重渲染同样不该重订阅
    act(() => {
      (screen.container.querySelector("button") as HTMLButtonElement).click();
    });
    emitter.fire(3);

    expect(count()).toBe(1);
    expect(seen).toEqual(["first:1:0", "second:2:0", "second:3:1"]);
  });

  it("事件身份变化时换源：旧源摘钩，新源生效", () => {
    const first = new Emitter<number>();
    const second = new Emitter<number>();
    const seen: number[] = [];

    function Listener({event}: {event: Event<number>}) {
      useEvent(event, (value) => seen.push(value));
      return null;
    }

    const screen = render(<Listener event={first.event} />);
    // emitter.event 是缓存过的，所以内联写 `first.event` 也不会每次渲染换源
    first.fire(1);

    screen.rerender(<Listener event={second.event} />);
    expect(first.hasListeners()).toBe(false);
    expect(second.hasListeners()).toBe(true);

    first.fire(2);
    second.fire(3);
    expect(seen).toEqual([1, 3]);
  });

  it("用 Event.None 关闭订阅是零成本的", () => {
    const emitter = new Emitter<number>();
    const seen: number[] = [];

    function Listener({enabled}: {enabled: boolean}) {
      useEvent(enabled ? emitter.event : Event.None, (value) => seen.push(value));
      return null;
    }

    const screen = render(<Listener enabled={false} />);
    expect(emitter.hasListeners()).toBe(false);

    emitter.fire(1);
    expect(seen).toEqual([]);

    screen.rerender(<Listener enabled />);
    expect(emitter.hasListeners()).toBe(true);
    emitter.fire(2);
    expect(seen).toEqual([2]);
  });

  it("配套注意：内联新建的派生事件每轮渲染都会换源，useMemo 之后不会", () => {
    const {emitter, count} = createCountedEmitter<number>();
    const stable: number[] = [];
    const inline: string[] = [];

    function Stable({factor}: {factor: number}) {
      const doubled = useMemo(
        () => Event.map(emitter.event, (value) => value * factor),
        // 演示用：只依赖 emitter，故意不看 factor（factor 通过 ref 语义取最新值即可）
        // biome-ignore lint/correctness/useExhaustiveDependencies: 展示稳定化的最小写法
        [emitter],
      );
      useEvent(doubled, (value) => stable.push(value));
      return null;
    }

    function Inline({factor}: {factor: number}) {
      useEvent(
        Event.map(emitter.event, (value) => `${value * factor}`),
        (value) => inline.push(value),
      );
      return null;
    }

    const screen = render(
      <>
        <Stable factor={2} />
        <Inline factor={2} />
      </>,
    );
    const afterMount = count();

    screen.rerender(
      <>
        <Stable factor={2} />
        <Inline factor={2} />
      </>,
    );

    expect(count() - afterMount).toBe(1);

    emitter.fire(10);
    expect(stable).toEqual([20]);
    expect(inline).toEqual(["20"]);
  });
});

describe("useEventValue", () => {
  it("先返回 initial，触发后返回载荷", () => {
    const emitter = new Emitter<number>();

    function View() {
      const value = useEventValue(emitter.event, 0);
      return <span data-testid="value">{value}</span>;
    }

    const {getByTestId} = render(<View />);
    expect(getByTestId("value").element().textContent).toBe("0");

    act(() => emitter.fire(5));
    expect(getByTestId("value").element().textContent).toBe("5");
  });

  it("initial 只在挂载时使用", () => {
    const emitter = new Emitter<number>();

    function View({initial}: {initial: number}) {
      const value = useEventValue(emitter.event, initial);
      return <span data-testid="value">{value}</span>;
    }

    const screen = render(<View initial={1} />);
    act(() => emitter.fire(9));

    screen.rerender(<View initial={100} />);
    expect(screen.getByTestId("value").element().textContent).toBe("9");
  });

  it("同一个引用连续触发只重渲染一次（Object.is）", () => {
    const emitter = new Emitter<{id: number}>();
    const payload = {id: 1};
    let renders = 0;

    function View() {
      const value = useEventValue(emitter.event, payload);
      renders++;
      return <span data-testid="id">{value.id}</span>;
    }

    const {getByTestId} = render(<View />);
    const afterMount = renders;

    act(() => {
      emitter.fire(payload);
      emitter.fire(payload);
    });
    expect(renders).toBe(afterMount);

    act(() => emitter.fire({id: 2}));
    expect(renders).toBe(afterMount + 1);
    expect(getByTestId("id").element().textContent).toBe("2");
  });

  it("载荷本身是函数时不会被当成状态更新器", () => {
    const emitter = new Emitter<() => number>();

    function View() {
      const fn = useEventValue<() => number>(emitter.event, () => 0);
      return <span data-testid="out">{fn()}</span>;
    }

    const {getByTestId} = render(<View />);
    expect(getByTestId("out").element().textContent).toBe("0");

    act(() => emitter.fire(() => 42));
    expect(getByTestId("out").element().textContent).toBe("42");
  });

  it("配合 Event.latch 时，重复值不触发重渲染", () => {
    const emitter = new Emitter<string>();
    let renders = 0;

    function View() {
      // 「值真的变了才处理」交给 latch，hook 保持哑
      const value = useEventValue(Event.latch(emitter.event), "");
      renders++;
      return <span data-testid="value">{value}</span>;
    }

    const {getByTestId} = render(<View />);
    const afterMount = renders;

    act(() => {
      emitter.fire("a");
      emitter.fire("a");
    });
    expect(renders).toBe(afterMount + 1);
    expect(getByTestId("value").element().textContent).toBe("a");
  });
});

describe("useEventCallback", () => {
  it("身份在多次渲染之间稳定", () => {
    const refs: Array<(value: number) => number> = [];

    function View({step}: {step: number}) {
      const callback = useEventCallback((value: number) => value * step);
      refs.push(callback);
      return null;
    }

    const screen = render(<View step={1} />);
    screen.rerender(<View step={2} />);
    screen.rerender(<View step={3} />);

    expect(refs).toHaveLength(3);
    expect(refs[1]).toBe(refs[0]);
    expect(refs[2]).toBe(refs[0]);
  });

  it("调用时看到的是最新一次渲染的闭包", () => {
    let latest: ((value: number) => number) | null = null;

    function View({step}: {step: number}) {
      latest = useEventCallback((value: number) => value * step);
      return null;
    }

    const screen = render(<View step={2} />);
    expect(latest!(10)).toBe(20);

    screen.rerender(<View step={5} />);
    expect(latest!(10)).toBe(50);
  });

  it("稳定身份让依赖它的 effect 只跑一次，但仍拿到最新闭包", () => {
    const runs: Array<() => number> = [];

    function View({step}: {step: number}) {
      const callback = useEventCallback(() => step);
      useEffect(() => {
        runs.push(callback);
      }, [callback]);
      return null;
    }

    const screen = render(<View step={1} />);
    screen.rerender(<View step={2} />);
    screen.rerender(<View step={3} />);

    expect(runs).toHaveLength(1);
    expect(runs[0]()).toBe(3);
  });
});
