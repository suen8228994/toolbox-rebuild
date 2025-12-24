/**
 * Amazon Account Registration Worker
 * 
 * 这个模块提供了亚马逊账号批量注册的核心逻辑
 * 从原始toolbox的task.worker.js中提取并重构
 * 
 * 主要功能:
 * - 使用Playwright自动化浏览器操作
 * - 支持多种浏览器类型 (HubStudio/AdsPower/BitBrowser)
 * - 处理代理配置
 * - 填写注册表单
 * - 处理邮箱和手机验证
 * - 错误处理和重试机制
 */

const { chromium } = require('playwright');
const HubStudioClient = require('./hubstudioClient');

/**
 * 亚马逊注册配置接口
 * @typedef {Object} AmazonRegisterConfig
 * @property {string} email - 注册邮箱
 * @property {string} password - 账号密码
 * @property {string} firstName - 名字
 * @property {string} lastName - 姓氏
 * @property {string} phoneNumber - 电话号码
 * @property {string} country - 国家代码 (US, UK, CA等)
 * @property {Object} proxy - 代理配置
 * @property {string} proxy.server - 代理服务器地址
 * @property {string} proxy.username - 代理用户名(可选)
 * @property {string} proxy.password - 代理密码(可选)
 * @property {string} browserType - 浏览器类型 (HubStudio/AdsPower/BitBrowser)
 * @property {string} browserProfileId - 浏览器配置文件ID
 * @property {number} timeout - 超时时间(毫秒)
 * @property {boolean} headless - 是否无头模式
 */

/**
 * 注册结果接口
 * @typedef {Object} RegisterResult
 * @property {boolean} success - 是否成功
 * @property {Object} account - 账号信息
 * @property {string} account.email - 邮箱
 * @property {string} account.password - 密码
 * @property {string} account.customerId - Amazon Customer ID
 * @property {string} account.createdAt - 创建时间
 * @property {string} error - 错误信息(失败时)
 * @property {string} step - 当前步骤
 */

/**
 * Amazon域名映射
 */
const AMAZON_DOMAINS = {
  US: 'https://www.amazon.com',
  UK: 'https://www.amazon.co.uk',
  CA: 'https://www.amazon.ca',
  DE: 'https://www.amazon.de',
  FR: 'https://www.amazon.fr',
  IT: 'https://www.amazon.it',
  ES: 'https://www.amazon.es',
  JP: 'https://www.amazon.co.jp',
};

/**
 * 等待元素选择器配置
 */
const SELECTORS = {
  // 注册页面
  createAccountButton: 'a[href*="register"], #createAccountSubmit',
  emailInput: '#ap_email, input[name="email"]',
  passwordInput: '#ap_password, input[name="password"]',
  passwordCheckInput: '#ap_password_check, input[name="passwordCheck"]',
  customerNameInput: '#ap_customer_name, input[name="customerName"]',
  continueButton: '#continue, input[type="submit"]',
  
  // 验证页面
  verificationCodeInput: '#auth-mfa-otpcode, input[name="otpCode"]',
  verifyButton: '#auth-signin-button, button[type="submit"]',
  
  // 错误提示
  errorBox: '.a-alert-error, #auth-error-message-box',
  captcha: '#auth-captcha-image, .cvf-widget',
};

/**
 * 主注册函数
 * @param {AmazonRegisterConfig} config - 注册配置
 * @returns {Promise<RegisterResult>} 注册结果
 */
async function registerAmazonAccount(config) {
  const countries = ['IN','ID','JP','KR','HK','PH','SG','VN','MM','TH','MY','TW','KP','BD','BT','MV','NP','PK','LK','BH','KW','OM','SE','QA','SA','AE','YE','CY','IQ','IL','JO','LB','PS','SY','AF','AM','AZ','IR','TR','KZ','KG','TJ','TM','UZ','GE','TL','MO','GB','FR','RU','IT','DE','LU','BY','BE','AT','ES','IE','FI','VA','PT','LV','PL','LT','HU','MD','NL','CH','MC','CZ','NO','IS','GR','MT','EE','UA','HR','US','CA','JM','LC','MX','PA','BR','AR','CO','CL','VE','PE','NZ','PW','AU','MG','MZ','ZA','ET','KE','GH','NG','DZ'];
  let countriesCountry = countries[Math.floor(Math.random() * countries.length)];
  const {
    email,
    password,
    firstName,
    lastName,
    phoneNumber,
    country = countriesCountry,
    proxy,
    browserType = 'chromium',
    browserProfileId,
    timeout = 60000,
    headless = false,
  } = config;

  let browser = null;
  let context = null;
  let page = null;

  try {
    // 步骤1: 启动浏览器
    console.log('[Amazon Register] 启动浏览器...');
    const launchResult = await launchBrowser({
      browserType,
      browserProfileId,
      proxy,
      headless,
    });
    
    browser = launchResult.browser;
    context = launchResult.context;
    page = launchResult.page;

    // 步骤2: 导航到注册页面
    console.log('[Amazon Register] 导航到注册页面...');
    const amazonUrl = AMAZON_DOMAINS[country] || AMAZON_DOMAINS.US;
    await navigateToRegisterPage(page, amazonUrl, timeout);

    // 步骤3: 填写注册表单
    console.log('[Amazon Register] 填写注册表单...');
    await fillRegistrationForm(page, {
      email,
      password,
      name: `${firstName} ${lastName}`,
    }, timeout);

    // 步骤4: 提交表单
    console.log('[Amazon Register] 提交注册表单...');
    await submitRegistrationForm(page, timeout);

    // 步骤5: 处理验证 (如果需要)
    console.log('[Amazon Register] 检查是否需要验证...');
    const verificationRequired = await checkVerificationRequired(page);
    
    if (verificationRequired) {
      console.log('[Amazon Register] 需要验证 - 等待用户输入...');
      // 这里需要外部提供验证码
      // 实际应用中应该通过回调或事件通知主进程
      return {
        success: false,
        step: 'verification_required',
        error: '需要邮箱或短信验证',
        account: { email },
      };
    }

    // 步骤6: 验证注册成功
    console.log('[Amazon Register] 验证注册状态...');
    const isSuccess = await verifyRegistrationSuccess(page, timeout);

    if (!isSuccess) {
      throw new Error('注册完成但无法确认成功状态');
    }

    // 步骤7: 获取账号信息
    const customerId = await extractCustomerId(page);

    console.log('[Amazon Register] 注册成功!');
    return {
      success: true,
      account: {
        email,
        password,
        customerId,
        country,
        createdAt: new Date().toISOString(),
      },
      step: 'completed',
    };

  } catch (error) {
    console.error('[Amazon Register] 注册失败:', error.message);
    return {
      success: false,
      error: error.message,
      step: error.step || 'unknown',
      account: { email },
    };
  } finally {
    // 清理资源
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * 启动浏览器
 */
async function launchBrowser({ 
  browserType, 
  browserProfileId, 
  proxy, 
  headless,
  platformClient,  // 原始toolbox: platformClient (任务平台)
  args,            // 原始toolbox: args (启动参数数组)
  cache,           // 原始toolbox: cache (是否缓存)
  arrange          // 原始toolbox: arrange (自动排列)
}) {
  let browser, context, page;

  // 根据浏览器类型启动
  if (platformClient === 'hubstudio') {
    // ========== HubStudio 平台 ==========
    console.log('[Browser] 使用 HubStudio 平台启动浏览器');
    console.log('[HubStudio] 启动参数:', args);
    
    // 创建HubStudio客户端
    const hubstudio = new HubStudioClient();

    // 启动HubStudio浏览器
    const browserData = await hubstudio.startBrowser({
      containerCode: browserProfileId || 'default',  // 环境ID（必须）
      isHeadless: headless || false,
      isWebDriverReadOnlyMode: !cache,  // 不启用缓存=只读模式
      args: args || [],  // 启动参数数组
      cdpHide: true  // 屏蔽CDP检测
    });

    // 连接到HubStudio浏览器
    const wsEndpoint = `ws://127.0.0.1:${browserData.debuggingPort}`;
    console.log(`[HubStudio] 连接到浏览器 WebSocket: ${wsEndpoint}`);
    browser = await chromium.connectOverCDP(wsEndpoint);

    // 如果启用自动排列
    if (arrange) {
      console.log('[HubStudio] 执行窗口自动排列...');
      try {
        await hubstudio.arrangeBrowserWindows({
          x: 10,
          y: 10,
          width: 600,
          height: 500,
          gapX: 20,
          gapY: 20,
          colNum: 3
        });
      } catch (error) {
        console.error('[HubStudio] 窗口排列失败:', error.message);
      }
    }

  } else if (platformClient === 'adspower') {
    // ========== AdsPower 平台 ==========
    console.log('[Browser] AdsPower 平台暂未实现');
    throw new Error('AdsPower 平台暂未实现，请联系开发者');

  } else if (platformClient === 'bitbrowser') {
    // ========== BitBrowser 平台 ==========
    console.log('[Browser] BitBrowser 平台暂未实现');
    throw new Error('BitBrowser 平台暂未实现，请联系开发者');

  } else {
    // ========== 默认 Chromium 浏览器 ==========
    console.log('[Browser] 使用默认 Chromium 浏览器');
    
    const launchOptions = {
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        ...(args || [])  // 添加启动参数数组
      ],
    };

    // 配置代理
    if (proxy && proxy.server) {
      launchOptions.proxy = {
        server: proxy.server,
      };
      if (proxy.username && proxy.password) {
        launchOptions.proxy.username = proxy.username;
        launchOptions.proxy.password = proxy.password;
      }
    }

    browser = await chromium.launch(launchOptions);
  }

  // 创建上下文
  const contextOptions = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
  };

  // 如果不启用缓存，则使用隐私模式
  if (!enableCache) {
    console.log('[Browser] 隐私模式（无缓存）');
    // 可以添加更多隐私设置
  }

  context = await browser.newContext(contextOptions);

  // 创建页面
  page = await context.newPage();

  // 如果启用自动排列，记录窗口信息（实际排列需要窗口管理API）
  if (autoArrange) {
    console.log('[Browser] 自动排列已启用（需要窗口管理API实现）');
  }

  return { browser, context, page };
}

/**
 * 导航到注册页面
 */
async function navigateToRegisterPage(page, amazonUrl, timeout) {
  try {
    // 访问Amazon首页
    await page.goto(amazonUrl, { 
      waitUntil: 'networkidle',
      timeout 
    });

    // 点击创建账号按钮
    const createAccountBtn = await page.waitForSelector(SELECTORS.createAccountButton, {
      timeout,
      state: 'visible',
    });
    
    await createAccountBtn.click();

    // 等待注册页面加载
    await page.waitForURL(/.*register.*|.*ap\/register.*/, { timeout });
    
    // 等待表单元素出现
    await page.waitForSelector(SELECTORS.emailInput, { timeout });

  } catch (error) {
    error.step = 'navigation';
    throw error;
  }
}

/**
 * 填写注册表单
 */
async function fillRegistrationForm(page, { email, password, name }, timeout) {
  try {
    // 填写姓名
    const nameInput = await page.waitForSelector(SELECTORS.customerNameInput, { timeout });
    await nameInput.fill(name);
    await page.waitForTimeout(500);

    // 填写邮箱
    const emailInput = await page.waitForSelector(SELECTORS.emailInput, { timeout });
    await emailInput.fill(email);
    await page.waitForTimeout(500);

    // 填写密码
    const passwordInput = await page.waitForSelector(SELECTORS.passwordInput, { timeout });
    await passwordInput.fill(password);
    await page.waitForTimeout(500);

    // 确认密码
    const passwordCheckInput = await page.$(SELECTORS.passwordCheckInput);
    if (passwordCheckInput) {
      await passwordCheckInput.fill(password);
      await page.waitForTimeout(500);
    }

  } catch (error) {
    error.step = 'fill_form';
    throw error;
  }
}

/**
 * 提交注册表单
 */
async function submitRegistrationForm(page, timeout) {
  try {
    // 检查是否有验证码
    const captcha = await page.$(SELECTORS.captcha);
    if (captcha) {
      throw new Error('检测到验证码，需要人工处理');
    }

    // 点击提交按钮
    const submitButton = await page.waitForSelector(SELECTORS.continueButton, { timeout });
    await submitButton.click();

    // 等待页面跳转或加载
    await page.waitForLoadState('networkidle', { timeout });

  } catch (error) {
    error.step = 'submit_form';
    throw error;
  }
}

/**
 * 检查是否需要验证
 */
async function checkVerificationRequired(page) {
  try {
    // 检查是否出现验证码输入框
    const verificationInput = await page.$(SELECTORS.verificationCodeInput);
    return !!verificationInput;
  } catch {
    return false;
  }
}

/**
 * 验证注册成功
 */
async function verifyRegistrationSuccess(page, timeout) {
  try {
    // 检查是否有错误提示
    const errorBox = await page.$(SELECTORS.errorBox);
    if (errorBox) {
      const errorText = await errorBox.innerText();
      throw new Error(`注册失败: ${errorText}`);
    }

    // 检查是否跳转到成功页面
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    
    // Amazon注册成功通常会跳转到首页或welcome页面
    const isSuccess = !currentUrl.includes('register') && 
                     !currentUrl.includes('/ap/') &&
                     !currentUrl.includes('error');

    return isSuccess;

  } catch (error) {
    error.step = 'verify_success';
    throw error;
  }
}

/**
 * 提取Customer ID
 */
async function extractCustomerId(page) {
  try {
    // 尝试从页面中提取Customer ID
    // 方法1: 从cookies中获取
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => 
      c.name.includes('session') || c.name.includes('customer')
    );

    if (sessionCookie) {
      return sessionCookie.value.substring(0, 20); // 简化处理
    }

    // 方法2: 从页面元素中获取
    const customerIdElement = await page.$('[data-customer-id]');
    if (customerIdElement) {
      return await customerIdElement.getAttribute('data-customer-id');
    }

    return 'UNKNOWN';

  } catch {
    return 'UNKNOWN';
  }
}

/**
 * 批量注册函数
 * @param {Array<AmazonRegisterConfig>} configList - 配置列表
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<Array<RegisterResult>>} 结果列表
 */
async function registerMultipleAccounts(configList, onProgress) {
  const results = [];

  for (let i = 0; i < configList.length; i++) {
    const config = configList[i];
    
    console.log(`\n[Batch] 开始注册账号 ${i + 1}/${configList.length}`);
    console.log(`[Batch] 邮箱: ${config.email}`);

    try {
      const result = await registerAmazonAccount(config);
      results.push(result);

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: configList.length,
          result,
        });
      }

      // 间隔一段时间再注册下一个账号
      if (i < configList.length - 1) {
        const delay = 5000 + Math.random() * 5000; // 5-10秒随机延迟
        console.log(`[Batch] 等待 ${(delay / 1000).toFixed(1)} 秒后继续...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

    } catch (error) {
      console.error(`[Batch] 账号 ${i + 1} 注册失败:`, error);
      results.push({
        success: false,
        error: error.message,
        account: { email: config.email },
      });
    }
  }

  return results;
}

// 导出函数
module.exports = {
  registerAmazonAccount,
  registerMultipleAccounts,
  AMAZON_DOMAINS,
};
