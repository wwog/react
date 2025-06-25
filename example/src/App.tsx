import { FC } from "react";
import { Observer,createExternalState,SizeBox } from "../../src";

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
        <SizeBox h={60}/>
        <SizeBox h={60}/>
        <SizeBox h={60}/>
        <SizeBox h={60}/>
        <SizeBox h={60}/>
        <SizeBox h={60}/>
        <Observer onIntersect={(entry) => {
         console.log('onIntersect',entry)
        }}>
          <Component />
        </Observer>
      </div>
    </div>
  );
}

export default App;
