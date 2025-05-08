import { expect, describe, it } from "vitest";
import { render } from "vitest-browser-react";
import { Styles } from "./Styles";
import React from "react";

describe("Styles Component", () => {
  it("测试传递styles的className StylesDescriptor", () => {
    const { getByRole } = render(
      <Styles
        className={{
          base: ["p-2"],
          hover: "hover:bg-blue",
          color: "text-blue",
        }}
      >
        <button>Click</button>
      </Styles>
    );
    const renderClassName = getByRole("button").elements()[0].className;
    expect(renderClassName).toBe("p-2 hover:bg-blue text-blue");
  });

  it("测试传递styles的className string", () => {
    const { getByRole } = render(
      <Styles className="button_class">
        <button>Click</button>
      </Styles>
    );
    const renderClassName = getByRole("button").elements()[0].className;
    expect(renderClassName).toBe("button_class");
  });

  it("测试嵌套的Styles组件,仅string", () => {
    const { getByRole } = render(
      <Styles className="outer">
        <Styles className="inner">
          <button>Click</button>
        </Styles>
      </Styles>
    );
    const renderClassName = getByRole("button").elements()[0].className;
    expect(renderClassName).toBe("outer inner");
  });

  it("测试嵌套的Styles组件,含string和StylesDescriptor", () => {
    const { getByRole } = render(
      <Styles
        className={{
          base: ["p-2"],
          hover: "hover:bg-blue",
          color: "text-blue",
        }}
      >
        <Styles className="button_class">
          <button>Click</button>
        </Styles>
      </Styles>
    );
    const renderClassName = getByRole("button").elements()[0].className;
    expect(renderClassName).toBe("p-2 hover:bg-blue text-blue button_class");
  });

  it("测试children本身含有样式的混入", () => {
    const { getByRole } = render(
      <Styles className={{ base: "wrapper" }}>
        <Styles className="outer">
          <button className="inner">Click</button>
        </Styles>
      </Styles>
    );
    const renderClassName = getByRole("button").elements()[0].className;
    expect(renderClassName).toBe("wrapper outer inner");
  });

  it("测试传递属性空值", () => {
    const { getByRole } = render(
      <Styles className={undefined}>
        <button>Click</button>
      </Styles>
    );
    const renderClassName = getByRole("button").elements()[0].className;
    expect(renderClassName).toBe("");
  });

  it("测试空值与有值嵌套", () => {
    const { getByRole } = render(
      <Styles className={undefined}>
        <Styles className="inner">
          <button>Click</button>
        </Styles>
      </Styles>
    );
    const renderClassName = getByRole("button").elements()[0].className;
    expect(renderClassName).toBe("inner");
  });

  it("测试asWrapper为true", () => {
    const { container } = render(
      <Styles className="wrapper" asWrapper={true}>
        <button>Click</button>
      </Styles>
    );
    expect(container.querySelector("div")?.className).toBe("wrapper");
    expect(container.querySelector("button")?.className).toBe("");
  });

  it("测试asWrapper为指定标签", () => {
    const { container } = render(
      <Styles className="wrapper" asWrapper="section">
        <button>Click</button>
      </Styles>
    );
    expect(container.querySelector("section")?.className).toBe("wrapper");
    expect(container.querySelector("button")?.className).toBe("");
  });

  it("测试asWrapper与嵌套组合", () => {
    const { container } = render(
      <Styles className="outer" asWrapper="div">
        <Styles className="inner">
          <button className="btn">Click</button>
        </Styles>
      </Styles>
    );
    expect(container.querySelector("div")?.className).toBe("outer");
    expect(container.querySelector("button")?.className).toBe("inner btn");
  });
});
