# react-core

react 核心解析

> 本次分享源码版本react@16.6.0和@16.7.0

> 注：本此分享更多的是源码，概念性的东西读者可自行查阅官网文档或者 YouTube React Conference

## 代码结构

## JSX 到 JS

React.createElement, 入参 type, config, children，返回一个对象

## API 源码

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

### Context

两种使用方式，childContextType(即将在 react@17 版本中废弃), createContext

```js
// demos\src\context\index.js
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
```

再看看源码

```js
// packages\react\src\ReactElement.js
import { createContext } from "./ReactContext";

// packages\react\src\ReactContext.js
export function createContext<T>(
  defaultValue: T,
  calculateChangedBits: ?(a: T, b: T) => number
): ReactContext<T> {
  const context: ReactContext<T> = {
    $$typeof: REACT_CONTEXT_TYPE,
    // As a workaround to support multiple concurrent renderers, we categorize
    // some renderers as primary and others as secondary. We only expect
    // there to be two concurrent renderers at most: React Native (primary) and
    // Fabric (secondary); React DOM (primary) and React ART (secondary).
    // Secondary renderers store their context values on separate fields.
    // 两个变量值相同，是同的地方不同而已
    _currentValue: defaultValue,
    _currentValue2: defaultValue,
    // These are circular
    Provider: (null: any),
    Consumer: (null: any),
  };

  context.Provider = {
    $$typeof: REACT_PROVIDER_TYPE,
    _context: context,
  };

  // 又指向了自己，意味着Consumer还可以是Provider继续向下无限传递
  context.Consumer = context;

  return context;
}
```

### ConcurrentMode

之前是 AsyncMode
react@16 之后提出的一种优先级策略，它使得 react 的渲染是可以中断的, 从而可以操作渲染调度，最终让渲染更加流畅

案列可以参考 demo

```js
// packages\react\src\React.js
...
// unstable_ConcurrentMode只是一个Symbol
unstable_ConcurrentMode: REACT_CONCURRENT_MODE_TYPE,
...
```

### Suspense

> 参考：[React 的未来：与 Suspense 共舞](https://www.infoq.cn/article/sVaeA7Y3pei2sYy_lK9e)

- React Suspense 是组件从缓存中加载数据时暂停呈现的一种通行方法。它解决的问题：渲染是和 I/O 绑定时的情况。

- 支持 lazy, 此时 lazy 的组件会被 webpack 进行代码分割处理

```js
function MyComponent() {
  return (
    // 在包裹的异步组件全部加载完毕之后Spinner才消失
    <React.Suspense fallback={<Spinner />}>
      <LazyComponent />
      <LazyComponent2 />
    </React.Suspense>
  );
}
```

```js
// packages\react\src\React.js
...
// Suspense只是一个Symbol
Suspense: REACT_SUSPENSE_TYPE,
...

// packages\react\src\React.js
import {lazy} from './ReactLazy';

// packages\react\src\ReactLazy.js
// 是一个函数，接受一个thenable函数
export function lazy<T, R>(ctor: () => Thenable<T, R>): LazyComponent<T> {
  return {
    $$typeof: REACT_LAZY_TYPE,
    _ctor: ctor,
    // React uses these fields to store the result.
    _status: -1,
    _result: null,
  };
}
```

> Suspense 只是一个 Symbol

> 新的问题： 一个 Symbol 是如何承载元素的？

### Hook

> [Hook 简介](https://reactjs.org/docs/hooks-intro.html)

> react@16.7.0

```js
// packages\react\src\React.js
if (enableHooks) {
  React.useCallback = useCallback;
  React.useContext = useContext;
  React.useEffect = useEffect;
  React.useImperativeMethods = useImperativeMethods;
  React.useLayoutEffect = useLayoutEffect;
  React.useMemo = useMemo;
  React.useReducer = useReducer;
  React.useRef = useRef;
  React.useState = useState;
}

// packages\react\src\ReactHooks.js

export function useState<S>(initialState: (() => S) | S) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

export function useEffect(
  create: () => mixed,
  inputs: Array<mixed> | void | null
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, inputs);
}

// 这一步是在dom渲染的时候才拿到的
function resolveDispatcher() {
  const dispatcher = ReactCurrentOwner.currentDispatcher;
  return dispatcher;
}

// 渲染的时候从不同平台传进来的全局对象
const ReactCurrentOwner = {
  current: (null: null | Fiber),
  currentDispatcher: (null: null | Dispatcher),
};
```

> hooks 都挂载在 ReactCurrentOwner 全局对象上

> 新的问题： ReactCurrentOwner 是什么

### Children

```js
// packages\react\src\React.js
import { forEach, map, count, toArray, only } from "./ReactChildren";
const React = {
  Children: {
    map, // 和普通数组map区别在于最终结果是一维数组，不管你怎么嵌套
    forEach,
    count,
    toArray,
    only,
  },
  // ...
};

// packages\react\src\ReactChildren.js
function mapChildren(children, func, context) {
  if (children == null) {
    return children;
  }
  const result = [];
  mapIntoWithKeyPrefixInternal(children, result, null, func, context);
  return result;
}
```

mapChildren 的处理流程如下图：
![mapChildren](https://cdn.jsdelivr.net/gh/Matthrews/zm_cdn/images/mapChildren.png)

看懂流程图我们再深入源码

```js
// packages\react\src\ReactChildren.js
function mapIntoWithKeyPrefixInternal(children, array, prefix, func, context) {
  let escapedPrefix = "";
  if (prefix != null) {
    escapedPrefix = escapeUserProvidedKey(prefix) + "/";
  }
  const traverseContext = getPooledTraverseContext(
    array,
    escapedPrefix,
    func,
    context
  );
  traverseAllChildren(children, mapSingleChildIntoContext, traverseContext);
  releaseTraverseContext(traverseContext);
}

// mapSingleChildIntoContext
function mapSingleChildIntoContext(bookKeeping, child, childKey) {
  // bookKeeping就是从对象池里面取出来的traverseContext
  const { result, keyPrefix, func, context } = bookKeeping;

  let mappedChild = func.call(context, child, bookKeeping.count++);
  if (Array.isArray(mappedChild)) {
    // 外层递归，此时对象池的作用就体现出来了
    mapIntoWithKeyPrefixInternal(mappedChild, result, childKey, (c) => c);
  } else if (mappedChild != null) {
    if (isValidElement(mappedChild)) {
      // cloneAndReplaceKey
      mappedChild = cloneAndReplaceKey(
        mappedChild,
        // Keep both the (mapped) and old keys if they differ, just as
        // traverseAllChildren used to do for objects as children
        keyPrefix +
          (mappedChild.key && (!child || child.key !== mappedChild.key)
            ? escapeUserProvidedKey(mappedChild.key) + "/"
            : "") +
          childKey
      );
    }
    result.push(mappedChild);
  }
}

// traverseAllChildren
function traverseAllChildren(children, callback, traverseContext) {
  if (children == null) {
    return 0;
  }

  return traverseAllChildrenImpl(children, "", callback, traverseContext);
}

// traverseAllChildrenImpl
function traverseAllChildrenImpl(
  children,
  nameSoFar,
  callback,
  traverseContext
) {
  const type = typeof children;

  if (type === "undefined" || type === "boolean") {
    // All of the above are perceived as null.
    children = null;
  }

  let invokeCallback = false;

  if (children === null) {
    invokeCallback = true;
  } else {
    switch (type) {
      case "string":
      case "number":
        invokeCallback = true;
        break;
      case "object":
        switch (children.$$typeof) {
          case REACT_ELEMENT_TYPE:
          case REACT_PORTAL_TYPE:
            invokeCallback = true;
        }
    }
  }

  if (invokeCallback) {
    callback(
      traverseContext,
      children,
      // If it's the only child, treat the name as if it was wrapped in an array
      // so that it's consistent if the number of children grows.
      nameSoFar === "" ? SEPARATOR + getComponentKey(children, 0) : nameSoFar
    );
    return 1;
  }

  let child;
  let nextName;
  let subtreeCount = 0; // Count of children found in the current subtree.
  const nextNamePrefix =
    nameSoFar === "" ? SEPARATOR : nameSoFar + SUBSEPARATOR;

  if (Array.isArray(children)) {
    // 开始递归调用
    for (let i = 0; i < children.length; i++) {
      child = children[i];
      nextName = nextNamePrefix + getComponentKey(child, i);
      subtreeCount += traverseAllChildrenImpl(
        child,
        nextName,
        callback,
        traverseContext
      );
    }
  } else {
    const iteratorFn = getIteratorFn(children);
    if (typeof iteratorFn === "function") {
      const iterator = iteratorFn.call(children);
      let step;
      let ii = 0;
      while (!(step = iterator.next()).done) {
        child = step.value;
        nextName = nextNamePrefix + getComponentKey(child, ii++);
        subtreeCount += traverseAllChildrenImpl(
          child,
          nextName,
          callback,
          traverseContext
        );
      }
    }
  }

  return subtreeCount;
}

const POOL_SIZE = 10;
// 对象池
// mapFunction可能会频繁调用，对象频繁声明释放会很消耗内存，使用对象池保存对象引用，重复利用减少内存创建回收开销
// React合成事件系统中也用到了对象池进行性能优化
// 正常情况下对象池里面只有一个对象，但是如果像下面这样调用的时候对象池里面就不止一个了，真正的效果也就开始体现出来了
// React.Children.map(props.children, (c) => [c, [c, [c, c]]])  对象池里面有三个
const traverseContextPool = [];
// getPooledTraverseContext
function getPooledTraverseContext(
  mapResult,
  keyPrefix,
  mapFunction,
  mapContext
) {
  if (traverseContextPool.length) {
    const traverseContext = traverseContextPool.pop();
    traverseContext.result = mapResult;
    traverseContext.keyPrefix = keyPrefix;
    traverseContext.func = mapFunction;
    traverseContext.context = mapContext;
    traverseContext.count = 0;
    return traverseContext;
  } else {
    return {
      result: mapResult,
      keyPrefix: keyPrefix,
      func: mapFunction,
      context: mapContext,
      count: 0,
    };
  }
}

// releaseTraverseContext
function releaseTraverseContext(traverseContext) {
  traverseContext.result = null;
  traverseContext.keyPrefix = null;
  traverseContext.func = null;
  traverseContext.context = null;
  traverseContext.count = 0;
  if (traverseContextPool.length < POOL_SIZE) {
    traverseContextPool.push(traverseContext);
  }
}
```

> 两层递归，最终返回一维数组
> 学到一个优化： 对象池 pool

### 其他

- memo

- Fragment StrictMode

- cloneElement createFactory

### 总结

React 只是创建了一些 DOM 节点，以及一些 ref 等，并没有具体的操作，好像是一个空壳子，而 React-DOM 和 React-Native 才是具体实现
