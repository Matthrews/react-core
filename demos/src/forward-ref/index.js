import React from "react";

// 这样是接受不道的，这个函数组件是不会有实例的
// 如果是class组件，那么传给的也是wrapper组件，这显然违背了开发者意愿
// const TargetCom = () => {
//   return <input type="text" />;
// };

// 使用forwardRef转发
const TargetCom = React.forwardRef((props, ref) => {
  return <input type="text" {...props} ref={ref} />;
});

export default class Com extends React.Component {
  constructor(params) {
    super();
    this.ref = React.createRef();
  }

  componentDidMount() {
    this.ref.current.value = "通过ref给子元素赋值";
  }

  render() {
    return <TargetCom ref={this.ref} />;
  }
}
