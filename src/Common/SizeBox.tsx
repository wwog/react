import React, { FC, ReactNode } from "react";

interface SizeBoxProps {
  size?: number | string;
  height?: number | string;
  width?: number | string;
  h?: number | string;
  w?: number | string;
  children?: ReactNode;
}
/**
 * @description SizeBox 组件用于设置一个固定大小的盒子
 */
export const SizeBox: FC<SizeBoxProps> = (props) => {
  const { children, h, w, size, height, width } = props;

  const widthValue = size || w || width;
  const heightValue = size || h || height;
  return (
    <div style={{ width: widthValue, height: heightValue }}>{children}</div>
  );
};
