import { FC, ReactNode } from "react";

interface ComponentProps {
  children?: ReactNode;
}
export const Component: FC<ComponentProps> = (props) => {
  return <div>{props.children}</div>;
};

function App() {
  return <div></div>;
}

export default App;
