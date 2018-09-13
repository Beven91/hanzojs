import { connect } from 'react-redux'
import { createAction } from 'redux-actions'
import { bindActionCreators } from 'redux'
import GlobalContext from './src/global'
import React from 'react';
import createHanzo from './src/mobile';

// CommonJS标准和ES6标准在组件的封装上是有差异的
//
// CommonJS规范：
// 所有要输出的对象统统挂载在 module.exports 上，然后暴露给外界
// 通过 require 加载别的模块，require 的返回值就是模块暴露的对象
// CommonJS 是一个单对象输出，单对象加载的模型
//
// 目前的浏览器几乎都不支持 ES6 的模块机制，所以我们要用 Babel 把 ES6 的模块机制转换成 CommonJS 的形式，
// 然后使用 Browserify 或者 Webpack 这样的打包工具把他们打包起来
//
// 给模块的输出对象增加 __esModule 是为了将不符合 Babel 要求的 CommonJS 模块转换成符合要求的模块，
// 这一点在 require 的时候体现出来。如果加载模块之后，发现加载的模块带着一个 __esModule 属性，
// Babel 就知道这个模块肯定是它转换过的，这样 Babel 就可以放心地从加载的模块中调用 exports.default 这个导出的对象，
// 也就是 ES6 规定的默认导出对象，所以这个模块既符合 CommonJS 标准，又符合 Babel 对 ES6 模块化的需求
// Object.defineProperty(exports, "__esModule", {
//   value: true
// });

module.exports = createHanzo(connect2);
module.exports.connect = connect2;
function connect2(state, model) {
  if (model && model.multiple) {
    return (a) => a;
  }
  const actionCreators = {}
  let _handlers = []
  let connector = null;
  if (model) {
    if (model.handlers && Array.isArray(model.handlers)) {
      _handlers = _handlers.concat(model.handlers)
    }
    if (model.publicHandlers && Array.isArray(model.publicHandlers)) {
      _handlers = _handlers.concat(model.publicHandlers)
    }
  }
  if (_handlers.length > 0) {
    _handlers.map((key) => {
      if (key.action) {
        if (key.validate) {
          actionCreators[key.name] = createAction(model.namespace + '/' + key.name, key.action, key.validate)
        } else {
          actionCreators[key.name] = createAction(model.namespace + '/' + key.name, key.action)
        }
      } else if (key.handler) {
        let globalHandler = GlobalContext.getHandler(key.handler)
        if (globalHandler) {
          if (key.validate) {
            actionCreators[key.name] = createAction(model.namespace + '/' + key.name, globalHandler, key.validate)
          } else {
            actionCreators[key.name] = createAction(model.namespace + '/' + key.name, globalHandler)
          }
        }
      } else {
        actionCreators[key] = createAction(model.namespace + '/' + key)
      }
    })
    const mapDispatchToProps = (dispatch) => bindActionCreators(actionCreators, dispatch)
    connector = connect(stateOn, mapDispatchToProps)
  } else {
    connector = connect(stateOn)
  }

  let isReset = false;

  function stateOn(stateData) {
    if (isReset) {
      isReset = false;
      initialState(stateData);
    }
    return state.apply(this, arguments);
  }

  function initialState(state) {
    const name = model.namespace.split('/').join('.');
    if (name in state) {
      return state[name] = model.state;
    }
    const calc = new Function('state,data', `state.${name} = data`);
    calc(state, model.state);
  }

  return function (Component) {
    const ConnectComponent = connector(Component)
    return class extends React.Component {
      constructor(props) {
        super(props);
        isReset = ConnectComponent.WrappedComponent.shouldResetRedux !== true;
      }
      static WrappedComponent = ConnectComponent.WrappedComponent;
      render() {
        return (<ConnectComponent {...this.props}></ConnectComponent>)
      }
    }
  }
}