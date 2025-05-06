import { FC, ReactNode } from "react";
import { DateRender } from "../../src/Common/DateRender";
interface ComponentProps {
  children?: ReactNode;
}
export const Component: FC<ComponentProps> = (props) => {
  return <div>{props.children}</div>;
};

function App() {
  return (
    <div>
      <DateRender source={new Date()}>
        {(formatted) => <div>{formatted}</div>}
      </DateRender>
    </div>
  );
}

export default App;
