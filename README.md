# react-core

react 核心解析

> react@16.6.0

## 代码结构

## JSX 到 JS

React.createElement, 入参 type, config, children，返回一个对象

## API

```js
// packages\react\src\React.js
// 暴露出来的API
const React = {
  Children: {
    map,
    forEach,
    count,
    toArray,
    only,
  },

  createRef,
  Component,
  PureComponent,

  createContext,
  forwardRef,
  lazy,
  memo,

  Fragment: REACT_FRAGMENT_TYPE,
  StrictMode: REACT_STRICT_MODE_TYPE,
  unstable_ConcurrentMode: REACT_CONCURRENT_MODE_TYPE,
  Suspense: REACT_SUSPENSE_TYPE,
  unstable_Profiler: REACT_PROFILER_TYPE,

  createElement: __DEV__ ? createElementWithValidation : createElement,
  cloneElement: __DEV__ ? cloneElementWithValidation : cloneElement,
  createFactory: __DEV__ ? createFactoryWithValidation : createFactory,
  isValidElement: isValidElement,

  version: ReactVersion,
};

export default React;
```

### React Element

- React Element 是什么？

```js
// packages\react\src\ReactElement.js
/**
 * Create and return a new ReactElement of the given type.
 * See https://reactjs.org/docs/react-api.html#createelement
 * type 类型  原生标签的话是一个字符串，自定义组件的话是一个变量
 * config 节点attributes
 */
export function createElement(type, config, children) {
  let propName;

  // Reserved names are extracted
  const props = {};

  let key = null;
  let ref = null;
  let self = null;
  let source = null;

  // 解析上述四个字段以及props属性
  // for/in
  if (config != null) {
    if (hasValidRef(config)) {
      ref = config.ref;
    }
    if (hasValidKey(config)) {
      key = "" + config.key;
    }

    self = config.__self === undefined ? null : config.__self;
    source = config.__source === undefined ? null : config.__source;
    // Remaining properties are added to a new props object
    for (propName in config) {
      if (
        hasOwnProperty.call(config, propName) &&
        !RESERVED_PROPS.hasOwnProperty(propName)
      ) {
        props[propName] = config[propName];
      }
    }
  }

  /**
   * https://babeljs.io/repl
   * const jsx = 
  <div key="435ksdfds" class="wrapper">
    <span>matthew</span>
    <span>green</span>
  </div> 
   * 转换为js就是
   * const jsx = React.createElement(
    "div",
    {
        key: "435ksdfds",
        class: "wrapper"
    },
    React.createElement("span", null, "matthew"),
    React.createElement("span", null, "green")
    );
   * 可以看到children从三个参数开始
   */
  // 找到props的children属性，children可能是对象也可能是数组
  const childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    const childArray = Array(childrenLength);
    for (let i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    props.children = childArray;
  }

  // Resolve default props
  // 这里只有Class组件才会走到，因为原生标签type就是一个字符串
  // 判断有没有使用的是undefined
  if (type && type.defaultProps) {
    const defaultProps = type.defaultProps;
    for (propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
  }
  return ReactElement(
    type,
    key,
    ref,
    self,
    source,
    ReactCurrentOwner.current, // 当前Fiber节点, 后面解析
    props
  );
}

// packages\react\src\ReactElement.js
/**
 * Factory method to create a new React element.
 * 不是通过class模式创建的，所以不要使用new
 * 也不要用instanceOf检测类型，而因该通过Symbol.for('react.element')检测类型
 *
 * ReactElement返回一个对象
 * 这也是VDOM diff的对象
 */
const ReactElement = function (type, key, ref, self, source, owner, props) {
  const element = {
    // 通过Symbol唯一确定是否是React Element
    // 同时兼具安全的功能
    // Symbol参考：https://www.jianshu.com/p/f6e0972b24d0
    $$typeof: REACT_ELEMENT_TYPE,

    // Built-in properties that belong on the element
    type: type,
    key: key,
    ref: ref,
    props: props,

    // Record the component responsible for creating this element.
    _owner: owner, // 父Fiber节点
  };

  return element;
};

// packages\shared\ReactSymbols.js
// 如果没有Symbol就使用一个简单的字符
const hasSymbol = typeof Symbol === "function" && Symbol.for;

export const REACT_ELEMENT_TYPE = hasSymbol
  ? Symbol.for("react.element")
  : 0xeac7;
```

> React Element 只是一个普通的 JavaScript 对象，用来告诉 React 怎么创建真实的 DOM

> 新的疑问： 1. $$typeof 如何使用的 2. type, key, ref,owner 如何使用的

### React Component

- 什么是 React Component？和 React Element 有啥不一样？

- 猜测组件应该是 React Element 的集合，也就是返回一个大对象，应该还提供一些方法用于更新卸载捕获异常吧

```js
// packages\react\src\ReactElement.js
import { Component, PureComponent } from "./ReactBaseClasses";

// packages\react\src\ReactBaseClasses.js
// 更新Component state 的基类
function Component(props, context, updater) {
  this.props = props;
  // read from getInitialState
  // 可用于跨层级通信
  this.context = context;
  // If a component has string refs, we will assign a different object later.
  this.refs = emptyObject;
  // We initialize the default updater but the real one gets injected by the
  // renderer.
  this.updater = updater || ReactNoopUpdateQueue;
}

Component.prototype.isReactComponent = {};

/**
 * this.state是不可变的，想要修改需要手动调用setState修改
 * this.state 不一定是立即更新的
 * setState 不一定是同步的，因为有可能有批处理环节
 * 如果有callback，它将会再setState完成后调用
 * @param {object|function} partialState Next partial state or function to
 * produce next partial state to be merged with current state.
 * @param {?function} callback Called after state is updated.
 */
Component.prototype.setState = function (partialState, callback) {
  this.updater.enqueueSetState(this, partialState, callback, "setState");
};

/**
 * 默认情况下，当组件的 state 或 props 发生变化时，组件将重新渲染。
 * 如果 render 方法依赖于其他数据，则可以调用 forceUpdate 强制让组件重新渲染
 * 不会调用 shouldComponentUpdate，但会调用 componentWillUpdate 和 componentDidUpdate
 */
Component.prototype.forceUpdate = function (callback) {
  this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
};

/**
 * 含有默认浅比较的Component
 */
function PureComponent(props, context, updater) {
  this.props = props;
  this.context = context;
  this.refs = emptyObject;
  this.updater = updater || ReactNoopUpdateQueue;
}

const pureComponentPrototype = (PureComponent.prototype = new ComponentDummy());
pureComponentPrototype.constructor = PureComponent;
Object.assign(pureComponentPrototype, Component.prototype);
// 看起来和Component就只有下面这点区别了
pureComponentPrototype.isPureReactComponent = true;
```

> Component 是一个基类，提供了 setState 和 forceUpdate 两个方法

> 新的疑问： setState 和 forceUpdate 貌似进了 enqueueSetState 队列之类的东西，后面发生了什么

### ReactRef & ref

用于获取 DOM 实例，应该尽量避免过多使用

有三种使用姿势: `stringRef, function ref, React.createRef`

[Forwarding Refs](https://reactjs.org/docs/forwarding-refs.html)

```js
// 举例使用ref
class MyComponent extends React.Component {
  constructor(props) {
    super(props);
    this.objRef = React.createRef();
  }

  componentDidMount() {
    // 获取
    // this.refs.stringRef
    // this.methodRef
    // this.myRef.current
  }
  render() {
    return (
      <>
        <p ref="stringRef"></p>
        <p ref={(obj) => (this.methodRef = obj)}></p>
        <p ref={this.objRef}></p>
      </>
    );
  }
}
```

```js
// packages\react\src\ReactCreateRef.js
// 看了源码的发现就返回了这么一个简单对象
export function createRef(): RefObject {
  const refObject = {
    current: null,
  };
  return refObject;
}
```

> 新问题：Component 和 createRef 中 ref 后续是如何使用的
