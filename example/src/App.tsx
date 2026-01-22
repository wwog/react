import { FC, useEffect } from "react";
import { ArrayRender, createExternalState, useScreen } from "../../src";

const dateState = createExternalState(Date.now());

export const Component: FC = () => {
  const date = dateState.useGetter();
  return <div>{date}</div>;
};

function App() {
  const currentBreakpoint = useScreen();


  useEffect(() => {
    console.log("Current breakpoint:", currentBreakpoint);
  }, [currentBreakpoint]);
  return <ArrayRender
    items={[1, 2, 3, 4, 5]}
    renderItem={(item) => <div>{item}</div>}
    filter={(item) => item > 100}
    renderEmpty={() => <div>No items</div>}
  />
}

export default App;
