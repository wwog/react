import { FC, useEffect } from "react";
import { createExternalState, useScreen } from "../../src";

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
  return <div></div>;
}

export default App;
