import React, { version } from "react";
import { flushSync } from "react-dom";
import "./index.css";

console.log("React", version);

class Parent extends React.Component {
  state = {
    async: true,
    num: 1,
    length: 200,
  };

  componentDidMount() {
    this.interval = setInterval(() => {
      this.updateNum();
    }, 200);
  }

  componentWillUnmount() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  updateNum() {
    const newNum = this.state.num === 3 ? 0 : this.state.num + 1;

    if (this.state.async) {
      this.setState({ num: newNum });
    } else {
      console.log("flushSync......");
      flushSync(() => {
        this.setState({ num: newNum });
      });
    }
  }

  render() {
    const { length, num, async } = this.state;
    const children = [];

    console.log("render", async);

    for (let i = 0; i < length; i++) {
      children.push(
        <div className="item" key={i}>
          {num}
        </div>
      );
    }

    return (
      <div className="main">
        async:
        <input
          type="checkbox"
          value={async}
          onChange={() => flushSync(() => this.setState({ async: false }))}
        />
        <div className="wrapper">{children}</div>
      </div>
    );
  }
}

export default Parent;
