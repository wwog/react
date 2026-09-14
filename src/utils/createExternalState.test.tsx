import { expect, describe, it, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-react";
import {
  createExternalState,
  createStorageState,
  type ExternalWithKernel,
} from "./createExternalState";
import { shallowEqual } from "./shallowEqual";
import React, { useState } from "react";

describe("createExternalState", () => {
  it("测试初始状态值", () => {
    const initialState = "initial";
    const state = createExternalState(initialState);
    expect(state.get()).toBe(initialState);
  });

  it("测试set方法更新状态", () => {
    const initialState = "initial";
    const newState = "updated";
    const state = createExternalState(initialState);

    state.set(newState);
    expect(state.get()).toBe(newState);
  });

  it("测试useState钩子在组件中使用", async () => {
    const initialState = "initial";
    const state = createExternalState(initialState);

    function TestComponent() {
      const [value, setValue] = state.useState();
      return (
        <div>
          <span data-testid="value">{value}</span>
          <button onClick={() => setValue("updated")}>Update</button>
        </div>
      );
    }

    const { getByTestId, getByText } = render(<TestComponent />);
    const valueLocator = getByTestId("value");
    const buttonLocator = getByText("Update");
    expect(valueLocator.element().textContent).toBe(initialState);
    await buttonLocator.click();
    expect(valueLocator.element().textContent).toBe("updated");
    expect(state.get()).toBe("updated");
  });

  it("测试多个组件共享状态", async () => {
    const initialState = "initial";
    const state = createExternalState(initialState);

    function ComponentA() {
      const [value, setValue] = state.useState();
      return (
        <div>
          <span data-testid="valueA">{value}</span>
          <button data-testid="buttonA" onClick={() => setValue("updatedA")}>
            Update A
          </button>
        </div>
      );
    }

    function ComponentB() {
      const [value, setValue] = state.useState();
      return (
        <div>
          <span data-testid="valueB">{value}</span>
          <button data-testid="buttonB" onClick={() => setValue("updatedB")}>
            Update B
          </button>
        </div>
      );
    }

    const { getByTestId } = render(
      <>
        <ComponentA />
        <ComponentB />
      </>
    );
    const valueALocator = getByTestId("valueA");
    const valueBLocator = getByTestId("valueB");
    const buttonALocator = getByTestId("buttonA");
    const buttonBLocator = getByTestId("buttonB");
    expect(valueALocator.element().textContent).toBe(initialState);
    expect(valueBLocator.element().textContent).toBe(initialState);
    await buttonALocator.click();
    expect(valueALocator.element().textContent).toBe("updatedA");
    expect(valueBLocator.element().textContent).toBe("updatedA");
    expect(state.get()).toBe("updatedA");
    await buttonBLocator.click();
    expect(valueALocator.element().textContent).toBe("updatedB");
    expect(valueBLocator.element().textContent).toBe("updatedB");
    expect(state.get()).toBe("updatedB");
  });

  it("测试组件卸载时移除监听器", () => {
    const initialState = "initial";
    const state = createExternalState(
      initialState
    ) as ExternalWithKernel<string>;

    function TestComponent() {
      const [value, setValue] = state.useState();
      return (
        <div>
          <span data-testid="value">{value}</span>
          <button onClick={() => setValue("updated")}>Update</button>
        </div>
      );
    }
    expect(state.__listeners.length).toBe(0);
    const { rerender, getByTestId } = render(<TestComponent />);
    expect(state.__listeners.length).toBe(1);
    const valueLocator = getByTestId("value");
    expect(valueLocator.element().textContent).toBe(initialState);
    rerender(<div>Rerender</div>);
    expect(state.__listeners.length).toBe(0);
  });

  it("测试 onSet 每次 set 都会触发", () => {
    const mockOnSet = vi.fn((...args) => void 0);
    const initialState: string = "initial";
    const state = createExternalState(initialState, {
      onSet: mockOnSet,
    });
    state.set("updated");
    expect(mockOnSet).toHaveBeenCalledTimes(1);
    expect(mockOnSet).toHaveBeenCalledWith("updated", initialState);
    state.set("updated");
    expect(mockOnSet).toHaveBeenCalledTimes(2);
    expect(mockOnSet).toHaveBeenCalledWith("updated", "updated");
    state.set("updated2");
    expect(mockOnSet).toHaveBeenCalledTimes(3);
    expect(mockOnSet).toHaveBeenCalledWith("updated2", "updated");
  });

  it("测试 onChange 仅在值变化时触发", () => {
    const mockOnChange = vi.fn((...args) => void 0);
    const initialState: string = "initial";
    const state = createExternalState(initialState, {
      onChange: mockOnChange,
    });
    state.set("updated");
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith("updated", initialState);
    state.set("updated");
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    state.set("updated2");
    expect(mockOnChange).toHaveBeenCalledTimes(2);
    expect(mockOnChange).toHaveBeenCalledWith("updated2", "updated");
  });

  it("测试异步 onSet 回调", async () => {
    const mockAsyncOnSet = vi.fn().mockResolvedValue(undefined);
    const initialState: string = "initial";
    const state = createExternalState(initialState, {
      onSet: mockAsyncOnSet,
    });

    state.set("updated");
    expect(mockAsyncOnSet).toHaveBeenCalledTimes(1);
    expect(mockAsyncOnSet).toHaveBeenCalledWith("updated", initialState);
  });

  it("测试复杂数据类型", async () => {
    interface User {
      name: string;
      age: number;
    }

    const initialUser: User = { name: "张三", age: 25 };
    const state = createExternalState<User>(initialUser);

    expect(state.get()).toEqual(initialUser);

    const updatedUser: User = { name: "李四", age: 30 };
    state.set(updatedUser);
    expect(state.get()).toEqual(updatedUser);

    function TestComponent() {
      const [user, setUser] = state.useState();
      return (
        <div>
          <span data-testid="name">{user.name}</span>
          <span data-testid="age">{user.age}</span>
          <button onClick={() => setUser({ name: "王五", age: 35 })}>
            Update
          </button>
        </div>
      );
    }

    const { getByTestId, getByText } = render(<TestComponent />);
    const nameLocator = getByTestId("name");
    const ageLocator = getByTestId("age");
    const buttonLocator = getByText("Update");
    expect(nameLocator.element().textContent).toBe("李四");
    expect(ageLocator.element().textContent).toBe("30");
    await buttonLocator.click();
    expect(nameLocator.element().textContent).toBe("王五");
    expect(ageLocator.element().textContent).toBe("35");
    expect(state.get()).toEqual({ name: "王五", age: 35 });
  });
});

describe("useSelector", () => {
  interface AppState {
    name: string;
    age: number;
    theme: string;
  }

  const createAppState = () =>
    createExternalState<AppState>({ name: "wwog", age: 1, theme: "light" });

  it("测试只订阅切片:无关字段变化不重渲染", async () => {
    const state = createAppState();
    let nameRenders = 0;
    let ageRenders = 0;
    let fullRenders = 0;

    function NameView() {
      const name = state.useSelector((s) => s.name);
      nameRenders++;
      return <span data-testid="name">{name}</span>;
    }

    function AgeView() {
      const age = state.useSelector((s) => s.age);
      ageRenders++;
      return <span data-testid="age">{age}</span>;
    }

    // 整份 state 的消费者:任意字段变化都应该重渲染
    function FullView() {
      const [full] = state.useState();
      fullRenders++;
      return <span data-testid="theme">{full.theme}</span>;
    }

    const { getByTestId, getByText } = render(
      <>
        <NameView />
        <AgeView />
        <FullView />
        <button onClick={() => state.set((prev) => ({ ...prev, theme: "dark" }))}>
          write theme
        </button>
        <button onClick={() => state.set((prev) => ({ ...prev, age: prev.age + 1 }))}>
          write age
        </button>
        <button onClick={() => state.set((prev) => ({ ...prev, name: `${prev.name}!` }))}>
          write name
        </button>
      </>
    );

    const nameBaseline = nameRenders;
    const ageBaseline = ageRenders;
    const fullBaseline = fullRenders;
    expect(getByTestId("name").element().textContent).toBe("wwog");

    // 改 theme:只有整份 state 的消费者重渲染,两个切片消费者都不动
    await getByText("write theme").click();
    expect(getByTestId("theme").element().textContent).toBe("dark");
    expect(fullRenders).toBe(fullBaseline + 1);
    expect(nameRenders).toBe(nameBaseline);
    expect(ageRenders).toBe(ageBaseline);

    // 改 age:只有 age 消费者 + 整份消费者重渲染
    await getByText("write age").click();
    expect(getByTestId("age").element().textContent).toBe("2");
    expect(ageRenders).toBe(ageBaseline + 1);
    expect(nameRenders).toBe(nameBaseline);
    expect(fullRenders).toBe(fullBaseline + 2);

    // 改 name:换一个消费者动,验证两个切片消费者互不牵连
    await getByText("write name").click();
    expect(getByTestId("name").element().textContent).toBe("wwog!");
    expect(nameRenders).toBe(nameBaseline + 1);
    expect(ageRenders).toBe(ageBaseline + 1);
    expect(fullRenders).toBe(fullBaseline + 3);
  });

  it("测试合成对象切片:默认 Object.is 会重渲染,shallowEqual 不会", async () => {
    const state = createAppState();
    let defaultRenders = 0;
    let shallowRenders = 0;

    function DefaultPick() {
      // 每次都是新对象,默认 Object.is 判定为「变了」
      const head = state.useSelector((s) => ({ name: s.name, age: s.age }));
      defaultRenders++;
      return <span data-testid="default">{`${head.name}:${head.age}`}</span>;
    }

    function ShallowPick() {
      const head = state.useSelector((s) => ({ name: s.name, age: s.age }), shallowEqual);
      shallowRenders++;
      return <span data-testid="shallow">{`${head.name}:${head.age}`}</span>;
    }

    const { getByTestId, getByText } = render(
      <>
        <DefaultPick />
        <ShallowPick />
        <button onClick={() => state.set((prev) => ({ ...prev, theme: "dark" }))}>
          write theme
        </button>
        <button onClick={() => state.set((prev) => ({ ...prev, age: prev.age + 1 }))}>
          write age
        </button>
      </>
    );

    const defaultBaseline = defaultRenders;
    const shallowBaseline = shallowRenders;
    // 能渲染出内容就说明没有陷入「快照永远不等」的死循环
    expect(getByTestId("shallow").element().textContent).toBe("wwog:1");

    // 无关字段变化:合成对象内容相同,浅比较的消费者不重渲染
    await getByText("write theme").click();
    expect(defaultRenders).toBe(defaultBaseline + 1);
    expect(shallowRenders).toBe(shallowBaseline);

    // 相关字段变化:两者都必须重渲染并读到新值——证明浅比较不是「永不更新」
    await getByText("write age").click();
    expect(getByTestId("default").element().textContent).toBe("wwog:2");
    expect(getByTestId("shallow").element().textContent).toBe("wwog:2");
    expect(shallowRenders).toBe(shallowBaseline + 1);
    expect(defaultRenders).toBe(defaultBaseline + 2);
  });

  it("测试自定义 isEqual 生效", async () => {
    const state = createAppState();
    let renders = 0;

    function ModuloView() {
      // 只关心 age 的个位:个位相同即视为未变化,返回值沿用上一次的切片
      const age = state.useSelector((s) => s.age, (next, prev) => next % 10 === prev % 10);
      renders++;
      return <span data-testid="age">{age}</span>;
    }

    const { getByTestId, getByText } = render(
      <>
        <ModuloView />
        <button onClick={() => state.set((prev) => ({ ...prev, age: 11 }))}>to 11</button>
        <button onClick={() => state.set((prev) => ({ ...prev, age: 12 }))}>to 12</button>
      </>
    );

    const baseline = renders;
    expect(getByTestId("age").element().textContent).toBe("1");

    // 1 → 11:个位没变,不重渲染
    await getByText("to 11").click();
    expect(renders).toBe(baseline);
    expect(getByTestId("age").element().textContent).toBe("1");

    // 11 → 12:个位变了,重渲染并拿到当前值
    await getByText("to 12").click();
    expect(renders).toBe(baseline + 1);
    expect(getByTestId("age").element().textContent).toBe("12");
  });

  it("测试切换 selector 后读到最新切片", async () => {
    const state = createAppState();

    function SwitchingView() {
      const [which, setWhich] = useState<"name" | "age">("name");
      // 内联 selector:每次 render 都是新引用,切换后必须读到当前切片而不是缓存
      const value = state.useSelector((s) => (which === "name" ? s.name : s.age));
      return (
        <>
          <span data-testid="value">{value}</span>
          <button onClick={() => setWhich("age")}>switch</button>
          <button onClick={() => state.set((prev) => ({ ...prev, age: 7 }))}>write age</button>
        </>
      );
    }

    const { getByTestId, getByText } = render(<SwitchingView />);
    expect(getByTestId("value").element().textContent).toBe("wwog");

    await getByText("switch").click();
    expect(getByTestId("value").element().textContent).toBe("1");

    await getByText("write age").click();
    expect(getByTestId("value").element().textContent).toBe("7");
  });

  it("测试组件外 set 触发切片更新,卸载后移除监听器", async () => {
    const state = createAppState() as ExternalWithKernel<AppState>;

    function AgeView() {
      const age = state.useSelector((s) => s.age);
      return <span data-testid="age">{age}</span>;
    }

    function NameView() {
      const [full] = state.useState();
      return <span data-testid="name">{full.name}</span>;
    }

    expect(state.__listeners.length).toBe(0);
    const { getByTestId, rerender } = render(
      <>
        <AgeView />
        <NameView />
      </>
    );
    // useSelector 与 useState 各自注册一个订阅
    expect(state.__listeners.length).toBe(2);

    // 组件外直接 set:没有事件处理器,React 会异步调度这次更新,所以等待其落地
    state.set((prev) => ({ ...prev, age: 9 }));
    await vi.waitFor(() => {
      expect(getByTestId("age").element().textContent).toBe("9");
    });

    rerender(<div>Rerender</div>);
    expect(state.__listeners.length).toBe(0);
  });

  it("测试 subscribe 在任意变化时触发并支持退订", () => {
    const state = createAppState();
    const listener = vi.fn();
    const unsubscribe = state.subscribe(listener);

    state.set((prev) => ({ ...prev, theme: "dark" }));
    state.set((prev) => ({ ...prev, age: 2 }));
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    state.set((prev) => ({ ...prev, age: 3 }));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("测试 subscribeWithSelector 只在切片变化时触发", () => {
    const state = createAppState();
    const listener = vi.fn();
    const unsubscribe = state.subscribeWithSelector((s) => s.age, listener);

    // 无关字段变化:切片没变,不触发
    state.set((prev) => ({ ...prev, theme: "dark" }));
    expect(listener).not.toHaveBeenCalled();

    state.set((prev) => ({ ...prev, age: 2 }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(2, 1);

    // 写成同一个值:切片没变,不触发
    state.set((prev) => ({ ...prev, age: 2 }));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    state.set((prev) => ({ ...prev, age: 3 }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("测试 subscribeWithSelector 的 fireImmediately 与自定义 isEqual", () => {
    const state = createAppState();
    const immediate = vi.fn();
    state.subscribeWithSelector((s) => s.age, immediate, { fireImmediately: true });
    expect(immediate).toHaveBeenCalledTimes(1);
    expect(immediate).toHaveBeenCalledWith(1, 1);

    const byLength = vi.fn();
    state.subscribeWithSelector((s) => s.name, byLength, {
      isEqual: (next, prev) => next.length === prev.length,
    });
    // "wwog" → "abcd":长度相同,视为未变化
    state.set((prev) => ({ ...prev, name: "abcd" }));
    expect(byLength).not.toHaveBeenCalled();

    // 长度变了才触发,上一次切片仍是最初的 "wwog"
    state.set((prev) => ({ ...prev, name: "abcde" }));
    expect(byLength).toHaveBeenCalledTimes(1);
    expect(byLength).toHaveBeenCalledWith("abcde", "wwog");
  });

  it("测试 createStorageState 也支持 useSelector", async () => {
    localStorage.clear();
    const state = createStorageState("selector-key", "");

    let lengthRenders = 0;
    function LengthView() {
      const length = state.useSelector((s) => s.length);
      lengthRenders++;
      return <span data-testid="length">{length}</span>;
    }

    const { getByTestId, getByText } = render(
      <>
        <LengthView />
        <button onClick={() => state.set("hello")}>write hello</button>
        <button onClick={() => state.set("world")}>write world</button>
      </>
    );

    const baseline = lengthRenders;
    expect(getByTestId("length").element().textContent).toBe("0");

    await getByText("write hello").click();
    expect(getByTestId("length").element().textContent).toBe("5");
    expect(lengthRenders).toBe(baseline + 1);
    expect(localStorage.getItem("selector-key")).toBe('"hello"');

    // 长度没变的内容更新:切片相同不重渲染,但存储照常写入
    await getByText("write world").click();
    expect(lengthRenders).toBe(baseline + 1);
    expect(localStorage.getItem("selector-key")).toBe('"world"');
  });
});

describe("createStorageState", () => {
  beforeEach(() => {
    // 清理localStorage和sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("测试localStorage初始状态", () => {
    const state = createStorageState("test-key", "initial", {
      storageType: "local",
    });
    expect(state.get()).toBe("initial");
    expect(localStorage.getItem("test-key")).toBeNull();
  });

  it("测试localStorage状态持久化", () => {
    const state = createStorageState("test-key", "initial", {
      storageType: "local",
    });

    state.set("updated");
    expect(state.get()).toBe("updated");
    expect(localStorage.getItem("test-key")).toBe('"updated"');
  });

  it("测试从localStorage恢复状态", () => {
    // 预先设置localStorage值
    localStorage.setItem("test-key", '"stored-value"');

    const state = createStorageState("test-key", "initial", {
      storageType: "local",
    });

    expect(state.get()).toBe("stored-value");
  });

  it("测试sessionStorage状态持久化", () => {
    const state = createStorageState("test-key", "initial", {
      storageType: "session",
    });

    state.set("session-updated");
    expect(state.get()).toBe("session-updated");
    expect(sessionStorage.getItem("test-key")).toBe('"session-updated"');
  });

  it("测试从sessionStorage恢复状态", () => {
    // 预先设置sessionStorage值
    sessionStorage.setItem("test-key", '"session-stored"');

    const state = createStorageState("test-key", "initial", {
      storageType: "session",
    });

    expect(state.get()).toBe("session-stored");
  });

  it("测试复杂对象的存储和恢复", () => {
    interface User {
      name: string;
      age: number;
    }

    const initialUser: User = { name: "张三", age: 25 };
    const state = createStorageState<User>("user-key", initialUser, {
      storageType: "local",
    });

    const updatedUser: User = { name: "李四", age: 30 };
    state.set(updatedUser);

    expect(state.get()).toEqual(updatedUser);
    expect(JSON.parse(localStorage.getItem("user-key")!)).toEqual(updatedUser);

    // 创建新实例验证恢复
    const newState = createStorageState<User>("user-key", initialUser, {
      storageType: "local",
    });
    expect(newState.get()).toEqual(updatedUser);
  });

  it("测试存储解析错误处理", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // 设置无效的JSON数据
    localStorage.setItem("test-key", "invalid-json");

    const state = createStorageState("test-key", "fallback", {
      storageType: "local",
    });

    expect(state.get()).toBe("fallback");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse localStorage value for key "test-key"'),
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it("测试存储 onSet 回调", () => {
    const mockOnSet = vi.fn();
    const state = createStorageState("test-key", "initial" as string, {
      storageType: "local",
      onSet: mockOnSet,
    });

    state.set("updated");

    expect(mockOnSet).toHaveBeenCalledTimes(1);
    expect(mockOnSet).toHaveBeenCalledWith("updated", "initial");
    expect(localStorage.getItem("test-key")).toBe('"updated"');
  });

  it("测试存储状态在React组件中的使用", async () => {
    const state = createStorageState("component-key", "initial", {
      storageType: "local",
    });

    function TestComponent() {
      const [value, setValue] = state.useState();
      return (
        <div>
          <span data-testid="value">{value}</span>
          <button onClick={() => setValue("component-updated")}>Update</button>
        </div>
      );
    }

    const { getByTestId, getByText } = render(<TestComponent />);
    const valueLocator = getByTestId("value");
    const buttonLocator = getByText("Update");

    expect(valueLocator.element().textContent).toBe("initial");

    await buttonLocator.click();

    expect(valueLocator.element().textContent).toBe("component-updated");
    expect(state.get()).toBe("component-updated");
    expect(localStorage.getItem("component-key")).toBe('"component-updated"');
  });

  it("测试默认storageType为local", () => {
    const state = createStorageState("default-key", "initial");

    state.set("default-updated");

    expect(localStorage.getItem("default-key")).toBe('"default-updated"');
    expect(sessionStorage.getItem("default-key")).toBeNull();
  });
});
