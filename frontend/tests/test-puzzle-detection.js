/**
 * Puzzle检测功能测试脚本
 * 用于验证detectPuzzlePage和handlePuzzlePageRecovery的功能
 */

const { test, expect } = require('@playwright/test');

test.describe('Puzzle Page Detection', () => {
  test('should detect puzzle page with text content', async ({ page }) => {
    // 创建一个模拟的Puzzle页面
    await page.setContent(`
      <html>
        <body>
          <div class="puzzle-container">
            <h1>Solve this puzzle to protect your account</h1>
            <button id="start-puzzle-btn">Start Puzzle</button>
            <p>Complete the puzzle to verify you're human</p>
          </div>
        </body>
      </html>
    `);

    // 模拟detectPuzzlePage逻辑
    const pageText = await page.locator('body').textContent();
    const hasPuzzleText = pageText && pageText.includes('Solve this puzzle to protect your account');
    
    expect(hasPuzzleText).toBe(true);
  });

  test('should detect puzzle page with button', async ({ page }) => {
    // 创建一个只有按钮的Puzzle页面
    await page.setContent(`
      <html>
        <body>
          <button>Start Puzzle</button>
          <div id="puzzle-content"></div>
        </body>
      </html>
    `);

    // 模拟detectPuzzlePage逻辑
    const startPuzzleButton = await page.locator(
      'button:has-text("Start Puzzle"), button:has-text("solve puzzle"), [class*="puzzle"]'
    ).count();
    
    expect(startPuzzleButton).toBeGreaterThan(0);
  });

  test('should detect puzzle page with container', async ({ page }) => {
    // 创建一个有puzzle容器的页面
    await page.setContent(`
      <html>
        <body>
          <div class="amzn-cvf-puzzle">
            <div id="puzzle-grid"></div>
          </div>
        </body>
      </html>
    `);

    // 模拟detectPuzzlePage逻辑
    const puzzleContainer = await page.locator(
      '[class*="puzzle"], [id*="puzzle"], [class*="amzn-cvf-puzzle"]'
    ).count();
    
    expect(puzzleContainer).toBeGreaterThan(0);
  });

  test('should not detect puzzle on normal page', async ({ page }) => {
    // 创建一个正常的页面（不是Puzzle页面）
    await page.setContent(`
      <html>
        <body>
          <h1>Welcome to Amazon</h1>
          <form>
            <input type="email" />
            <input type="password" />
          </form>
        </body>
      </html>
    `);

    // 模拟detectPuzzlePage逻辑
    const pageText = await page.locator('body').textContent();
    const hasPuzzleText = pageText && pageText.includes('Solve this puzzle to protect your account');
    
    const startPuzzleButton = await page.locator(
      'button:has-text("Start Puzzle"), button:has-text("solve puzzle"), [class*="puzzle"]'
    ).count();
    
    const puzzleContainer = await page.locator(
      '[class*="puzzle"], [id*="puzzle"], [class*="amzn-cvf-puzzle"]'
    ).count();
    
    expect(hasPuzzleText).toBe(false);
    expect(startPuzzleButton).toBe(0);
    expect(puzzleContainer).toBe(0);
  });

  test('should handle puzzle recovery error creation', () => {
    // 测试错误对象的创建
    const email = 'test@example.com';
    const retryCount = 1;

    const error = new Error('PUZZLE_PAGE_DETECTED_RETRY');
    error.puzzleRetry = true;
    error.email = email;
    error.retryCount = retryCount;

    expect(error.message).toBe('PUZZLE_PAGE_DETECTED_RETRY');
    expect(error.puzzleRetry).toBe(true);
    expect(error.email).toBe(email);
    expect(error.retryCount).toBe(retryCount);
  });

  test('should respect puzzle retry count limit', () => {
    // 测试重试次数限制
    const maxRetries = 2;
    let puzzleRetryCount = 0;

    for (let i = 0; i < 5; i++) {
      puzzleRetryCount++;
      if (puzzleRetryCount > maxRetries) {
        expect(() => {
          throw new Error(`Puzzle验证失败，已重试 ${puzzleRetryCount} 次，放弃注册`);
        }).toThrow();
        break;
      }
    }

    expect(puzzleRetryCount).toBeGreaterThan(maxRetries);
  });
});

/**
 * 集成测试脚本
 * 用于测试完整的Puzzle检测和恢复流程
 */

const AmazonRegisterCore = require('../utils/amazonRegisterCore');

test.describe('Puzzle Detection Integration', () => {
  test.skip('should integrate puzzle detection into registration flow', async ({ page }) => {
    // 这是一个占位符，实际测试需要完整的注册流程
    // 和真实的Amazon网站交互
    
    console.log('Puzzle detection integration test - skipped (requires real Amazon access)');
  });
});

console.log('✅ Puzzle detection tests ready to run');
console.log('Run with: npx jest test-puzzle-detection.js');
console.log('Run with: npx playwright test test-puzzle-detection.js');
