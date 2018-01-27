# hanzojs-follower

- fork from [hanzojs](https://github.com/hanzojs)

- 借鉴[dva.js](https://github.com/dvajs/dva)，在dva.js的基础上去掉以及定制了一些功能，用于redux和react框架的集成，目标是将繁琐的redux开发尽量简化，易于上手
- 支持react-native，react，以及同构react，一个为实现三端融合开发的基础框架
- 基于redux，redux-actions，react-navigation等

## 安装
---
    npm install hanzojs --save

## Get Started
---
1. 创建一个hanzojs实例

```
import Hanzo from 'hanzojs/mobile' // for react-native and server-render react
or
import Hanzo from 'hanzojs' // for react pc

const app = new Hanzo()
```

2. 注册模块

```
app.registerModule(require('./modules/a'))
app.registerModule(require('./modules/b'))
...
```

3. 添加redux中间件

```
app.use({
  onAction: [
    promiseMiddleware({
      promiseTypeSuffixes: ['Loading', 'Success', 'Error'],
    }),
    thunkMiddleware,
  ]
})
```

4. 配置路由

```
app.router(require('./routes.js'))
```

5. 启动app

```
app.start() // for react-native and server-render react
or
app.start('#node') // for react pc
```

## API
---
### 创建实例
创建一个react-native hanzoApp

```
import Hanzo from 'hanzojs/mobile' 
const app = new Hanzo()
```

创建一个react pc hanzoApp

```
import Hanzo from 'hanzojs' 
const app = new Hanzo()
```

创建一个react server render hanzoApp

```
import Hanzo from 'hanzojs/mobile' 
const app = new Hanzo({ isomorphic: true })
```

---
### APP.USE
app.use接受一个配置对象，目前支持dev(调试模式)，onAction(redux中间件)，extraReducers(额外的reducer)
#### Example:

```
app.use({
  dev: devTools({
    name: Platform.OS,
    hostname: 'localhost',
    port: 5678,
  }),
  onAction: [
    dot,
    Validator(),
    promiseMiddleware({
        promiseTypeSuffixes: ['Loading', 'Success', 'Error'],
    }),
    thunkMiddleware,
  ],
  extraReducers: { ...states },
})
```

---
### 路由配置
hanzojs最新版本的路由采用的是react-navigation，具体使用方式和react-navigation一致，api参见[react-navigation](https://reactnavigation.org)，1.x以下版本采用的是[react-native-router-flux](https://github.com/aksonov/react-native-router-flux)的路由风格
#### Example:

```
import { StackNavigator } from 'hanzojs/router'

module.exports = (modules) => StackNavigator({
    React: {
      path:'react',
      screen: StackNavigator({
        Register: {
          screen: modules.UserRegister,
          path: 'register',
          navigationOptions: {
            title: '欢迎注册'
          }
        },
        Login: {
          screen: modules.UserLogin,
          path: '',
          navigationOptions: {
            title: '欢迎登陆'
          }
        }
      })
    }
  })
```

---
### hanzojs模块结构
一个标准的hanzojs模块结构由views目录，index.js，model.js，action.js组成。其中：
- views目录存放UI界面
- model.js存放redux相关的内容
- action.js存放接口层相关的方法
- index.js为模块入口文件，主要是connect，暴露出模块给hanzo注册

#### index.js
负责将整个模块暴露给hanzojs，将view层和reducer，initialState，以及view层所需的调用的方法通过connect绑定到一起。一个稍微复杂的todolist的示例：

```
import { connect } from 'hanzojs'
import model from './model'

module.exports = {
  models: model,
  views: {
    TodoApp: connect((state) => {
      return {
        ...state.todoApp,
        todos: state.todoApp.todos.filter(todo => {
          if (state.todoApp.filter === VisibilityFilters.ALL) {
            return true;
          } else if (state.todoApp.filter === VisibilityFilters.COMPLETED) {
            return todo.completed;
          } else if (state.todoApp.filter === VisibilityFilters.INCOMPLETE) {
            return !todo.completed;
          }
        })
      }
    }, model)(require('./views/index.js'))
  }
}
```

module.exports暴露一个JS模块，这个模块包含两个必须的属性，一个是*models*，一个是*views*。models一般只接受model.js导出的model就可以了，views接受一个或若干个使用connect处理过的view，键值对存放。

connect接受两个参数，一个是类似redux中常使用的mapStateToProps，一个是model，主要功能类似于mapDispatchToProps

#### model.js
一个标准的model.js的写法如下：

```
module.exports = {
  namespace: '',
  state: {
  },
  handlers: [
  ],
  reducers: {
  },
}
```

- namespace 命名空间，该模块下所有的redux dispatch出的事件会自动加namespace前缀。reducer接受的事件也会默认加上该namespace前缀。同时，namespace也对应了redux state tree中state所处的部分，支持层级结构，例如：namespace: 'a/b/c'
- state 相当于redux中的 initialState
- handlers的底层实现使用的是redux-actions，三种用法：

```
handlers: [
  'justAString',
  { name: 'handlerName', action: 'handlerActionFromActionJS' },
  { name: 'handlerName2', handler: 'handlerFromAnotherModule' }
]
```

第一种顾名思义，直接接受一个字符串，将所传入的参数直接dispatch出去

第二种接受一个action属性，代表这个handler具体的实现（例如和后台交互等），具体的实现一般放在action.js

第三种接受一个handler属性，一个字符串，代表跨模块调用其他模块的方法。例如要调用A模块下的b方法，handler直接写'A.b'

- reducers也是基于redux-actions，由键值对组成。键为事件名称，和handler里的方法名一一对应，值就是一个reducer处理函数。有两点需要注意：
  1. 如果有redux中间件的集成，事件名称和handler名称有可能不见得是一一对应关系。比如引入了redux-promise-middleware中间件，那么事件名称需要在handler名称后面加上相应的异步状态后缀
  2. 如果需要处理一些跨模块的事件或者全局事件，事件需要以 / 作为前缀
一个完整的todolist的model的示例如下：

```
import _ from 'lodash';
import { VisibilityFilters } from './enums'
import { addTodo } from './action'

module.exports = {
  namespace: 'todoApp',
  state: {
    todos: [],
    filter: VisibilityFilters.ALL,
    addModal: {
      visible: false
    }
  },
  handlers: [
    'showAll',
    'showCompleted',
    'showIncomplete',
    'showModal',
    'hideModal',
    { name: 'addTodo', action: addTodo },
    'completeTodo',
    'incompleteTodo',
  ],
  reducers: {
    showModal: (state, action) => ({
      ...state,
      addModal: {
        visible: true
      }
    }),
    hideModal: (state, action) => ({
      ...state,
      addModal: {
        visible: false
      }
    }),
    showAll: (state, action) => ({
      ...state,
      filter: VisibilityFilters.ALL,
    }),
    showCompleted: (state, action) => ({
      ...state,
      filter: VisibilityFilters.COMPLETED,
    }),
    showIncomplete: (state, action) => ({
      ...state,
      filter: VisibilityFilters.INCOMPLETE,
    }),
    addTodo: (state, action) => ({
      ...state,
      todos: [
        ...state.todos,
        action.payload
      ]
    }),
    completeTodo: (state, action) => {
      var index = _.findIndex(state.todos, (todo) => todo.id === action.payload);
      if (index === -1) {
        return {
          ...state
        }
      }
      return {
        ...state,
        todos:[
          ...state.todos.slice(0, index),
          Object.assign({}, state.todos[index], {
            completed: true
          }),
          ...state.todos.slice(index + 1)
        ]
      };
    },
    incompleteTodo: (state, action) => {
      var index = _.findIndex(state.todos, (todo) => todo.id === action.payload);
      if (index === -1) {
        return {
          ...state
        }
      }
      return {
        ...state,
        todos: [
          ...state.todos.slice(0, index),
          Object.assign({}, state.todos[index], {
            completed: false
          }),
          ...state.todos.slice(index + 1)
        ]
      };
    },
  }
}
```

## DEMO
- [todoListHanzojs](http://git.lsfash.cn/react-native/todoListHanzojs)

## 其他学习
- [redux](http://cn.redux.js.org/)
- [redux-actions](https://github.com/acdlite/redux-actions)
- [react-navigation](https://reactnavigation.org)

## 开源许可
基于 [MIT License](http://zh.wikipedia.org/wiki/MIT_License) 开源，使用代码只需说明来源，或者引用 [license.txt](https://github.com/sofish/typo.css/blob/master/license.txt) 即可。
