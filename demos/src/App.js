import ForwardRefDemo from "./forward-ref";
import ContextDemo from "./context";
import ConcurrentDemo from "./concurrent-mode";
import "./App.css";
import React from "react";

class App extends React.Component {
  state = {
    identifier: "forward-ref",
  };
  renderBody = (identifier) => {
    switch (identifier) {
      case "forward-ref":
        return <ForwardRefDemo />;
      case "context":
        return <ContextDemo />;
      case "concurrent":
        return <ConcurrentDemo />;
      default:
        return "Not Found";
    }
  };
  handleURLChange = () => {
    console.log("handleURLChange", window.location.hash.slice(1));
    this.setState({ identifier: window.location.hash.slice(1) });
  };
  componentDidMount() {
    window.addEventListener("popstate", this.handleURLChange);
  }

  componentWillUnmount() {
    window.removeEventListener("popstate", this.handleURLChange);
  }
  render() {
    const { identifier } = this.state;
    return (
      <div className="App">
        <header className="App-header">
          <p>
            <a href="#forward-ref"> ForwardRef Demo </a>
          </p>
          <p>
            <a href="#context"> Context Demo </a>
          </p>
          <p>
            <a href="#concurrent"> ConcurrentMode Demo </a>
          </p>
        </header>
        <section className="App-body">{this.renderBody(identifier)}</section>
      </div>
    );
  }
}

export default App;
