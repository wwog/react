import React, { FC } from "react";
import { True } from "../ProcessControl/If";

export interface ClampProps {
  /**
   * @default 20
   */
  lineHeight?: number;
  /**
   * @description 最大行数
   * @description_en maximum number of lines
   * @default 1
   */
  maxLine?: number;
  extraContent?: React.ReactNode;
  /**
   * @description 用于控制额外内容的高度，如果出现没有正常显示请调节此属性
   * @description_en used to control the height of the extra content. If it does not display normally, please adjust this property
   * @default 20
   */
  extraHeight?: number;
  /**
   * @description 是否显示省略号
   * @description_en whether to display ellipsis
   */
  ellipsis?: boolean;
  /**
   * @description 替换省略号内容
   * @description_en replace ellipsis content
   * @default '<span>...</span>'
   */
  ellipsisContent?: React.ReactNode;
  /**
   * @description 显示的文本
   * @description_en text to be displayed
   */
  text: string;
  /**
   * @description 背景颜色,请不要使用`wrapperStyle`覆盖此设置，因纯兼容性的css方式实现。默认白色
   * @description_en background color, please do not use `wrapperStyle` to override this setting, because it is implemented in a pure compatible css way. Default white
   * @default '#fff'
   */
  bgColor?: string;
  wrapperStyle?: React.CSSProperties;
}

/**
 * @description 用于固定行数，显示省略号且显示额外内容的组件。兼容性非常好，没有用到webkit-box和js。
 * @description_en used to fix the number of lines, display ellipsis and display extra content. The compatibility is very good, without using webkit-box and js.
 * @param props
 * @returns
 */
export const Clamp: FC<ClampProps> = (props) => {
  const {
    lineHeight = 20,
    maxLine = 1,
    text,
    extraHeight = 20,
    extraContent,
    bgColor = "#fff",
    ellipsis = false,
    ellipsisContent = <span>...</span>,
    wrapperStyle,
  } = props;
  return (
    <div
      style={{
        display: "flex",
        overflow: "hidden",
        position: "relative",
        background: bgColor,
        ...wrapperStyle,
      }}
    >
      <div
        className="text"
        style={{
          lineHeight: `${lineHeight}px`,
          maxHeight: `${lineHeight * maxLine}px`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            float: "right",
            height: `calc(100% - ${extraHeight - 2}px)`,
          }}
        ></div>
        <div
          style={{
            float: "right",
            clear: "both",
            height: extraHeight,
          }}
        >
          <True condition={ellipsis}>{ellipsisContent}</True>
          {extraContent}
        </div>
        {text}
        <div
          style={{
            display: "inline-block",
            width: "100%",
            height: "100%",
            position: "absolute",
            background: bgColor,
          }}
        ></div>
      </div>
    </div>
  );
};
