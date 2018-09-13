import isPlainObject from 'is-plain-object';
import React, { Component } from 'react'
import { createStore, applyMiddleware, compose, combineReducers } from 'redux'
import { addNavigationHelpers, StackNavigator } from 'react-navigation';
import { Provider, connect } from 'react-redux'
import { handleAction, handleActions } from 'redux-actions'
import deepmerge from 'deepmerge'
import Plugin from './plugin';
import GlobalContext from './global'

export default function createHanzo(createOpts) {
  const {
    mobile,
    initialReducer,
    defaultHistory,
    routerMiddleware,
    setupHistory,
  } = createOpts;

  /**
   * hanzo instance
   */
  return function hanzo(hooks = {}) {
    // router for pc
    // browserHistory, hashHistory, etc
    const history = hooks.history || defaultHistory;
    const initialState = hooks.initialState || {};
    delete hooks.history;
    delete hooks.initialState;

    const plugin = new Plugin();

    const app = {
      // properties
      _models: [],
      _reducers: {},
      _views: {},
      _router: null,
      _routerProps: {},
      _routes: null,
      _store: null,
      _history: null,
      _isomorphic: hooks.isomorphic || false, // server-render options

      // methods
      use,                   // add redux-middlewares, extra-reducers, etc
      registerModule,        // register a module
      router,                // config router
      start,                 // start hanzo instance
      getStore,              // get redux store
      getRoutes,             // get router config
      getModule,             // get the register module
    };

    return app

    /***********************************
    /* Methods
    /***********************************

    /**
     * Register an object of hooks on the application.
     * @param hooks
     */
    function use(hooks) {
      plugin.use(hooks);
    }

    /**
     * Register a module
     * @param module
     * 
     * registerModule(require('./moduleA')) => sync-load module A
     * registerModule((callback, name) => callback(require('./moduleA'), ['moduleA'])) => async-load module A
     */
    function registerModule(module, refresh) {
      let me = this
      if (isPlainObject(module) && module.models.multiple) {
        registerMultiple.call(me, module)
      } else if (isPlainObject(module)) {
        loadModule.call(me, module)
      } else if (typeof module === 'function') {
        module((callback, name) => {
          if (typeof callback === 'function') {
            lazyload.call(me, callback, name)
          } else if (isPlainObject(callback)) {
            loadModule.call(me, callback)
          }
        })
      }
      if (refresh) {
        this._store.replaceReducer(getReducer.call(this))
      }
    }

    function registerMultiple(module, resolve, item) {
      const views = module.views || [];
      const me = this;
      const holder = {
        models: {
          namespace: module.models.namespace,
          state: {},
          reducers: {
          },
        },
        views: {
        }
      }
      Object.keys(views).forEach((view) => {
        holder.views[view] = MultipleView(me, view, views[view], module)
      })
      loadModule.call(this, holder, resolve, item)
    }

    function MultipleView(me, viewName, OView, module) {
      const models = module.models;
      let identifer = 0;
      return class MultiConnect extends React.Component {
        constructor(props) {
          super(props);
          const id = identifer++;
          const model = {
            namespace: `${models.namespace}_${id}`,
            handlers: [...models.handlers],
            state: {
              ...(models.state || {})
            },
            reducers: {
              ...(models.reducers || {})
            }
          }
          const views = {}
          this.View = views[`${viewName}-${id}`] = createOpts.connect((state) => ({ ...state[model.namespace] }), model)(OView);
          registerModule.call(me, {
            models: model,
            views: views
          }, true);
        }

        render() {
          const View = this.View;
          return (
            <View {...this.props} />
          );
        }
      }
    }

    function getModule(name) {
      return this._views[name]
    }

    /**
     * load views and reducers
     * if view.lazy is true, means it's a async-load view
     * use react-actions to register reducers
     */
    function loadModule(module, resolve, item) {
      this._models.push(module.models)

      Object.keys(module.views).map((view) => {
        if (this._views[view] && this._views[view].lazy && view === item) {
          resolve(module.views[view])
        }
      })

      this._views = {
        ...this._views,
        ...module.views
      }

      if (isPlainObject(module.models)) {
        let Actions = {}
        let namespace = module.models.namespace.replace(/\/$/g, ''); // events should be have the namespace prefix
        Object.keys(module.models.reducers).map((key) => {
          if (key.startsWith('/')) { // starts with '/' means global events
            Actions[key.substr(1)] = module.models.reducers[key];
          } else {
            Actions[namespace + '/' + key] = module.models.reducers[key];
          }
        })
        let _temp = handleActions(Actions, module.models.state)
        let _arr = namespace.split('/')
        _mergeReducers(this._reducers, _arr, _temp)
      }

      if (module.publicHandlers && Array.isArray(module.publicHandlers)) {
        module.publicHandlers.map((item) => {
          GlobalContext.registerHandler(namespace.replace(/\//g, '.') + '.' + item.name, item.action)
        })
      }
    }

    /**
     * private method
     * merge reducers by hierachy
     * user/login, user/info -> user:{ login, info }
     */
    function _mergeReducers(obj, arr, res) {
      if (arr.length > 1) {
        let hierachy = arr.splice(0, 1)[0]
        obj[hierachy] = obj[hierachy] || {}
        _mergeReducers(obj[hierachy], arr, res)
      } else {
        obj[arr[0]] = res || {}
      }
    }

    /**
     * lazy-load views
     * the reducers should be re-generate and the store should be update 
     */
    function lazyload(callback, name) {
      let me = this
      name.map((item) => {
        this._views[item] = () => {
          return new Promise((resolve, reject) => {
            if (this._views[item].lazy) {
              callback((module) => {
                if (module.models.multiple) {
                  registerMultiple.call(me, module, resolve, item)
                } else {
                  loadModule.call(me, module, resolve, item)
                }
                this._store.replaceReducer(getReducer.call(this))
              })
            } else {
              resolve(this._views[item])
            }
          })
        }
        this._views[item].lazy = true
      })
    }

    function router(router, props) {
      this._router = router(this._views)
      this._routerProps = props || {}
    }

    /**
    * create the reducers
    */
    function getReducer() {
      // extra reducers
      const extraReducers = plugin.get('extraReducers');

      const mergeReducers = deepmerge.all([this._reducers, extraReducers])
      for (let k in mergeReducers) {
        if (typeof mergeReducers[k] === 'object') {
          mergeReducers[k] = combineReducers(mergeReducers[k])
        }
      }

      const navInitialState = this._router.router.getStateForAction(
        this._router.router.getActionForPathAndParams(this._router.initialRouteName)
      );

      const navReducer = (state = navInitialState, action) => {
        const nextState = this._router.router.getStateForAction(action, state);

        // Simply return the original `state` if `nextState` is null or undefined.
        return nextState || state;
      };

      const appReducer = combineReducers({
        nav: navReducer,
        ...initialReducer,
        ...mergeReducers,
      });
      return appReducer
    }

    /**
     * create the redux-store
     */
    function getStore() {
      let middlewares = plugin.get('onAction');

      if (!mobile) {
        middlewares.push(routerMiddleware(history))
      }

      let enhancer = applyMiddleware(...middlewares)
      if (typeof __DEV__ !== 'undefined' && __DEV__) { // dev mode
        const devTools = plugin.get('dev') || ((noop) => noop)
        if (devTools.apply) {
          enhancer = compose(
            applyMiddleware(...middlewares),
            devTools
          )
        }
      }

      const createAppStore = enhancer(createStore);

      this._store = Object.assign(this._store || {}, createAppStore(getReducer.call(this), initialState));
      return this._store
    }

    function getRoutes() {
      return this._routes
    }

    /**
     * start the whole hanzo instance
     * return React.Component
     */
    function start(container) {
      if (typeof container === 'string') {
        container = document.querySelector(container);
      }
      // setup history
      if (setupHistory) setupHistory.call(this, history);

      if (mobile) {
        const me = this
        const AppNavigator = me._router; // react-navigation
        let store = getStore.call(me)
        const isomorphic = me._isomorphic
        const App = ({ dispatch, nav }) => (
          <AppNavigator navigation={addNavigationHelpers({ dispatch, state: nav })} />
        );
        const mapStateToProps = state => ({
          nav: state.nav,
        });

        const AppWithNavigationState = connect(mapStateToProps)(App);

        return class extends Component {
          render() {
            isomorphic ? store = getStore.call(me) : null
            return (
              <Provider store={store}>
                <AppWithNavigationState />
              </Provider>
            )
          }
        }
      }
    }
  }
}
