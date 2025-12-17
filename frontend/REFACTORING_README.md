# Amazon Registration - 重构版本说明

## 📋 重构目标

将原有的单一大类 `amazonRegisterCore.js` (1500+行) 重构为多个职责清晰的操作类，实现：
- ✅ **职责分离**: 每个类只负责特定功能
- ✅ **易于维护**: 修改某个功能不影响其他模块
- ✅ **可测试性**: 每个类都有独立的单元测试
- ✅ **代码复用**: 通用功能抽象到基类

## 🏗️ 架构设计

### 类结构图

```
AmazonRegisterCoreRefactored (主协调类)
    └── OperationsManager (操作管理器)
            ├── BaseOperations (基础操作类)
            ├── NavigationOperations (页面导航)
            ├── FormOperations (表单填写)
            ├── CaptchaOperations (验证码处理)
            ├── TwoFactorAuthOperations (2FA操作)
            ├── EmailVerificationOperations (邮箱验证)
            ├── AddressOperations (地址绑定)
            └── LoginStatusOperations (登录状态检查)
```

## 📁 文件结构

```
src/utils/operations/
├── BaseOperations.js                # 基础操作类（通用方法）
├── NavigationOperations.js          # 页面导航操作
├── FormOperations.js                # 表单填写操作
├── CaptchaOperations.js             # Captcha处理
├── TwoFactorAuthOperations.js       # 2FA相关操作
├── EmailVerificationOperations.js   # 邮箱验证操作
├── AddressOperations.js             # 地址绑定操作
├── LoginStatusOperations.js         # 登录状态检查
└── OperationsManager.js             # 操作管理器

src/utils/
└── amazonRegisterCoreRefactored.js  # 重构后的主类

tests/operations/
├── test-navigation.js               # 导航功能测试
├── test-form.js                     # 表单功能测试
├── test-captcha.js                  # 验证码功能测试
├── test-twofactor.js                # 2FA功能测试
└── test-address.js                  # 地址功能测试

tests/
└── test-runner.js                   # 测试运行器
```

## 🎯 各类职责说明

### 1. BaseOperations (基础操作类)
**职责**: 提供通用的页面交互方法
**方法**:
- `clickElement()` - 通用点击方法
- `fillInput()` - 通用输入方法
- `waitRandom()` - 随机等待

### 2. NavigationOperations (导航操作类)
**职责**: 负责页面导航和跳转
**方法**:
- `selectLanguage()` - 选择语言
- `goToSellRegister()` - 进入卖家注册页面
- `goToHomepage()` - 打开个人中心
- `goToLoginSecurity()` - 打开登录与安全
- `goToStepVerification()` - 打开两步验证
- `goToAccountAddress()` - 进入地址管理
- `goToNavLogo()` - 返回首页

### 3. FormOperations (表单操作类)
**职责**: 负责各种表单填写
**方法**:
- `clickSignUp()` - 点击注册按钮
- `clickCreateAccount()` - 点击创建账号
- `fillUsername()` - 填写用户名
- `fillEmail()` - 填写邮箱
- `fillPassword()` - 填写密码
- `fillPasswordConfirm()` - 填写确认密码
- `submitRegistration()` - 提交注册表单
- `fillEmailCode()` - 填写邮箱验证码
- `submitEmailVerification()` - 提交邮箱验证

### 4. CaptchaOperations (验证码操作类)
**职责**: 负责验证码识别和提交
**方法**:
- `checkCaptcha()` - 检查是否有验证码
- `solveCaptcha()` - 解决验证码
- `getCaptchaData()` - 获取验证码数据
- `getCaptchaSolution()` - 获取验证码解决方案
- `clickCaptchaPosition()` - 点击验证码指定位置
- `submitCaptcha()` - 提交验证码

### 5. TwoFactorAuthOperations (2FA操作类)
**职责**: 负责两步验证相关操作
**方法**:
- `expandAuthenticatorApp()` - 展开验证器应用配置
- `get2FASecret()` - 获取2FA密钥
- `getStableTOTP()` - 获取稳定的TOTP码
- `fill2FACode()` - 填写2FA验证码
- `submit2FA()` - 提交2FA
- `fill2FAEmailCode()` - 填写2FA邮件验证码
- `submitTwoStepVerification()` - 提交两步验证最终确认

### 6. EmailVerificationOperations (邮箱验证类)
**职责**: 负责获取和处理邮箱验证码
**方法**:
- `getEmailVerificationCode()` - 获取邮箱验证码
- `updateRegisterTime()` - 更新注册时间

### 7. AddressOperations (地址操作类)
**职责**: 负责地址信息填写和提交
**方法**:
- `clickAddAddress()` - 点击添加地址
- `fillPhoneNumber()` - 填写电话号码
- `fillAddressLine1()` - 填写地址
- `fillCity()` - 填写城市
- `selectState()` - 选择州
- `fillPostalCode()` - 填写邮编
- `submitAddress()` - 提交地址表单
- `handleAddressSuggestions()` - 处理地址建议弹窗
- `generateAddressData()` - 生成随机地址数据

### 8. LoginStatusOperations (登录状态检查类)
**职责**: 负责检查和确保登录状态
**方法**:
- `checkLoginStatus()` - 检查是否已登录
- `ensureLoginStatus()` - 确保登录状态（重试机制）

### 9. OperationsManager (操作管理器)
**职责**: 统一管理所有操作类的实例
**功能**:
- 初始化所有操作类
- 提供统一访问接口 `ops.nav`, `ops.form`, `ops.captcha` 等
- 管理共享状态（registerTime, accountInfo）

### 10. AmazonRegisterCoreRefactored (主类)
**职责**: 流程协调和状态管理
**方法**:
- `execute()` - 主执行流程
- `checkRegistrationStatus()` - 检查注册状态
- `handleRegistrationStatus()` - 根据状态处理
- `handle2FASetup()` - 处理状态201
- `handle2FAManualSetup()` - 处理状态301
- `retryRegistration()` - 处理状态401
- `bindAddress()` - 绑定地址

## 🧪 单元测试

### 运行所有测试
```bash
node tests/test-runner.js
```

### 运行单个测试
```bash
# 导航功能测试
node tests/test-runner.js navigation

# 表单功能测试
node tests/test-runner.js form

# 验证码功能测试
node tests/test-runner.js captcha

# 2FA功能测试
node tests/test-runner.js twofactor

# 地址功能测试
node tests/test-runner.js address
```

### 直接运行单个测试文件
```bash
node tests/operations/test-navigation.js
node tests/operations/test-form.js
node tests/operations/test-captcha.js
node tests/operations/test-twofactor.js
node tests/operations/test-address.js
```

## 🔄 使用方式

### 方式1: 使用重构后的类（推荐）
```javascript
const AmazonRegisterCoreRefactored = require('./src/utils/amazonRegisterCoreRefactored');

const config = {
  page: page,
  user: 'test@example.com',
  pass: 'password123',
  refreshToken: 'refresh_token',
  clientId: 'client_id',
  bindAddress: true,
  postalCode: '10001',
  onLog: (data) => console.log(data)
};

const core = new AmazonRegisterCoreRefactored(config);
await core.execute();
```

### 方式2: 单独使用某个操作类
```javascript
const NavigationOperations = require('./src/utils/operations/NavigationOperations');

const tasklog = (data) => console.log(data.message);
const nav = new NavigationOperations(page, config, tasklog);

await nav.selectLanguage();
await nav.goToSellRegister();
```

### 方式3: 使用操作管理器
```javascript
const OperationsManager = require('./src/utils/operations/OperationsManager');

const ops = new OperationsManager(page, config, tasklog, accountInfo);

// 使用导航操作
await ops.nav.goToHomepage();

// 使用表单操作
await ops.form.fillEmail('test@example.com');

// 使用2FA操作
await ops.twoFA.expandAuthenticatorApp();
```

## ✅ 重构优势

### 1. 职责清晰
- 每个类只负责一个功能模块
- 修改某个功能不会影响其他模块
- 代码更易理解和维护

### 2. 易于测试
- 每个类都有独立的单元测试
- 可以单独测试每个功能模块
- 快速定位问题所在

### 3. 易于扩展
- 添加新功能只需创建新的操作类
- 不需要修改现有代码
- 符合开闭原则

### 4. 代码复用
- 通用方法抽象到 BaseOperations
- 所有操作类继承基类
- 避免重复代码

### 5. 便于调试
- 每个类都有详细的日志输出
- 可以单独运行某个操作类
- 快速定位问题

## 🐛 问题排查

如果某个功能出现问题：

1. **运行对应的单元测试**
   ```bash
   node tests/operations/test-xxx.js
   ```

2. **查看该功能对应的操作类**
   - 只需检查该类的代码
   - 不会被其他代码干扰

3. **修改并验证**
   - 修改对应的操作类
   - 重新运行单元测试
   - 确认问题已解决

## 📝 开发规范

### 添加新功能
1. 确定功能归属的操作类
2. 在对应类中添加方法
3. 添加对应的单元测试
4. 运行测试验证

### 修改现有功能
1. 找到对应的操作类
2. 修改该类的方法
3. 运行对应的单元测试
4. 确认不影响其他功能

### 日志规范
所有操作都应该记录日志：
```javascript
this.tasklog({ 
  message: '操作描述', 
  logID: 'RG-Info-Operate' 
});
```

## 🔮 后续优化

1. **完善Captcha识别**
   - 集成AI识别服务
   - 提高识别准确率

2. **增加错误重试**
   - 网络错误自动重试
   - 页面加载超时重试

3. **优化等待逻辑**
   - 减少固定等待时间
   - 增加智能等待

4. **增加更多测试**
   - 集成测试
   - 端到端测试

## 📞 联系方式

如有问题或建议，请联系开发团队。
