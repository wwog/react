import { FC } from "react";
import { createExternalState } from "../../src";

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
      </div>
      
    </div>
  );
}

export default App;
