class Global {

  constructor() {
    this.handlers = {};
  }

  registerHandler(key, handler) {
    this.handlers[key] = handler
  }

  getHandler(key) {
    return this.handlers[key];
  }
}

const GlobalContext = new Global()

export default GlobalContext;