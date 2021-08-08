# react-core

react 核心解析

> 本次分享源码版本react@16.6.0和@16.7.0

> 注：本此分享更多的是源码，概念性的东西读者可自行查阅官网文档或者 YouTube React Conference

## 代码结构

- packages/react

- packages/react-dom

- packages/react-reconciler

平台无关 DOM 操作，包括任务调度

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

> [案列 Demo](https://github.com/Matthrews/react-core/tree/main/demos)

<hr />

## 创建和更新

- ReactDOM.render/hydrate

- setState/replaceState[后者将会废弃]

- forceUpdate

### ReactDOM.render 步骤

- 创建 ReactRoot

- 创建 FiberRoot 和 RootFiber

- 创建 更新

> 创建完更新，进入调度换节，调度换节不接暂时不讲

```js
// packages\react-dom\src\client\ReactDOM.js
const ReactDOM = {
  createPortal,
  findDOMNode,
  // hydrate 是 React 中提供在初次渲染的时候，去复用原本已经存在的 DOM 节点，减少重新生成节点以及删除原本 DOM 节点的开销，来加速初次渲染的功能。
  // 主要使用场景是 服务端渲染或者像 prerender 等情况 。
  // 与render区别在于第四个参数
  hydrate(element: React$Node, container: DOMContainer, callback: ?Function) {
    // TODO: throw or warn if we couldn't hydrate?
    return legacyRenderSubtreeIntoContainer(
      null,
      element,
      container,
      true,
      callback
    );
  },
  render(
    element: React$Element<any>,
    container: DOMContainer,
    callback: ?Function
  ) {
    return legacyRenderSubtreeIntoContainer(
      null,
      element,
      container,
      false,
      callback
    );
  },

  unstable_renderSubtreeIntoContainer,
  unmountComponentAtNode,
  unstable_createPortal, // TODO: remove in React 17
  unstable_batchedUpdates: batchedUpdates,
  unstable_interactiveUpdates: interactiveUpdates,
  flushSync: flushSync,
  unstable_createRoot: createRoot,
  unstable_flushControlled: flushControlled,
};

export default ReactDOM;

// 先大致过一下render函数调用链

// packages\react-dom\src\client\ReactDOM.js
// ======================= //
// render
// legacyRenderSubtreeIntoContainer
//     return new ReactRoot(container, isConcurrent, shouldHydrate);
// ReactRoot
//     createContainer(container, isConcurrent, hydrate)
// ReactRoot.prototype.render = function(){...}
// ReactRoot.prototype.unmount = function(){...}
// ReactRoot.prototype.legacy_renderSubtreeIntoContainer = function(){...}
// ReactRoot.prototype.createBatch = function(){...}

// packages\react-reconciler\src\ReactFiberReconciler.js
// ======================= //
// createContainer
//     return createFiberRoot(containerInfo, isConcurrent, hydrate)

// packages\react-reconciler\src\ReactFiberRoot.js
// ======================= //
// createFiberRoot
//     return root // 此处root就是Fiber节点数据对象  暂时停下

// 再详细看下render函数
// packages\react-dom\src\client\ReactDOM.js
ReactRoot.prototype.render = function (
  children: ReactNodeList,
  callback: ?() => mixed
): Work {
  // ...
  updateContainer(children, root, null, work._onCommit);
  return work;
};

// packages\react-reconciler\src\ReactFiberReconciler.js
export function updateContainer(
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent: ?React$Component<any, any>,
  callback: ?Function
): ExpirationTime {
  const current = container.current;
  const currentTime = requestCurrentTime();
  const expirationTime = computeExpirationForFiber(currentTime, current);
  return updateContainerAtExpirationTime(
    element,
    container,
    parentComponent,
    expirationTime,
    callback
  );
}

export function updateContainerAtExpirationTime(
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent: ?React$Component<any, any>,
  expirationTime: ExpirationTime,
  callback: ?Function
) {
  // ...
  return scheduleRootUpdate(current, element, expirationTime, callback);
}

function scheduleRootUpdate(
  current: Fiber,
  element: ReactNodeList,
  expirationTime: ExpirationTime,
  callback: ?Function
) {
  const update = createUpdate(expirationTime);
  flushPassiveEffects();
  enqueueUpdate(current, update);
  scheduleWork(current, expirationTime);
  return expirationTime;
}
```

> 流程有点复杂,暂时先把流程记录下来

> 新的问题： hydrate 如何复用已有 DOM 节点？

### FiberRoot

- 整个应用的起点

- 包含挂载的节点

- 记录应用更新过程中的各种信息

```js
// packages\react-reconciler\src\ReactFiberRoot.js
export function createFiberRoot(
  containerInfo: any,
  isConcurrent: boolean,
  hydrate: boolean
): FiberRoot {
  // Cyclic construction. This cheats the type system right now because
  // stateNode is any.
  const uninitializedFiber = createHostRootFiber(isConcurrent);

  let root = ({
      // The currently active root fiber. This is the mutable root of the tree.
      // 当前应用对应的Fiber对象，是Root Fiber
      // 关于Fiber下节分享
      current: uninitializedFiber,
      // Any additional information from the host associated with this root.
      // root节点，render方法接受的第二个参数
      containerInfo: containerInfo,
      // Used only by persistent updates.
      // 只有在持久更新中会用到，也就是不支持增量更新的平台，react-dom不会用到
      pendingChildren: null,

      // Suspend和lazy相关
      pingCache: null,

      // The earliest and latest priority levels that are not known to be suspended.
      // 标记最新和最老的不确定是否会挂起的任务
      earliestPendingTime: NoWork,
      latestPendingTime: NoWork,
      // The following priority levels are used to distinguish between 1)
      // uncommitted work, 2) uncommitted work that is suspended, and 3) uncommitted
      // work that may be unsuspended. We choose not to track each individual
      // pending level, trading granularity for performance.
      // The earliest and latest priority levels that are suspended from committing.
      // 标记最新和最老的在提交时候被挂起的任务
      earliestSuspendedTime: NoWork,
      latestSuspendedTime: NoWork,
      // The latest priority level that was pinged by a resolved promise and can be retried.
      // 标记最新的通过一个promise被resolve并且可以重新尝试的优先级任务
      latestPingedTime: NoWork,

      // If an error is thrown, and there are no more updates in the queue, we try
      // rendering from the root one more time, synchronously, before handling
      // the error.
      // 如果有错误并且没有更多的更新存在，我们尝试在处理错误前同步重新从头渲染
      // 在rednerRoot出现无法处理的错误的时候会被设置为true
      didError: false,

      // 标记正在等待提交的任务
      pendingCommitExpirationTime: NoWork,
      // A finished work-in-progress HostRoot that's ready to be committed.
      // 已经完成的任务的FiberRoot对象，如果你只有一个Root，那它永远只可能是这个Root对下个的Fiber或者是null
      // 在commit阶段只会处理这个值对应的任务
      finishedWork: null,
      // 在任务被挂起的时候通过setTimeout设置的返回内容，用来下一次如果有新的任务挂起时清理还没触发的timeout
      // Timeout handle returned by setTimeout. Used to cancel a pending timeout, if
      // it's superseded by a new one.
      timeoutHandle: noTimeout,
      // Top context object, used by renderSubtreeIntoContainer
      // 顶层context对象，只有主动调用`renderSubtreeIntoContainer`时才会有用
      context: null,
      pendingContext: null,
      // Determines if we should attempt to hydrate on the initial mount
      // 用来确定第一次渲染的时候是否需要融合
      hydrate,
      // Remaining expiration time on this root.
      // TODO: Lift this into the renderer
      // 当前root上剩余的过期时间
      nextExpirationTimeToWorkOn: NoWork,
      // 当前更新对应的过期时间
      expirationTime: NoWork,
      // List of top-level batches. This list indicates whether a commit should be
      // deferred. Also contains completion callbacks.
      // TODO: Lift this into the renderer
      // 顶层批次（批处理任务？）这个变量指明一个commit是否应该被推迟, 同时包括完成之后的回调
      firstBatch: null,
      // Linked-list of roots
      // root之间关联的链表结构
      nextScheduledRoot: null,
  }

  // FiberRoot ==> current ==> RootFiber
  // RootFiber ==> stateNode  ==> FiberRoot
  uninitializedFiber.stateNode = root;

  return root;
}
```

### Fiber

- 每一个 ReactElement 对应一个 Fiber 对象

- 记录节点的各种状态

- 串联整个应用性成数结构

```js
// packages\react-reconciler\src\ReactFiber.js
export function createHostRootFiber(isConcurrent: boolean): Fiber {
  let mode = isConcurrent ? ConcurrentMode | StrictMode : NoContext;

  if (enableProfilerTimer && isDevToolsPresent) {
    // Always collect profile timings when DevTools are present.
    // This enables DevTools to start capturing timing at any point–
    // Without some nodes in the tree having empty base times.
    mode |= ProfileMode;
  }

  return createFiber(HostRoot, null, null, mode);
}

// This is a constructor function, rather than a POJO constructor, still
// please ensure we do the following:
// 1) Nobody should add any instance methods on this. Instance methods can be
//    more difficult to predict when they get optimized and they are almost
//    never inlined properly in static compilers.
// 2) Nobody should rely on `instanceof Fiber` for type testing. We should
//    always know when it is a fiber.
// 3) We might want to experiment with using numeric keys since they are easier
//    to optimize in a non-JIT environment.
// 4) We can easily go from a constructor to a createFiber object literal if that
//    is faster.
// 5) It should be easy to port this to a C struct and keep a C implementation
//    compatible.
const createFiber = function (
  tag: WorkTag,
  pendingProps: mixed,
  key: null | string,
  mode: TypeOfMode
): Fiber {
  // $FlowFixMe: the shapes are exact here but Flow doesn't like constructors
  return new FiberNode(tag, pendingProps, key, mode);
};

// A Fiber is work on a Component that needs to be done or was done. There can
// be more than one per component.
// Fiber对应一个组件需要被处理或者已经处理了，一个组件可以有一个或者多个Fiber
export type Fiber = {|
  // These first fields are conceptually members of an Instance. This used to
  // be split into a separate type and intersected with the other Fiber fields,
  // but until Flow fixes its intersection bugs, we've merged them into a
  // single type.

  // An Instance is shared between all versions of a component. We can easily
  // break this out into a separate object to avoid copying so much to the
  // alternate versions of the tree. We put this on a single object for now to
  // minimize the number of objects created during the initial render.

  // Tag identifying the type of fiber.
  // 标记不同的组件类型
  tag: WorkTag,

  // Unique identifier of this child.
  // ReactElement里面的key
  key: null | string,

  // The value of element.type which is used to preserve the identity during
  // reconciliation of this child.
  // ReactElement.type，也就是我们调用`createElement`的第一个参数
  elementType: any,

  // The resolved function/class/ associated with this fiber.
  // 异步组件resolved之后返回的内容，一般是`function`或者`class`
  type: any,

  // The local state associated with this fiber.
  // 跟当前Fiber相关本地状态（比如浏览器环境就是DOM节点）
  stateNode: any,

  // Conceptual aliases
  // parent : Instance -> return The parent happens to be the same as the
  // return fiber since we've merged the fiber and instance.

  // Remaining fields belong to Fiber

  // The Fiber to return to after finishing processing this one.
  // This is effectively the parent, but there can be multiple parents (two)
  // so this is only the parent of the thing we're currently processing.
  // It is conceptually the same as the return address of a stack frame.
  // 指向他在Fiber节点树中的`parent`，用来在处理完这个节点之后向上返回
  return: Fiber | null,

  // Singly Linked List Tree Structure.
  // 单链表树结构
  // 指向自己的第一个子节点
  child: Fiber | null,
  // 指向自己的兄弟结构
  // 兄弟节点的return指向同一个父节点
  // 所以我们会发现父节点不是指向所有子节点，而是指向第一个子结点，然后子结点之间通过sibling串联，并且所有子节点都通过return指向父节点
  sibling: Fiber | null,
  index: number,

  // The ref last used to attach this node.
  // I'll avoid adding an owner field for prod and model that as functions.
  // ref属性
  ref: null | (((handle: mixed) => void) & { _stringRef: ?string }) | RefObject,

  // Input is the data coming into process this fiber. Arguments. Props.
  // 新的变动带来的新的props
  pendingProps: any, // This type will be more specific once we overload the tag.
  // 上一次渲染完成之后的props
  memoizedProps: any, // The props used to create the output.

  // A queue of state updates and callbacks.
  // 该Fiber对应的组件产生的Update会存放在这个队列里面
  updateQueue: UpdateQueue<any> | null,

  // The state used to create the output
  // 上一次渲染的时候的state
  memoizedState: any,

  // A linked-list of contexts that this fiber depends on
  // 一个列表，存放这个Fiber依赖的context
  firstContextDependency: ContextDependency<mixed> | null,

  // Bitfield that describes properties about the fiber and its subtree. E.g.
  // the ConcurrentMode flag indicates whether the subtree should be async-by-
  // default. When a fiber is created, it inherits the mode of its
  // parent. Additional flags can be set at creation time, but after that the
  // value should remain unchanged throughout the fiber's lifetime, particularly
  // before its child fibers are created.
  // 用来描述当前Fiber和他子树的`Bitfield`
  // 共存的模式表示这个子树是否默认是异步渲染的
  // Fiber被创建的时候他会继承父Fiber
  // 其他的标识也可以在创建的时候被设置
  // 但是在创建之后不应该再被修改，特别是他的子Fiber创建之前
  mode: TypeOfMode,

  // Effect
  // 用来记录Side Effect
  effectTag: SideEffectTag,

  // Singly linked list fast path to the next fiber with side-effects.
  // 单链表用来快速查找下一个side effect
  nextEffect: Fiber | null,

  // The first and last fiber with side-effect within this subtree. This allows
  // us to reuse a slice of the linked list when we reuse the work done within
  // this fiber.
  // 子树中第一个side effect
  firstEffect: Fiber | null,
  // 子树中最后一个side effect
  lastEffect: Fiber | null,

  // Represents a time in the future by which this work should be completed.
  // Does not include work found in its subtree.
  // 代表任务在未来的哪个时间点应该被完成
  // 不包括他的子树产生的任务
  expirationTime: ExpirationTime,

  // This is used to quickly determine if a subtree has no pending changes.
  // 快速确定子树中是否有不在等待的变化
  childExpirationTime: ExpirationTime,

  // This is a pooled version of a Fiber. Every fiber that gets updated will
  // eventually have a pair. There are cases when we can clean up pairs to save
  // memory if we need to.
  // 在Fiber树更新的过程中，每个Fiber都会有一个跟其对应的Fiber
  // 我们称他为`current <==> workInProgress`
  // 在渲染完成之后他们会交换位置
  alternate: Fiber | null,

  // 下面是调试相关的，收集每个Fiber和子树渲染时间的

  // Time spent rendering this Fiber and its descendants for the current update.
  // This tells us how well the tree makes use of sCU for memoization.
  // It is reset to 0 each time we render and only updated when we don't bailout.
  // This field is only set when the enableProfilerTimer flag is enabled.
  actualDuration?: number,

  // If the Fiber is currently active in the "render" phase,
  // This marks the time at which the work began.
  // This field is only set when the enableProfilerTimer flag is enabled.
  actualStartTime?: number,

  // Duration of the most recent render time for this Fiber.
  // This value is not updated when we bailout for memoization purposes.
  // This field is only set when the enableProfilerTimer flag is enabled.
  selfBaseDuration?: number,

  // Sum of base times for all descedents of this Fiber.
  // This value bubbles up during the "complete" phase.
  // This field is only set when the enableProfilerTimer flag is enabled.
  treeBaseDuration?: number,

  // Conceptual aliases
  // workInProgress : Fiber ->  alternate The alternate used for reuse happens
  // to be the same as work in progress.
  // __DEV__ only
  _debugID?: number,
  _debugSource?: Source | null,
  _debugOwner?: Fiber | null,
  _debugIsCurrentlyTiming?: boolean,
|};
```

### Update & UpdateQueue

- 用于记录组件状态的改变

- 存放于 UpdateQueue 里面

- 多个 Update 可以同时共存

```js
// packages\react-reconciler\src\ReactUpdateQueue.js

export type Update<State> = {
  // 更新的过期时间
  expirationTime: ExpirationTime,

  // export const UpdateState = 0;
  // export const ReplaceState = 1;
  // export const ForceUpdate = 2;
  // export const CaptureUpdate = 3;
  // 指定更新的类型，值为以上几种
  tag: 0 | 1 | 2 | 3,
  // 更新内容，比如`setState`接收的第一个参数
  payload: any,
  // 对应的回调，`setState`，`render`都有
  callback: (() => mixed) | null,

  // 指向下一个更新
  next: Update<State> | null,
  // 指向下一个`side effect`
  nextEffect: Update<State> | null,
};

export type UpdateQueue<State> = {
  // 每一次操作完更新之后的`state`
  baseState: State,

  // 队列中的第一个`Update`
  firstUpdate: Update<State> | null,
  // 队列中的最后一个`Update`
  lastUpdate: Update<State> | null,

  // 第一个捕获类型的`Update`
  firstCapturedUpdate: Update<State> | null,
  // 最后一个捕获类型的`Update`
  lastCapturedUpdate: Update<State> | null,

  // 第一个`side effect`
  firstEffect: Update<State> | null,
  // 最后一个`side effect`
  lastEffect: Update<State> | null,

  // 第一个和最后一个捕获产生的`side effect`
  firstCapturedEffect: Update<State> | null,
  lastCapturedEffect: Update<State> | null,
};

export function createUpdate(expirationTime: ExpirationTime): Update<*> {
  return {
    expirationTime: expirationTime,

    tag: 0 | 1 | 2 | 3,

    payload: null,
    callback: null,

    next: null,
    nextEffect: null,
  };
}

export function createUpdateQueue<State>(baseState: State): UpdateQueue<State> {
  const queue: UpdateQueue<State> = {
    baseState,
    firstUpdate: null,
    lastUpdate: null,
    firstCapturedUpdate: null,
    lastCapturedUpdate: null,
    firstEffect: null,
    lastEffect: null,
    firstCapturedEffect: null,
    lastCapturedEffect: null,
  };
  return queue;
}

function cloneUpdateQueue<State>(
  currentQueue: UpdateQueue<State>
): UpdateQueue<State> {
  const queue: UpdateQueue<State> = {
    baseState: currentQueue.baseState,
    firstUpdate: currentQueue.firstUpdate,
    lastUpdate: currentQueue.lastUpdate,

    // TODO: With resuming, if we bail out and resuse the child tree, we should
    // keep these effects.
    firstCapturedUpdate: null,
    lastCapturedUpdate: null,

    firstEffect: null,
    lastEffect: null,

    firstCapturedEffect: null,
    lastCapturedEffect: null,
  };
  return queue;
}

function appendUpdateToQueue<State>(
  queue: UpdateQueue<State>,
  update: Update<State>
) {
  // Append the update to the end of the list.
  if (queue.lastUpdate === null) {
    // Queue is empty
    queue.firstUpdate = queue.lastUpdate = update;
  } else {
    queue.lastUpdate.next = update;
    queue.lastUpdate = update;
  }
}

export function enqueueUpdate<State>(fiber: Fiber, update: Update<State>) {
  // Update queues are created lazily.
  const alternate = fiber.alternate;
  let queue1;
  let queue2;
  if (alternate === null) {
    // There's only one fiber.
    queue1 = fiber.updateQueue;
    queue2 = null;
    if (queue1 === null) {
      queue1 = fiber.updateQueue = createUpdateQueue(fiber.memoizedState);
    }
  } else {
    // There are two owners.
    queue1 = fiber.updateQueue;
    queue2 = alternate.updateQueue;
    if (queue1 === null) {
      if (queue2 === null) {
        // Neither fiber has an update queue. Create new ones.
        queue1 = fiber.updateQueue = createUpdateQueue(fiber.memoizedState);
        queue2 = alternate.updateQueue = createUpdateQueue(
          alternate.memoizedState
        );
      } else {
        // Only one fiber has an update queue. Clone to create a new one.
        queue1 = fiber.updateQueue = cloneUpdateQueue(queue2);
      }
    } else {
      if (queue2 === null) {
        // Only one fiber has an update queue. Clone to create a new one.
        queue2 = alternate.updateQueue = cloneUpdateQueue(queue1);
      } else {
        // Both owners have an update queue.
      }
    }
  }
  if (queue2 === null || queue1 === queue2) {
    // There's only a single queue.
    appendUpdateToQueue(queue1, update);
  } else {
    // There are two queues. We need to append the update to both queues,
    // while accounting for the persistent structure of the list — we don't
    // want the same update to be added multiple times.
    if (queue1.lastUpdate === null || queue2.lastUpdate === null) {
      // One of the queues is not empty. We must add the update to both queues.
      appendUpdateToQueue(queue1, update);
      appendUpdateToQueue(queue2, update);
    } else {
      // Both queues are non-empty. The last update is the same in both lists,
      // because of structural sharing. So, only append to one of the lists.
      appendUpdateToQueue(queue1, update);
      // But we still need to update the `lastUpdate` pointer of queue2.
      queue2.lastUpdate = update;
    }
  }
}
```

### expirationTime

```js
// packages\react-reconciler\src\ReactFiberScheduler.js
// computeExpirationForFiber
//    computeInteractiveExpiration

// packages\react-reconciler\src\ReactFiberExpirationTime.js
// computeInteractiveExpiration

// 最终计算公式：((((currentTime - 2 + 5000 / 10) / 25) | 0) + 1) * 25
```

### 不同类型的 expirationTime

- Sync 模式，优先级最高

- Asnyc/Concurrent 模式

- 指定 context 模式

```js
// packages\react-reconciler\src\ReactFiberScheduler.js
function computeExpirationForFiber(currentTime: ExpirationTime, fiber: Fiber) {
  let expirationTime;
  if (expirationContext !== NoWork) {
    // An explicit expiration context was set;
    expirationTime = expirationContext;
  } else if (isWorking) {
    if (isCommitting) {
      // Updates that occur during the commit phase should have sync priority
      // by default.
      expirationTime = Sync;
    } else {
      // Updates during the render phase should expire at the same time as
      // the work that is being rendered.
      expirationTime = nextRenderExpirationTime;
    }
  } else {
    // No explicit expiration context was set, and we're not currently
    // performing work. Calculate a new expiration time.
    if (fiber.mode & ConcurrentMode) {
      // 往往是事件onClick等
      if (isBatchingInteractiveUpdates) {
        // This is an interactive update
        expirationTime = computeInteractiveExpiration(currentTime);
      } else {
        // This is an async update
        expirationTime = computeAsyncExpiration(currentTime);
      }
      // If we're in the middle of rendering a tree, do not update at the same
      // expiration time that is already rendering.
      if (nextRoot !== null && expirationTime === nextRenderExpirationTime) {
        expirationTime -= 1;
      }
    } else {
      // This is a sync update
      expirationTime = Sync;
    }
  }
  if (isBatchingInteractiveUpdates) {
    // This is an interactive update. Keep track of the lowest pending
    // interactive expiration time. This allows us to synchronously flush
    // all interactive updates when needed.
    if (
      lowestPriorityPendingInteractiveExpirationTime === NoWork ||
      expirationTime < lowestPriorityPendingInteractiveExpirationTime
    ) {
      lowestPriorityPendingInteractiveExpirationTime = expirationTime;
    }
  }
  return expirationTime;
}

// packages\react-reconciler\src\ReactTypeOfMode.js

export type TypeOfMode = number;

export const NoContext = 0b000;
export const ConcurrentMode = 0b001;
export const StrictMode = 0b010;
export const ProfileMode = 0b100;
// fiber.mode & ConcurrentMode表示fiber.mode中是否包含ConcurrentMode
// 使用二进制便于组合，可参考：https://blog.csdn.net/zl544434558/article/details/79252751
// 关于位运算的性只，可参考：https://www.jianshu.com/p/7faf7c22c146
// fiber.mode |= ConcurrentMode  添加类型ConcurrentMode
// fiber.mode ^ ConcurrentMode  提出类型ConcurrentMode
```

### setState/forceUpdate

- 给节点的`Fiber`创建更新

- 更新类型不同

```js
// packages\react\src\ReactBaseClasses.js
Component.prototype.setState = function (partialState, callback) {
  this.updater.enqueueSetState(this, partialState, callback, "setState");
};

Component.prototype.forceUpdate = function (callback) {
  this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
};

// packages\react-reconciler\src\ReactFiberClassComponent.js
const classComponentUpdater = {
  isMounted,
  // 可以看到和updateContainer方法流程是一样的
  enqueueSetState(inst, payload, callback) {
    const fiber = getInstance(inst);
    const currentTime = requestCurrentTime();
    const expirationTime = computeExpirationForFiber(currentTime, fiber);

    const update = createUpdate(expirationTime);
    update.payload = payload;
    if (callback !== undefined && callback !== null) {
      update.callback = callback;
    }

    flushPassiveEffects();
    enqueueUpdate(fiber, update);
    scheduleWork(fiber, expirationTime);
  },
  // 和enqueueSetState唯一的差别就在类型上update.tag
  enqueueForceUpdate(inst, callback) {
    const fiber = getInstance(inst);
    const currentTime = requestCurrentTime();
    const expirationTime = computeExpirationForFiber(currentTime, fiber);

    const update = createUpdate(expirationTime);
    // enqueueForceUpdate标记类型是ForceUpdate
    // export const UpdateState = 0;
    // export const ReplaceState = 1;
    // export const ForceUpdate = 2;
    // export const CaptureUpdate = 3;
    update.tag = ForceUpdate;

    if (callback !== undefined && callback !== null) {
      update.callback = callback;
    }

    flushPassiveEffects();
    enqueueUpdate(fiber, update);
    scheduleWork(fiber, expirationTime);
  },
};
```

## fiber-conciler

基于`Fiber`，给任务区分不同优先级，以更好地控制渲染

### FiberReconciler 总体流程

- TODO 流程图

### scheduleWork

- 找到更新对应的`FiberRoot`节点

- 如果符合条件重置`stack`

- 如果符合条件就请求工作调度

```js
// packages\react-reconciler\src\ReactFiberScheduler.js
function scheduleWork(fiber: Fiber, expirationTime: ExpirationTime) {
  // 获取FiberRoot
  const root = scheduleWorkToRoot(fiber, expirationTime);
  if (root === null) {
    return;
  }

  if (
    !isWorking &&
    nextRenderExpirationTime !== NoWork &&
    expirationTime > nextRenderExpirationTime
  ) {
    // This is an interruption. (Used for performance tracking.)
    interruptedBy = fiber;
    // 中断，优先执行高优先级渲染
    resetStack();
  }
  markPendingPriorityLevel(root, expirationTime);
  if (
    // If we're in the render phase, we don't need to schedule this root
    // for an update, because we'll do it before we exit...
    !isWorking ||
    isCommitting ||
    // ...unless this is a different root than the one we're rendering.
    nextRoot !== root
  ) {
    const rootExpirationTime = root.expirationTime;
    requestWork(root, rootExpirationTime);
  }
  if (nestedUpdateCount > NESTED_UPDATE_LIMIT) {
    // Reset this back to zero so subsequent updates don't throw.
    nestedUpdateCount = 0;
  }
}

function resetStack() {
  if (nextUnitOfWork !== null) {
    let interruptedWork = nextUnitOfWork.return;
    while (interruptedWork !== null) {
      // undo setState
      unwindInterruptedWork(interruptedWork);
      interruptedWork = interruptedWork.return;
    }
  }

  nextRoot = null;
  nextRenderExpirationTime = NoWork;
  nextLatestAbsoluteTimeoutMs = -1;
  nextRenderDidError = false;
  nextUnitOfWork = null;
}

// 遍历找到FiberRoot
// 并对Fiber的return和alternate的expirationTime做处理
function scheduleWorkToRoot(fiber: Fiber, expirationTime): FiberRoot | null {
  // Update the source fiber's expiration time
  if (fiber.expirationTime < expirationTime) {
    fiber.expirationTime = expirationTime;
  }
  let alternate = fiber.alternate;
  if (alternate !== null && alternate.expirationTime < expirationTime) {
    alternate.expirationTime = expirationTime;
  }
  // Walk the parent path to the root and update the child expiration time.
  let node = fiber.return;
  let root = null;
  if (node === null && fiber.tag === HostRoot) {
    root = fiber.stateNode;
  } else {
    while (node !== null) {
      alternate = node.alternate;
      if (node.childExpirationTime < expirationTime) {
        node.childExpirationTime = expirationTime;
        if (
          alternate !== null &&
          alternate.childExpirationTime < expirationTime
        ) {
          alternate.childExpirationTime = expirationTime;
        }
      } else if (
        alternate !== null &&
        alternate.childExpirationTime < expirationTime
      ) {
        alternate.childExpirationTime = expirationTime;
      }
      if (node.return === null && node.tag === HostRoot) {
        root = node.stateNode;
        break;
      }
      node = node.return;
    }
  }

  return root;
}
```

### requestWork

```js
// requestWork is called by the scheduler whenever a root receives an update.
// It's up to the renderer to call renderRoot at some point in the future.
function requestWork(root: FiberRoot, expirationTime: ExpirationTime) {
  addRootToSchedule(root, expirationTime);
  if (isRendering) {
    // Prevent reentrancy. Remaining work will be scheduled at the end of
    // the currently rendering batch.
    return;
  }

  // 批处理 重要
  if (isBatchingUpdates) {
    // Flush work at the end of the batch.
    if (isUnbatchingUpdates) {
      // ...unless we're inside unbatchedUpdates, in which case we should
      // flush it now.
      nextFlushedRoot = root;
      nextFlushedExpirationTime = Sync;
      performWorkOnRoot(root, Sync, false);
    }
    return;
  }

  // 开始进入调度
  // TODO: Get rid of Sync and use current time?
  if (expirationTime === Sync) {
    performSyncWork();
  } else {
    scheduleCallbackWithExpirationTime(root, expirationTime);
  }
}

function addRootToSchedule(root: FiberRoot, expirationTime: ExpirationTime) {
  // Add the root to the schedule.
  // Check if this root is already part of the schedule.
  if (root.nextScheduledRoot === null) {
    // This root is not already scheduled. Add it.
    root.expirationTime = expirationTime;
    if (lastScheduledRoot === null) {
      firstScheduledRoot = lastScheduledRoot = root;
      root.nextScheduledRoot = root;
    } else {
      lastScheduledRoot.nextScheduledRoot = root;
      lastScheduledRoot = root;
      lastScheduledRoot.nextScheduledRoot = firstScheduledRoot;
    }
  } else {
    // This root is already scheduled, but its priority may have increased.
    const remainingExpirationTime = root.expirationTime;
    if (expirationTime > remainingExpirationTime) {
      // Update the priority.
      root.expirationTime = expirationTime;
    }
  }
}
```

问题：performSyncWork 和 scheduleCallbackWithExpirationTime 有什么区别？

### batchedUpdates

先看下案例演示 `demos/batchedUpdates`

```js
// packages\react-reconciler\src\ReactFiberScheduler.js
// TODO: Batching should be implemented at the renderer level, not inside
// the reconciler.
function batchedUpdates<A, R>(fn: (a: A) => R, a: A): R {
  const previousIsBatchingUpdates = isBatchingUpdates;
  isBatchingUpdates = true;
  try {
    return fn(a);
  } finally {
    isBatchingUpdates = previousIsBatchingUpdates;
    if (!isBatchingUpdates && !isRendering) {
      performSyncWork();
    }
  }
}
```

问题：setState 是同步的还是异步的？

setState 方法本身调用是同步的，但是调用了 setState 并不标志着 state 立马更新，这个更新过程取决于当前执行环境的上下文，如果处于 batchedUpdates 状态，那 state 不是立马更新的。反之有可能是立马更新的

比如，flushSync 是立马更新的，而 ConcurrentMode 不是立马更新的

### scheduler

- 维护时间片

- 模拟 requestIdleCallback

- 调度列表和超时判断

```js
// packages\react-reconciler\src\ReactFiberScheduler.js
import {
  now,
  scheduleDeferredCallback,
  cancelDeferredCallback,
  shouldYield,
  prepareForCommit,
  resetAfterCommit,
  scheduleTimeout,
  cancelTimeout,
  noTimeout,
} from "./ReactFiberHostConfig";
function scheduleCallbackWithExpirationTime(
  root: FiberRoot,
  expirationTime: ExpirationTime
) {
  if (callbackExpirationTime !== NoWork) {
    // A callback is already scheduled. Check its expiration time (timeout).
    if (expirationTime < callbackExpirationTime) {
      // Existing callback has sufficient timeout. Exit.
      return;
    } else {
      if (callbackID !== null) {
        // Existing callback has insufficient timeout. Cancel and schedule a
        // new one.
        cancelDeferredCallback(callbackID);
      }
    }
    // The request callback timer is already running. Don't start a new one.
  } else {
    startRequestCallbackTimer();
  }

  callbackExpirationTime = expirationTime;
  const currentMs = now() - originalStartTimeMs;
  const expirationTimeMs = expirationTimeToMs(expirationTime);
  const timeout = expirationTimeMs - currentMs;
  callbackID = scheduleDeferredCallback(performAsyncWork, { timeout });
}

// packages\react-dom\src\client\ReactDOMHostConfig.js
export {
  unstable_now as now,
  unstable_scheduleCallback as scheduleDeferredCallback,
  unstable_shouldYield as shouldYield,
  unstable_cancelCallback as cancelDeferredCallback,
} from "scheduler";

// packages\scheduler\src\Scheduler.js
export {
  ImmediatePriority as unstable_ImmediatePriority,
  UserBlockingPriority as unstable_UserBlockingPriority,
  NormalPriority as unstable_NormalPriority,
  IdlePriority as unstable_IdlePriority,
  LowPriority as unstable_LowPriority,
  unstable_runWithPriority,
  unstable_scheduleCallback,
  unstable_cancelCallback,
  unstable_wrapCallback,
  unstable_getCurrentPriorityLevel,
  unstable_shouldYield,
  unstable_continueExecution,
  unstable_pauseExecution,
  unstable_getFirstCallbackNode,
  getCurrentTime as unstable_now,
};

function unstable_scheduleCallback(callback, deprecated_options) {
  var startTime =
    currentEventStartTime !== -1 ? currentEventStartTime : getCurrentTime();

  var expirationTime;
  if (
    typeof deprecated_options === "object" &&
    deprecated_options !== null &&
    typeof deprecated_options.timeout === "number"
  ) {
    // FIXME: Remove this branch once we lift expiration times out of React.
    expirationTime = startTime + deprecated_options.timeout;
  } else {
    switch (currentPriorityLevel) {
      case ImmediatePriority:
        expirationTime = startTime + IMMEDIATE_PRIORITY_TIMEOUT;
        break;
      case UserBlockingPriority:
        expirationTime = startTime + USER_BLOCKING_PRIORITY;
        break;
      case IdlePriority:
        expirationTime = startTime + IDLE_PRIORITY;
        break;
      case LowPriority:
        expirationTime = startTime + LOW_PRIORITY_TIMEOUT;
        break;
      case NormalPriority:
      default:
        expirationTime = startTime + NORMAL_PRIORITY_TIMEOUT;
    }
  }

  var newNode = {
    callback,
    priorityLevel: currentPriorityLevel,
    expirationTime,
    next: null,
    previous: null,
  };

  // Insert the new callback into the list, ordered first by expiration, then
  // by insertion. So the new callback is inserted any other callback with
  // equal expiration.
  if (firstCallbackNode === null) {
    // This is the first callback in the list.
    firstCallbackNode = newNode.next = newNode.previous = newNode;
    ensureHostCallbackIsScheduled();
  } else {
    var next = null;
    var node = firstCallbackNode;
    do {
      if (node.expirationTime > expirationTime) {
        // The new callback expires before this one.
        next = node;
        break;
      }
      node = node.next;
    } while (node !== firstCallbackNode);

    if (next === null) {
      // No callback with a later expiration was found, which means the new
      // callback has the latest expiration in the list.
      next = firstCallbackNode;
    } else if (next === firstCallbackNode) {
      // The new callback has the earliest expiration in the entire list.
      firstCallbackNode = newNode;
      ensureHostCallbackIsScheduled();
    }

    var previous = next.previous;
    previous.next = next.previous = newNode;
    newNode.next = next;
    newNode.previous = previous;
  }

  return newNode;
}

function unstable_cancelCallback(callbackNode) {
  var next = callbackNode.next;
  if (next === null) {
    // Already cancelled.
    return;
  }

  if (next === callbackNode) {
    // This is the only scheduled callback. Clear the list.
    firstCallbackNode = null;
  } else {
    // Remove the callback from its position in the list.
    if (callbackNode === firstCallbackNode) {
      firstCallbackNode = next;
    }
    var previous = callbackNode.previous;
    previous.next = next;
    next.previous = previous;
  }

  callbackNode.next = callbackNode.previous = null;
}

// getCurrentTime
var hasNativePerformanceNow =
  typeof performance === "object" && typeof performance.now === "function";
if (hasNativePerformanceNow) {
  var Performance = performance;
  getCurrentTime = function () {
    return Performance.now();
  };
} else {
  getCurrentTime = function () {
    return localDate.now();
  };
}
```
