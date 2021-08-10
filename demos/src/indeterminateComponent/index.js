import React, { useEffect } from "react";

export default function IndeterminateComponentDemo() {
  // useEffect(() => {
  //   console.log("useEffect invoked");
  //   return () => {
  //     console.log("useEffect cleanup");
  //   };
  // }, []);
  return {
    componentDidMount() {
      console.log("componentDidMount invoked");
    },
    render() {
      return <h2>IndeterminateComponentDemo</h2>;
    },
  };
}
