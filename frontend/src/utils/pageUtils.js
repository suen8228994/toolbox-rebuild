/**
 * Page Utilities - Anti-Bot Detection Methods
 * 用于模拟人类行为，规避机器人检测
 */

/**
 * 模拟人类滚动行为 - 上下随机滚动
 */
async function scrollDownAndUp(page) {
  const down = 200 + Math.random() * 200;
  const up = 150 + Math.random() * 200;

  // 向下滚动
  await page.mouse.move(200 + Math.random() * 300, 300 + Math.random() * 200, {
    steps: 10,
  });
  await page.mouse.wheel(0, down);
  await page.waitForTimeout(800 + Math.random() * 800);

  // 向上滚动
  await page.mouse.wheel(0, -up);
  await page.waitForTimeout(600 + Math.random() * 600);
}

/**
 * 模拟人类打字 - 随机延迟、偶尔删除重打
 */
async function humanType(page, selector, text) {
  await page.focus(selector);

  for (const ch of text.split('')) {
    await page.keyboard.sendCharacter(ch);
    await page.waitForTimeout(Math.random() * 120 + 50); // 随机间隔 50–170ms
    if (Math.random() < 0.05) {
      await page.waitForTimeout(Math.random() * 500); // 偶尔暂停
    }
  }

  // 20% 概率模拟选中删除重打
  if (Math.random() < 0.2) {
    await page.keyboard.down('Shift');
    await page.keyboard.press('Home');
    await page.keyboard.up('Shift');
    await page.keyboard.press('Backspace');
    await humanType(page, selector, text);
  }
}

/**
 * 模拟人类点击 - 带鼠标移动轨迹
 */
async function humanClick(page, selector) {
  const el = await page.$(selector);
  if (!el) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  const box = await el.boundingBox();
  if (!box) {
    throw new Error(`Element has no bounding box: ${selector}`);
  }
  
  const x = box.x + box.width / 2 + Math.random() * 5;
  const y = box.y + box.height / 2 + Math.random() * 5;

  // 先移动到附近，再移动到目标
  await page.mouse.move(
    x - 50 + Math.random() * 100,
    y - 50 + Math.random() * 100,
    { steps: 10 }
  );
  await page.waitForTimeout(100 + Math.random() * 200);
  await page.mouse.click(x, y, { delay: 100 + Math.random() * 200 });
}

/**
 * 使用 Locator 的人类点击方法（兼容 Playwright Locator）
 */
async function humanClickLocator(page, locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Element has no bounding box');
  }
  
  const x = box.x + box.width / 2 + Math.random() * 5;
  const y = box.y + box.height / 2 + Math.random() * 5;

  // 先移动到附近，再移动到目标
  await page.mouse.move(
    x - 50 + Math.random() * 100,
    y - 50 + Math.random() * 100,
    { steps: 10 }
  );
  await page.waitForTimeout(100 + Math.random() * 200);
  await page.mouse.click(x, y, { delay: 100 + Math.random() * 200 });
}

/**
 * 使用 Locator 的人类打字方法（兼容 Playwright Locator）
 */
async function humanTypeLocator(page, locator, text) {
  await locator.click(); // 先聚焦
  await page.waitForTimeout(200 + Math.random() * 300);

  for (const ch of text.split('')) {
    await page.keyboard.type(ch, { delay: 50 + Math.random() * 120 });
    if (Math.random() < 0.05) {
      await page.waitForTimeout(Math.random() * 500); // 偶尔暂停
    }
  }

  // 20% 概率模拟选中删除重打
  if (Math.random() < 0.2) {
    await page.keyboard.down('Shift');
    await page.keyboard.press('Home');
    await page.keyboard.up('Shift');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300 + Math.random() * 300);
    await humanTypeLocator(page, locator, text);
  }
}

module.exports = {
  scrollDownAndUp,
  humanClick,
  humanType,
  humanClickLocator,
  humanTypeLocator
};
