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
          maxLine={1}
          text="或者碰到另外1231232133311"
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
