import { expect, describe, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import {
  createExternalState,
  type ExternalWithKernel,
} from "./createExternalState";
import { safePromiseTry } from "./promise";
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
