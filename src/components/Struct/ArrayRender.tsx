import React, { Fragment, type ReactNode } from "react";

//#region component Types
export interface ArrayRenderProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  filter?: (item: T) => boolean;
  renderEmpty?: () => React.ReactNode;
  sort?: (a: T, b: T) => number;
}
//#endregion component Types

//#region component
export function ArrayRender<T>(props: ArrayRenderProps<T>): ReactNode {
  const { items, renderItem, filter, renderEmpty, sort } = props;

  if (!items) {
    console.error("ArrayRender: items is null");
    return null;
  }

  if (items.length === 0) {
    return renderEmpty ? renderEmpty() : null;
  }

  // 如果需要排序，先处理排序和过滤
  if (sort) {
    let processedItems = [...items];
    
    if (filter) {
      processedItems = processedItems.filter(filter);
    }
    
    processedItems = processedItems.sort(sort);

    if (processedItems.length === 0) {
      return renderEmpty ? renderEmpty() : null;
    }

    return (
      <Fragment>
        {processedItems.map((item, index) => {
          return renderItem(item, index);
        })}
      </Fragment>
    );
  }

  // 如果不需要排序，保持原来的循环中过滤方式
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
