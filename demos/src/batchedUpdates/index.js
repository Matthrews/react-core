import React from "react";
import { unstable_batchedUpdates as batchedUpdates } from "react-dom";

export default class BatchedDemo extends React.Component {
  state = {
    number: 0,
  };

  handlClick = () => {
    // 这也是我们预期的
    // setTimeout会脱离当前上下文
    // setTimeout(() => {
    //   this.countNumber();
    // }, 0);

    // 手动`batchedUpdates`
    // setTimeout(() => {
    //   batchedUpdates(() => this.countNumber());
    // }, 0);

    // 事件处理函数自带`batchedUpdates`
    // React算是事件系统的一个优化
    this.countNumber();
  };

  countNumber = () => {
    const num = this.state.number;

    this.setState({ number: num + 1 });
    console.log(this.state.number);

    this.setState({ number: num + 2 });
    console.log(this.state.number);

    this.setState({ number: num + 3 });
    console.log(this.state.number);
  };

  render() {
    return <button onClick={this.handlClick}>Num: {this.state.number}</button>;
  }
}
