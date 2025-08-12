import { Suspense, type Component } from 'solid-js';

const App: Component = (props: { children: Element }) => {

  return (
    <>
      <Suspense>{props.children}</Suspense>
    </>
  );
};

export default App;
