import React from "react";
import type { FC, ReactNode } from "react";
import type { BreakpointDesc, Responsive } from "../../utils/constants";

interface FlexProps {
  children?: ReactNode;
  breakpointDesc?: BreakpointDesc;
  type?: Responsive<"row" | "column" | "row-reverse" | "column-reverse">;
}
export const Flex: FC<FlexProps> = (props) => {
  const { type } = props;
  return (
    <div
      style={{
        display: "flex",
      }}
    >
      {props.children}
    </div>
  );
};
