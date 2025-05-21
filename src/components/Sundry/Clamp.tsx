import React, { FC, useLayoutEffect, useMemo, useRef, useState } from "react";
import { True } from "../ProcessControl/If";

export interface ClampProps {
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
   * @description 显示的文本
   * @description_en text to be displayed
   */
  text: string;
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
    maxLine = 1,
    text,
    extraHeight = 22,
    extraContent,
    wrapperStyle,
  } = props;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [showExtra, setShowExtra] = useState(false);
  const isValidText = useMemo(() => {
    if (text === undefined || text === null || text === "") return false;
    return true;
  }, [text]);

  const checkTextOverflow = () => {
    if (!wrapperRef.current) {
      return;
    }
    const measureWrapper = document.createElement("div");
    measureWrapper.textContent = text;
    const wrapperStyle = getComputedStyle(wrapperRef.current);
    measureWrapper.style.width = wrapperStyle.width;
    measureWrapper.style.fontSize = wrapperStyle.fontSize;
    measureWrapper.style.lineHeight = wrapperStyle.lineHeight;
    measureWrapper.style.wordBreak = "break-all";
    measureWrapper.style.visibility = "hidden";

    document.body.appendChild(measureWrapper);

    const lineHeight =
      parseInt(getComputedStyle(measureWrapper).lineHeight) || 20;
    const height = measureWrapper.offsetHeight;
    const lines = Math.round(height / lineHeight);

    document.body.removeChild(measureWrapper);

    setShowExtra(lines > maxLine);
  };

  useLayoutEffect(() => {
    if (isValidText) {
      checkTextOverflow();
    }
  }, [maxLine, text, isValidText]);
  return (
    <True condition={isValidText}>
      <div
        ref={wrapperRef}
        style={{
          overflow: "hidden",
          width: "100%",
          display: "flex",
          ...wrapperStyle,
        }}
      >
        <div
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: maxLine,
            overflow: "hidden",
            wordBreak: "break-all",
          }}
        >
          <True condition={showExtra}>
            <div
              style={{
                float: "right",
                height: "100%",
                marginBottom: -extraHeight,
              }}
            ></div>
            <div
              style={{
                float: "right",
                clear: "both",
                height: extraHeight,
              }}
            >
              {extraContent}
            </div>
          </True>
          {text}
        </div>
      </div>
    </True>
  );
};
