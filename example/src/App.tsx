import { FC, ReactNode } from "react";
import { Toggle } from "../../src/index";
const Content: FC = (props) => {
  const { open, toggle } = props as any;
  const handleClick = () => {
    console.log("clicked");
    toggle();
  };
  return (
    <div
      onClick={handleClick}
      style={{
        backgroundColor: open ? "#f0f0f0" : "#fff",
        padding: "10px",
        borderRadius: "5px",
        cursor: "pointer",
      }}
    >
      {open ? "Open" : "Closed"}
    </div>
  );
};
interface ComponentProps {
  children?: ReactNode;
}
export const Component: FC<ComponentProps> = (props) => {
  return <div>{props.children}</div>;
};

function App() {
  return (
    <div>
      <Toggle source={false} options={[true, false]} target="open">
        <Content />
      </Toggle>
    </div>
  );
}

export default App;
