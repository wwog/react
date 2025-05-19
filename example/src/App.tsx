import { FC } from "react";
import { createExternalState } from "../../src";
import { Clamp } from "../../src";

const dateState = createExternalState(Date.now());

export const Component: FC = () => {
  const date = dateState.useGetter();
  return <div>{date}</div>;
};

function App() {
  return (
    <div>
      <div
        style={{
          width: 200,
          border: "1px solid #ccc",
          resize: "horizontal",
        }}
      >
        <Clamp
          maxLine={2}
          text="一个元素浮动被移出正常的文档流，然后向左或者向右平移，一直平移直到碰到了所处的容器的边框，或者碰到另外一个浮动的元素"
          extraHeight={22}
          ellipsis
          extraContent={
            <span
              style={{
                fontSize: 14,
                color: "blue",
                cursor: "pointer",
              }}
              onClick={() => {
                alert("点击了");
              }}
            >
              查看更多
            </span>
          }
        />
      </div>
    </div>
  );
}

export default App;
