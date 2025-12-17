/**
 * 事件发射器
 * 用于任务间通信和事件管理
 */

class EventDispatcher {
  static instance = null;
  listeners = new Map();

  constructor() {}

  static getInstance() {
    if (!this.instance) {
      this.instance = new EventDispatcher();
    }
    return this.instance;
  }

  /**
   * 监听事件
   */
  on(eventName, listener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(listener);
  }

  /**
   * 取消监听
   */
  off(eventName, listener) {
    const listenerSet = this.listeners.get(eventName);
    if (!listenerSet) return;

    if (listener) {
      listenerSet.delete(listener);
    } else {
      listenerSet.clear();
    }
  }

  /**
   * 监听一次事件
   */
  once(eventName, listener) {
    const wrapper = (payload, event) => {
      listener(payload, event);
      this.off(event, wrapper);
    };
    this.on(eventName, wrapper);
  }

  /**
   * 触发事件
   */
  emit(eventName, payload) {
    const listenerSet = this.listeners.get(eventName);
    if (!listenerSet) return;

    for (const listener of listenerSet) {
      listener(payload, eventName);
    }
  }
}

const eventEmitter = EventDispatcher.getInstance();

module.exports = eventEmitter;
