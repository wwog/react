import { FC, ReactNode } from "react";
import { Styles } from "../../src";
interface ComponentProps {
  children?: ReactNode;
}
export const Component: FC<ComponentProps> = (props) => {
  return <div>{props.children}</div>;
};

function App() {
  return (
    <div>
      <Styles
        className={{
          base: "p-2 bg-red",
          active: "bg-blue-500",
          hover: "bg-green-500",
        }}
      >
        <Styles className={{ base: "leading" }}>
          <div>123</div>
        </Styles>
      </Styles>
    </div>
  );
}

export default App;
