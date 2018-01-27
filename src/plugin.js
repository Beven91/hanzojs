import isPlainObject from 'is-plain-object';
import invariant from 'invariant';

class Plugin {

  constructor() {
    this.hooks = {
      dev: [],
      onAction: [],
      extraReducers: {},
    };
  }

  use(plugin) {
    invariant(isPlainObject(plugin), 'plugin.use: plugin should be plain object');
    const hooks = this.hooks;
    for (const key in plugin) {
      invariant(hooks[key], `plugin.use: unknown plugin property: ${key}`);
      if(Array.isArray(plugin[key])) {
        hooks[key].push(...plugin[key]);
      } else {
        hooks[key] = plugin[key];
      }
    }
  }

  get(key) {
    const hooks = this.hooks;
    return hooks[key];
  }
}

export default Plugin;
