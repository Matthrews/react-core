import React from "react";

function ChildrenDemo(props) {
  console.log(props.children);
  // 最终是一维数组, 不论你在callback返回的时候如何嵌套[c, [c, [c, c]]]
  console.log(React.Children.map(props.children, (c) => [c, [c, [c, c]]]));
  return props.children;
}

// eslint-disable-next-line import/no-anonymous-default-export
export default () => {
  return (
    <ChildrenDemo>
      <span>1</span>
      <div>
        <span>2</span>
        <span>3</span>
      </div>
    </ChildrenDemo>
  );
};
