import React, {
  cloneElement,
  FC,
  Fragment,
  isValidElement,
  useEffect,
  type HTMLElementType,
} from "react";
import { cx, type CxInput } from "../../utils/cx";

export interface ClassNameProps {
  className?: {
    base?: CxInput;
    hover?: CxInput;
    active?: CxInput;
    focus?: CxInput;
    disabled?: CxInput;
    [key: string]: CxInput;
  };
  /**
   * @description 传入容器标签名.是否生成包含所有 `className` 的 `wrapper`, 默认 false, 传递 `true` 为 `div。`
   * @description_en Whether to generate a `wrapper` containing all `className`, default is false, and pass the container tag name, if `true` will be `div`.
   */
  asWrapper?: boolean | HTMLElementType;
  children?: React.ReactNode;
}

/**
 * @description 用于将 `className` 分类编写的组件，内置了类似`clsx`的功能,并且去除重复的 className。
 * @description_en A component for `className` classification, built-in similar to `clsx` functionality, and removes duplicate className.
 * @component
 * @example
 * ```tsx
 * <ClassName className={{ base: "p-2 bg-red", hover: ["hover:bg-blue", { "hover:text-white": true }] }}>
 *   <button>Click me</button>
 * </ClassName>
 * ```
 *
 * @example
 * ```tsx
 * <ClassName
 *   className={{
 *     base: ["p-2", { "bg-red": condition }],
 *     hover: { "hover:bg-blue": true },
 *   }}
 *   asWrapper="span"
 * >
 *   <button>Click me</button>
 * </ClassName>
 * ```
 */
export const ClassName: FC<ClassNameProps> = (props) => {
  const { className, children, asWrapper } = props;

  useEffect(() => {
    if (isValidElement(children) === false) {
      console.warn(
        "<ClassName>: children is not a valid React element. Please check your code."
      );
    }
  }, [children]);

  if (!children) {
    return null;
  }

  if (!className) {
    return <Fragment>{children}</Fragment>;
  }

  const generatedCls = cx(...Object.values(className));

  if (asWrapper) {
    const Wrapper = typeof asWrapper === "string" ? asWrapper : "div";
    return <Wrapper className={generatedCls}>{children}</Wrapper>;
  }

  if (isValidElement(children)) {
    return cloneElement(children, {
      //@ts-expect-error type error
      className: cx(children.props.className, generatedCls),
    } as any);
  }

  return <Fragment>{children}</Fragment>;
};
