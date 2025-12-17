/**
 * Task Queue Management
 * 批量任务队列管理 - 用于处理并发任务和请求限流
 */

/**
 * 创建同步请求管道
 * 确保请求按顺序执行，避免并发冲突
 * 
 * @returns {Function} 添加任务到队列的函数
 */
function createSyncRequestPipeline() {
  const queue = [];
  let busy = false;

  /**
   * 为任务添加超时控制
   * @param {Promise} task - 任务Promise
   * @param {number} ms - 超时时间（毫秒）
   * @returns {Promise} 带超时的Promise
   */
  const withTimeout = (task, ms) => Promise.race([
    task,
    new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时')), ms))
  ]);

  /**
   * 执行单个任务
   * @param {Function} task - 任务函数
   * @param {number} timeoutMs - 超时时间
   * @param {Function} resolve - 成功回调
   * @param {Function} reject - 失败回调
   */
  async function runTask(task, timeoutMs, resolve, reject) {
    try {
      const result = await withTimeout(task(), timeoutMs);
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      busy = false;
      processQueue();
    }
  }

  /**
   * 处理队列中的下一个任务
   */
  function processQueue() {
    if (busy || queue.length === 0) return;
    
    busy = true;
    const next = queue.shift();
    next();
  }

  /**
   * 添加任务到队列
   * @param {Function} task - 任务函数
   * @param {number} timeoutMs - 超时时间（默认60秒）
   * @returns {Promise} 任务结果Promise
   */
  function addTask(task, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      queue.push(() => runTask(task, timeoutMs, resolve, reject));
      processQueue();
    });
  }

  return addTask;
}

/**
 * 同步POST请求工具
 * 用于发送JSON格式的POST请求
 * 
 * @param {string} url - 请求URL
 * @param {Object} options - 请求选项（会被JSON.stringify）
 * @returns {Promise<Object>} 响应JSON数据
 */
async function utilSyncPostFetch(url, options) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(options && { body: JSON.stringify(options) })
    });
    return response.json();
  } catch (err) {
    throw new Error(err.message);
  }
}

module.exports = {
  createSyncRequestPipeline,
  utilSyncPostFetch
};
