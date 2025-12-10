interface PollingOptions {
  maxAttempts?: number;
  delay?: number;
  complete?: () => void;
}

export function createPollingFactory(options: PollingOptions = {}) {
  const { maxAttempts = 10, delay = 1000, complete } = options;

  return async function poll<T>(fn: (...args: any[]) => Promise<T>, ...args: any[]): Promise<T> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const result = await fn(...args);
        return result;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          if (complete) {
            complete();
          }
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error('Polling failed: max attempts reached');
  };
}

export function createSyncRequestPipeline() {
  let queue: Array<() => Promise<any>> = [];
  let processing = false;

  async function processQueue() {
    if (processing || queue.length === 0) return;
    processing = true;

    while (queue.length > 0) {
      const task = queue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          console.error('Pipeline task error:', error);
        }
      }
    }

    processing = false;
  }

  return function <T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      processQueue();
    });
  };
}

export function utilRandomWindowSizeCommand(): string {
  const widths = [1024, 1280, 1366, 1440, 1600, 1920];
  const heights = [768, 800, 900, 1024, 1080];
  const width = widths[Math.floor(Math.random() * widths.length)];
  const height = heights[Math.floor(Math.random() * heights.length)];
  return `--window-size=${width},${height}`;
}

export function utilSystemHealth() {
  const totalMemory = require('os').totalmem();
  const freeMemory = require('os').freemem();
  return {
    totalMemory: Math.round(totalMemory / (1024 * 1024)),
    freeMemory: Math.round(freeMemory / (1024 * 1024)),
  };
}
