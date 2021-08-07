import React from "react";
import PropTypes from "prop-types";

const { Provider, Consumer } = React.createContext();

class Parent extends React.Component {
  state = {
    childContext: "123",
    newContext: "456",
  };

  getChildContext() {
    return { value: this.state.childContext };
  }

  render() {
    return (
      <>
        <div>
          <label>childContext: </label>
          <input
            type="text"
            value={this.state.childContext}
            onChange={(e) => this.setState({ childContext: e.target.value })}
          />

          <br />
          <br />
          <label>newContext: </label>
          <input
            type="text"
            value={this.state.newContext}
            onChange={(e) => this.setState({ newContext: e.target.value })}
          />

          <Provider value={this.state.newContext}>
            {this.props.children}
          </Provider>
        </div>
      </>
    );
  }
}

function Child1() {
  return <Consumer>{(value) => <p>newContext: {value}</p>}</Consumer>;
}

class Child2 extends React.Component {
  render() {
    return <p>childContext: {this.context.value}</p>;
  }
}

// 务必申明，否则拿不到
Child2.contextTypes = {
  value: PropTypes.string,
};
// 务必申明，否则报错
Parent.childContextTypes = {
  value: PropTypes.string,
};

const Demo = () => {
  return (
    <Parent>
      <Child1 />
      <Child2 />
    </Parent>
  );
};

export default Demo;
