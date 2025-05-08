import React, {
  Children,
  cloneElement,
  FC,
  Fragment,
  isValidElement,
  type HTMLElementType,
} from "react";
import { cx, type CxInput } from "../../utils/cx";

export interface StylesDescriptor {
  base?: CxInput;
  hover?: CxInput;
  active?: CxInput;
  focus?: CxInput;
  disabled?: CxInput;
  color?: CxInput;
  size?: CxInput;
  layer?: CxInput;
  wrapper?: CxInput;
  dark?: CxInput;
  light?: CxInput;
  sundry?: CxInput;
  [key: string]: CxInput;
}

const isStylesDescriptor = (obj: any): obj is StylesDescriptor => {
  return typeof obj === "object" && !!obj;
};

export type StylesType = StylesDescriptor | string;

export interface StylesProps {
  /**
   * @description_en either as a simple string or a categorized object with predefined or custom keys.
   * @description 可以是简单字符串或包含预定义或自定义键的分类对象。
   * @example
   * ```tsx
   * // Simple string
   * <Styles className="p-2 bg-red">
   *   <button>Click</button>
   * </Styles>
   *
   * // Categorized object
   * <Styles
   *   className={{
   *     base: ["p-2", { "bg-red": true }],
   *     hover: "hover:bg-blue",
   *     color: "text-blue",
   *   }}
   * >
   *   <button>Click</button>
   * </Styles>
   * ```
   */
  className?: StylesType;
  /**
   * @description 传入容器标签名.是否生成包含所有 `className` 的 `wrapper`, 默认 false, 传递 `true` 为 `div。`
   * @description_en Whether to generate a `wrapper` containing all `className`, default is false, and pass the container tag name, if `true` will be `div`.
   */
  asWrapper?: boolean | HTMLElementType;
  children?: React.ReactNode;
}

/**
 * @description 分类编写样式和基本的string样式，内置类似 `clsx` 对类型描述对象的值进行组合，支持去除重复类名,支持嵌套。
 * @description_en Categorized writing styles and basic string styles, built-in similar to `clsx` to combine the values of type description objects, support removing duplicate class names, and support nesting.
 * @component
 * @example
 * ```tsx
 * <Styles className={{ base: "p-2 bg-red", hover: ["hover:bg-blue", { "hover:text-white": true }] }}>
 *   <button>Click me</button>
 * </Styles>
 * ```
 *
 * @example
 * ```tsx
 * <Styles
 *   className="p-2 bg-red"
 *   asWrapper="span"
 * >
 *   <button>Click me</button>
 * </Styles>
 * ```
 */
export const Styles: FC<StylesProps> = ({
  className,
  children,
  asWrapper = false,
}) => {
  if (!children) {
    return null;
  }
  if (Children.count(children) > 1) {
    console.error(
      "<Styles>: children has more than one child. Please check your code."
    );
    return <Fragment>{children}</Fragment>;
  }

  if (!className) {
    return <Fragment>{children}</Fragment>;
  }

  const generatedClassName =
    typeof className === "string" ? className : cx(...Object.values(className));

  if (asWrapper) {
    const Tag = asWrapper === true ? "div" : asWrapper;
    return <Tag className={generatedClassName}>{children}</Tag>;
  }
  if (isValidElement(children)) {
    const typeChildren = children as any;
    let processedChildClassName = typeChildren?.props?.className;

    if (typeChildren?.type?.displayName === Styles.displayName) {
      if (isStylesDescriptor(processedChildClassName)) {
        processedChildClassName = cx(...Object.values(processedChildClassName));
      }
    }

    return cloneElement(children, {
      className: cx(generatedClassName, processedChildClassName),
    } as any);
  }
  console.error(
    "<Styles>: children is not a valid React element. Please check your code."
  );
  return <Fragment>{children}</Fragment>;
};
Styles.displayName = "W/Styles";
