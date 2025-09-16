import React, { Fragment, type ReactNode } from "react";

//#region component Types
export interface ArrayRenderProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  filter?: (item: T) => boolean;
  renderEmpty?: () => React.ReactNode;
}
//#endregion component Types

//#region component
export function ArrayRender<T>(props: ArrayRenderProps<T>): ReactNode {
  const { items, renderItem, filter, renderEmpty } = props;

  if (!items) {
    console.error("ArrayRender: items is null");
    return null;
  }

  if (items.length === 0) {
    return renderEmpty ? renderEmpty() : null;
  }

  return (
    <Fragment>
      {items.map((item, index) => {
        if (filter && !filter(item)) {
          return null;
        }
        return renderItem(item, index);
      })}
    </Fragment>
  );
}
//#endregion component
