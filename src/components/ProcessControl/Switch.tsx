import React from "react";
import { childrenLoop } from "../../utils/reactUtils";

export interface SwitchProps<T> {
  value: T;
  /**
   * @description 可选的比对函数，默认() => a===b
   * @description_en optional compare function, default to () => a === b
   **/
  compare?: (a: T, b: T) => boolean;
  children?: React.ReactNode;
  /**
   * @description 是否严格模式，默认 false.建议跟随开发环境变化,严格模式下,会循环所有节点来提供更多的错误提示
   * @description_en strict mode, default to false. It is recommended to follow the development environment changes. In strict mode, all nodes will be looped to provide more error prompts
   * @extra
   * 1.严格模式下，无论什么情况都会循环所有节点，以确保所有的 case 和 default 都能被检查到
   * 2.非严格模式下，如果有一个 case 匹配成功，就不会继续循环
   * @extra_en
   * 1. In strict mode, all nodes will be looped regardless of the situation to ensure that all cases and defaults can be checked
   * 2. In non-strict mode, if a case matches successfully, it will not continue to loop
   */
  strict?: boolean;
}

export interface SwitchCaseProps<T> {
  value: T;
  children?: React.ReactNode;
}

export interface SwitchDefaultProps {
  children?: React.ReactNode;
}

const defaultCompare = <T,>(a: T, b: T): boolean => {
  return a === b;
};

const Case = <T,>(props: SwitchCaseProps<T>): React.ReactElement => {
  return <>{props.children}</>;
};
Case.displayName = "Switch_Case";

const Default = (props: SwitchDefaultProps): React.ReactElement => {
  return <>{props.children}</>;
};
Default.displayName = "Switch_Default";

type SwitchChildType = typeof Case | typeof Default;
/**
 * @description Switch 组件用于根据传入的 value 渲染不同的子组件
 * @description_en The Switch component is used to render different child components based on the passed value
 */
export const Switch = <T,>(
  props: SwitchProps<T>
): React.ReactElement | null => {
  const { value, compare = defaultCompare, children, strict = false } = props;
  const seenValues = new Set<T>();
  let matchedChildren: React.ReactNode = null;
  let defaultChild: React.ReactNode = null;
  let hasDefault = false;

  childrenLoop(children, (child, index) => {
    if (!React.isValidElement(child)) {
      throw new Error(
        `Switch Children only accepts valid React elements at index ${index}`
      );
    }
    const type = child.type as SwitchChildType;

    if (type.displayName === Case.displayName) {
      const caseProps = child.props as SwitchCaseProps<T>;

      if (seenValues.has(caseProps.value)) {
        throw new Error(
          `Switch found duplicate Case value at index ${index}: ${JSON.stringify(
            caseProps.value
          )}${strict ? " (detected in strict mode)" : ""}`
        );
      }
      seenValues.add(caseProps.value);

      if (!matchedChildren && compare(value, caseProps.value)) {
        matchedChildren = caseProps.children;
        if (strict === false) {
          return false;
        }
      }
    } else if (type.displayName === Default.displayName) {
      if (hasDefault) {
        throw new Error(
          `Switch can only have one Default child at index ${index}`
        );
      }
      hasDefault = true;
      defaultChild = (child.props as SwitchDefaultProps).children;
      if (!strict && matchedChildren) {
        return false;
      }
    } else {
      throw new Error(
        `Switch Children only accepts 'Case' or 'Default' elements, found: ${String(
          type.displayName || type.name || type
        )} at index ${index}`
      );
    }
  });

  return <>{matchedChildren ?? defaultChild}</>;
};

Switch.displayName = "Switch";
Switch.Case = Case;
Switch.Default = Default;
Switch.createTyped = function <T>() {
  return {
    Switch: Switch<T>,
    Case: Case<T>,
    Default: Default,
  } as {
    Switch: (props: SwitchProps<T>) => React.ReactElement | null;
    Case: (props: SwitchCaseProps<T>) => React.ReactElement;
    Default: (props: SwitchDefaultProps) => React.ReactElement;
  };
};
