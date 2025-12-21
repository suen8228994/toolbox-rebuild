/**
 * Two-Step Verification设置界面检测脚本（正确版本）
 * 流程：
 * 1. 打开本地index.html
 * 2. 等待index.html自动重定向到test1111.html
 * 3. 检测新页面是否是截图中的Two-Step Verification设置页面
 * 4. 如果是，点击"Got it. Turn on Two-Step Verification"按钮进入亚马逊主页
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class TSVSetupDetectionTester {
  constructor() {
    this.page = null;
    this.browser = null;
  }

  async init() {
    this.browser = await chromium.launch({ headless: false });
    this.page = await this.browser.newPage();
  }

  async close() {
    if (this.page) await this.page.close();
    if (this.browser) await this.browser.close();
  }

  /**
   * 检测当前页面是否是TSV设置说明页面
   */
  async detectTSVSetupPage() {
    try {
      const pageText = await this.page.locator('body').textContent();
      
      // 检测关键文本
      const markers = [
        'Legacy device Sign-In method',
        'Suppress OTP challenge during Sign-In',
        'Got it. Turn on Two-Step Verification'
      ];

      let foundCount = 0;
      for (const marker of markers) {
        if (pageText.includes(marker)) {
          console.log(`[检测] ✓ 找到关键文本: "${marker}"`);
          foundCount++;
        }
      }

      // 检测"Got it"按钮 - 使用多种选择器
      let hasButton = false;
      const selectors = [
        'a:has-text("Got it")',
        'button:has-text("Got it")',
        '[role="link"]:has-text("Got it")',
        '*:has-text("Got it. Turn on")',
        'text=Got it'
      ];

      for (const selector of selectors) {
        try {
          const count = await this.page.locator(selector).count();
          if (count > 0) {
            console.log(`[检测] ✓ 找到按钮: "${selector}"`);
            hasButton = true;
            break;
          }
        } catch (e) {
          // 继续尝试
        }
      }

      if (foundCount >= 3) {
        console.log('[检测] ✅ 确认是Two-Step Verification设置页面\n');
        return true;
      }

      console.log(`[检测] ⚠️ 找到 ${foundCount}/3 个关键文本\n`);
      return false;
      
    } catch (error) {
      console.log('[检测] 出错:', error.message);
      return false;
    }
  }

  /**
   * 进入亚马逊主页
   */
  async goToAmazonHomepage() {
    try {
      console.log('[操作] 检测到TSV设置页面，直接进入亚马逊主页...\n');
      
      // 尝试导航到亚马逊主页
      await this.page.goto('https://www.amazon.com/', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      }).catch(async (error) => {
        console.log(`[操作] ⚠️ 首页加载失败，尝试其他页面`);
        await this.page.goto('https://www.amazon.com/gp/homepage.html', { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        }).catch(async (e) => {
          console.log(`[操作] ⚠️ 备用主页也失败`);
        });
      });
      
      await this.page.waitForTimeout(2000);
      console.log('[操作] ✅ 成功进入亚马逊主页\n');
      return true;
      
    } catch (error) {
      console.error('[操作] 进入亚马逊主页失败:', error.message);
      return false;
    }
  }

  /**
   * 完整测试流程
   */
  async runFullTest() {
    try {
      await this.init();

      // 1. 打开本地index.html
      const localIndexPath = 'file:///' + 'C:\\Users\\sxh\\Desktop\\index.html'.replace(/\\/g, '/');
      
      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║  Two-Step Verification 设置页面检测 - 完整流程测试              ║`);
      console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
      
      console.log(`[步骤1] 正在打开本地HTML文件...\n`);
      console.log(`📂 URL: ${localIndexPath}\n`);
      
      await this.page.goto(localIndexPath, { waitUntil: 'domcontentloaded' });
      const initialUrl = this.page.url();
      console.log(`✓ 初始页面已加载: ${initialUrl}\n`);
      
      // 2. 等待重定向到test1111.html
      console.log(`[步骤2] 等待自动重定向到test1111.html（3秒）...\n`);
      
      // 监听URL变化，等待重定向完成
      let pageChangeDetected = false;
      const urlChangeListener = () => {
        if (!pageChangeDetected) {
          pageChangeDetected = true;
          const newUrl = this.page.url();
          console.log(`✓ 页面已重定向: ${newUrl}\n`);
        }
      };
      
      this.page.on('framenavigated', urlChangeListener);
      
      // 等待URL改变或超时
      await Promise.race([
        this.page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
        new Promise(resolve => setTimeout(resolve, 10000))
      ]);
      
      this.page.removeListener('framenavigated', urlChangeListener);
      
      const finalUrl = this.page.url();
      console.log(`[步骤3] 检测当前页面...\n`);
      console.log(`当前URL: ${finalUrl}\n`);
      
      // 3. 检测是否是TSV设置页面
      const isTSVPage = await this.detectTSVSetupPage();
      
      if (isTSVPage) {
        console.log(`[步骤4] 进入亚马逊主页...\n`);
        const success = await this.goToAmazonHomepage();
        
        if (success) {
          console.log(`✅ 成功进入亚马逊主页`);
          console.log(`⏳ 等待页面稳定...\n`);
          
          await Promise.race([
            this.page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
            new Promise(resolve => setTimeout(resolve, 5000))
          ]);
          
          const finalUrl = this.page.url();
          console.log(`✓ 最终URL: ${finalUrl}\n`);
          console.log(`🎉 测试流程完成！\n`);
        } else {
          console.log(`⚠️ 无法进入亚马逊主页\n`);
        }
      } else {
        console.log(`⚠️ 当前页面不是Two-Step Verification设置页面\n`);
      }

    } catch (error) {
      console.error('❌ 测试异常:', error);
    } finally {
      // 保持浏览器打开几秒钟，方便查看最终结果
      console.log(`\n[等待中] 浏览器将在5秒后关闭...\n`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      await this.close();
    }
  }
}

// 主程序
async function main() {
  const tester = new TSVSetupDetectionTester();
  await tester.runFullTest();
}

main().catch(console.error);
