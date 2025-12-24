/**
 * 清理操作类 - 负责浏览器和容器的清理和资源释放
 */

const BaseOperations = require('./BaseOperations');

class CleanupOperations extends BaseOperations {
  /**
   * 关闭并停止浏览器
   * 处理页面、浏览器、HubStudio容器的完整清理流程
   */
  async closeAndStopBrowser(config = {}) {
    const { 
      deleteContainer = false, 
      reason = null,
      page = this.page,
      browser = null,
      hubstudio = null,
      containerCode = null
    } = config;
    
    try {
      if (reason) {
        this.tasklog({ message: `执行统一清理（${reason}）`, logID: 'Cleanup' });
      }

      // 1. 关闭 page
      try {
        if (page && typeof page.isClosed === 'function' && !page.isClosed()) {
          await page.close();
          this.tasklog({ message: '页面已关闭', logID: 'Cleanup' });
        }
      } catch (e) {
        console.warn('[清理] 关闭页面失败:', e && e.message ? e.message : e);
      }

      // 2. 关闭 browser
      let browserClosedForCleanup = false;
      try {
        if (browser) {
          try { 
            await browser.close(); 
            this.tasklog({ message: '浏览器已关闭', logID: 'Cleanup' }); 
            browserClosedForCleanup = true; 
          } catch (e) { 
            console.warn('[清理] 关闭browser失败:', e && e.message ? e.message : e); 
          }
        }
      } catch (e) {}

      // 3. 停止 hubstudio 浏览器
      try {
        if (hubstudio && containerCode && typeof hubstudio.stopBrowser === 'function') {
          // 诊断：获取浏览器状态
          try {
            const statusRes = await hubstudio.getBrowserStatus([containerCode]);
            this.tasklog({ message: `HubStudio getBrowserStatus: ${JSON.stringify(statusRes)}`, logID: 'Cleanup' });
          } catch (statusErr) {
            this.tasklog({ 
              message: `HubStudio getBrowserStatus 失败: ${statusErr && statusErr.message ? statusErr.message : statusErr}`, 
              logID: 'Cleanup' 
            });
          }

          // 如果已成功关闭本地browser，通常无需调用 hubstudio.stopBrowser
          if (browserClosedForCleanup) {
            this.tasklog({ 
              message: `本地browser已关闭，跳过 HubStudio stopBrowser 调用: ${containerCode}`, 
              logID: 'Cleanup' 
            });
          } else {
            try {
              await hubstudio.stopBrowser(containerCode);
              this.tasklog({ message: 'HubStudio 浏览器已停止', logID: 'Cleanup' });
            } catch (stopErr) {
              const msg = stopErr && stopErr.message ? stopErr.message : String(stopErr);
              if (msg.includes('-10004') || msg.includes('未找到环境信息') || msg.includes('Environment information not found')) {
                this.tasklog({ 
                  message: `HubStudio stopBrowser 返回环境不存在 (${containerCode}): ${msg}`, 
                  logID: 'Cleanup' 
                });
              } else {
                console.warn('[清理] stopBrowser失败:', msg);
              }
            }
          }
        }
      } catch (e) {}

      // 4. 按需删除容器
      if (deleteContainer && hubstudio && containerCode) {
        await this._deleteContainerWithRetry(hubstudio, containerCode);
      }
    } catch (error) {
      console.warn('[清理] closeAndStopBrowser 异常:', error && error.message ? error.message : error);
    }
  }

  /**
   * 删除容器（带重试和状态检查）
   * @private
   */
  async _deleteContainerWithRetry(hubstudio, containerCode) {
    try {
      // 在删除前，确保容器处于已关闭状态，轮询最多等待30秒
      const maxWaitMs = 30000;
      const pollInterval = 2000;
      const start = Date.now();
      let isClosed = false;

      while (Date.now() - start < maxWaitMs) {
        try {
          const statusRes = await hubstudio.getBrowserStatus([containerCode]);
          let containers = null;
          
          // 处理各种可能的响应格式
          if (statusRes && statusRes.containers) {
            containers = statusRes.containers;
          } else if (statusRes && statusRes.data && statusRes.data.containers) {
            containers = statusRes.data.containers;
          } else if (Array.isArray(statusRes)) {
            containers = statusRes;
          } else if (statusRes && typeof statusRes === 'object') {
            if (statusRes[containerCode]) {
              containers = [statusRes[containerCode]];
            }
          }

          if (containers && containers.length > 0) {
            const found = containers.find(c => 
              (c.containerCode === containerCode) || 
              (c.code === containerCode) || 
              (c.container_code === containerCode)
            );
            const status = found && (found.status || found.statusCode || found.state || found.stateCode);

            // HubStudio 状态码: 0=已开启,1=开启中,2=关闭中,3=已关闭
            if (status !== undefined && (status === 3 || String(status) === '3' || String(status) === 'closed')) {
              isClosed = true;
              break;
            }
          }
        } catch (e) {
          // 忽略轮询中的错误，继续等待
        }

        await new Promise(r => setTimeout(r, pollInterval));
      }

      if (!isClosed) {
        this.tasklog({ 
          message: '未检测到容器完全关闭，但将尝试删除', 
          logID: 'Cleanup' 
        });
      }

      // 执行删除
      let deleteSucceeded = false;
      const tryDelete = async () => {
        if (typeof hubstudio.deleteContainer === 'function') {
          await hubstudio.deleteContainer(containerCode);
        } else if (typeof hubstudio.destroyContainer === 'function') {
          await hubstudio.destroyContainer(containerCode);
        } else {
          throw new Error('HubStudio client has no deleteContainer/destroyContainer');
        }
      };

      // 重试删除最多2次
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await tryDelete();
          this.tasklog({ 
            message: `容器已删除: ${containerCode} (attempt ${attempt})`, 
            logID: 'Cleanup' 
          });
          deleteSucceeded = true;
          break;
        } catch (delErr) {
          const msg = delErr && delErr.message ? delErr.message : String(delErr);
          
          // 容器不存在，认为已删除
          if (msg.includes('-10004') || msg.includes('未找到环境信息') || msg.includes('Environment information not found')) {
            this.tasklog({ 
              message: `容器 (${containerCode}) 在HubStudio中未找到，视为已删除`, 
              logID: 'Cleanup' 
            });
            deleteSucceeded = true;
            break;
          }

          console.warn(`[清理] deleteContainer attempt ${attempt} 失败:`, msg);
          
          // 小等待后重试
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }

      if (!deleteSucceeded) {
        console.warn('[清理] 多次尝试后删除容器失败:', containerCode);
      }
    } catch (e) {
      console.warn('[清理] 删除容器失败:', e && e.message ? e.message : e);
    }
  }

  /**
   * 执行最终清理
   * 包括浏览器关闭、容器删除、账号状态更新
   */
  async ensureFinalCleanup(options = {}) {
    const {
      lastOutcome = 'failure', // 'success' or 'failure'
      autoDeleteOnFailure = true,
      accountInfo = null,
      accountManagerAPI = null,
      page = this.page,
      browser = null,
      hubstudio = null,
      containerCode = null
    } = options;

    // 防止重复清理
    if (this._cleanupDone) {
      this.tasklog({ message: '清理已执行过，跳过', logID: 'Cleanup' });
      return;
    }

    this.tasklog({ message: '执行最终清理', logID: 'Cleanup' });

    // 根据最后结果决定是否删除容器
    const shouldDelete = (lastOutcome === 'failure') && autoDeleteOnFailure;

    // 执行底层清理
    try {
      await this.closeAndStopBrowser({ 
        deleteContainer: shouldDelete, 
        reason: 'final-cleanup',
        page,
        browser,
        hubstudio,
        containerCode
      });
    } catch (e) {
      console.warn('[清理] ensureFinalCleanup 执行清理失败:', e && e.message ? e.message : e);
    }

    // 更新账号状态
    try {
      if (accountInfo && accountInfo.user && accountManagerAPI && accountManagerAPI.updateAccountStatus) {
        await accountManagerAPI.updateAccountStatus(accountInfo.user, { status: 'finished' });
        this.tasklog({ 
          message: `账号状态已更新为 finished: ${accountInfo.user}`, 
          logID: 'Cleanup' 
        });
      }
    } catch (e) {
      console.warn('[清理] 更新账号状态失败:', e && e.message ? e.message : e);
    }

    this._cleanupDone = true;
  }
}

module.exports = CleanupOperations;
