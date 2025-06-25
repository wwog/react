import { expect, describe, it, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-react";
import {
  createExternalState,
  createStorageState,
  type ExternalWithKernel,
} from "./createExternalState";
import React from "react";

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

  it("测试use钩子在组件中使用", async () => {
    const initialState = "initial";
    const state = createExternalState(initialState);

    function TestComponent() {
      const [value, setValue] = state.use();
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
      const [value, setValue] = state.use();
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
      const [value, setValue] = state.use();
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
      const [value, setValue] = state.use();
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

  it("测试副作用函数", () => {
    const mockSideEffect = vi.fn((...args) => void 0);
    const initialState: string = "initial";
    const state = createExternalState(initialState, {
      sideEffect: mockSideEffect,
    });
    state.set("updated");
    expect(mockSideEffect).toHaveBeenCalledTimes(1);
    expect(mockSideEffect).toHaveBeenCalledWith("updated", initialState);
    state.set("updated2");
    expect(mockSideEffect).toHaveBeenCalledTimes(2);
    expect(mockSideEffect).toHaveBeenCalledWith("updated2", "updated");
  });

  it("测试异步副作用函数", async () => {
    const mockAsyncSideEffect = vi.fn().mockResolvedValue(undefined);
    const initialState: string = "initial";
    const state = createExternalState(initialState, {
      sideEffect: mockAsyncSideEffect,
    });

    state.set("updated");
    expect(mockAsyncSideEffect).toHaveBeenCalledTimes(1);
    expect(mockAsyncSideEffect).toHaveBeenCalledWith("updated", initialState);
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
      const [user, setUser] = state.use();
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

  it("测试transform转换功能", async () => {
    const state = createExternalState("hello", {
      transform: {
        get: (str) => str.toUpperCase(),
        set: (str) => str.toLowerCase(),
      },
    });

    expect(state.get()).toBe("HELLO");

    state.set("WORLD");
    expect(state.get()).toBe("WORLD");

    function TestComponent() {
      const [value, setValue] = state.use();
      return (
        <div>
          <span data-testid="value">{value}</span>
          <button data-testid="update" onClick={() => setValue("TEST")}>
            Update
          </button>
        </div>
      );
    }

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId("value").element().textContent).toBe("WORLD");

    await getByTestId("update").click();
    expect(getByTestId("value").element().textContent).toBe("TEST");
    expect(state.get()).toBe("TEST");
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

  it("测试存储副作用函数", () => {
    const mockSideEffect = vi.fn();
    const state = createStorageState("test-key", "initial" as string, {
      storageType: "local",
      sideEffect: mockSideEffect,
    });
    
    state.set("updated");
    
    expect(mockSideEffect).toHaveBeenCalledTimes(1);
    expect(mockSideEffect).toHaveBeenCalledWith("updated");
    expect(localStorage.getItem("test-key")).toBe('"updated"');
  });

  it("测试存储状态的transform功能", () => {
    const state = createStorageState("test-key", "hello", {
      storageType: "local",
      transform: {
        get: (str) => str.toUpperCase(),
        set: (str) => str.toLowerCase(),
      },
    });
    
    expect(state.get()).toBe("HELLO");
    
    state.set("WORLD");
    expect(state.get()).toBe("WORLD");
    expect(localStorage.getItem("test-key")).toBe('"world"');
  });

  it("测试存储状态在React组件中的使用", async () => {
    const state = createStorageState("component-key", "initial", {
      storageType: "local",
    });
    
    function TestComponent() {
      const [value, setValue] = state.use();
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
