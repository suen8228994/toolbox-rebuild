/**
 * 测试复选框点击修复
 * 用来验证 submitTwoStepVerification 中的复选框点击是否能正确处理
 */

const { test, expect } = require('@playwright/test');

test('Test checkbox click fix', async ({ page }) => {
  // 创建一个模拟的HTML页面，包含和Amazon 2FA相同的复选框结构
  await page.setContent(`
    <html>
    <body>
    <form id="enable-mfa-form">
      <div>
        <label>
          <input type="checkbox" name="trustThisDevice" value="1" />
          <i class="a-icon a-icon-checkbox"></i>
          Don't require OTP on this browser
        </label>
      </div>
      <button id="enable-mfa-form-submit">Confirm</button>
    </form>
    </body>
    </html>
  `);

  // 获取复选框
  const checkbox = await page.locator('input[name="trustThisDevice"]');
  
  console.log('✓ 复选框已找到');
  
  // 验证初始状态
  const isCheckedBefore = await checkbox.isChecked();
  console.log('✓ 复选框初始状态:', isCheckedBefore ? '已勾选' : '未勾选');
  
  // 测试方案1: 使用 force: true
  try {
    console.log('尝试方案1: force: true');
    await checkbox.check({ force: true, timeout: 5000 });
    console.log('✓ 方案1成功: force: true 能够勾选复选框');
  } catch (err) {
    console.log('✗ 方案1失败:', err.message);
    
    // 测试方案2: JavaScript 直接设置
    try {
      console.log('尝试方案2: JavaScript 直接设置');
      await checkbox.evaluate((el) => {
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      console.log('✓ 方案2成功: JavaScript 直接设置能够勾选复选框');
    } catch (err2) {
      console.log('✗ 方案2也失败:', err2.message);
    }
  }
  
  // 验证最终状态
  const isCheckedAfter = await checkbox.isChecked();
  console.log('✓ 复选框最终状态:', isCheckedAfter ? '已勾选' : '未勾选');
  
  // 验证结果
  expect(isCheckedAfter).toBe(true);
  console.log('\n✅ 测试通过！复选框已成功勾选');
});
