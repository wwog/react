import { FC } from "react";
import { createExternalState } from "../../src";

const dateState = createExternalState(Date.now());

export const Component: FC = () => {
  const date = dateState.useGetter();
  return <div>{date}</div>;
};

function App() {
  const [date, setDate] = dateState.use();
  return (
    <div>
      use:{date}
      <button onClick={() => setDate(Date.now())}>getNow</button>
      <Component />
    </div>
  );
}

export default App;
