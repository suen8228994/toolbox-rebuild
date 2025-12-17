/**
 * ============================================
 * Amazon Registration - 使用 refactored-backend 核心逻辑
 * ============================================
 * 
 * 完全基于原始 toolbox task.worker.js 提取的核心逻辑
 * 使用新创建的 AmazonRegisterCore 模块
 * 
 * 主要功能：
 * 1. 语言选择和Seller站点导航
 * 2. 完整的注册表单填写流程
 * 3. Captcha 自动解析（轮询+重试机制）
 * 4. 邮箱验证码轮询获取
 * 5. 多种注册状态处理（201/301/401）
 * 6. 2FA 绑定（自动/手动两种方式）
 * 7. TOTP 稳定性检查
 * 8. 完整的重试机制
 * 9. 地址绑定（可选）
 * 
 * 注意：核心逻辑在主进程中执行（使用 AmazonRegisterCore）
 * 前端通过 IPC 通信调用主进程执行注册
 */

// ============================================
// UI 控制层 - 不再包含核心注册逻辑
// ============================================

// 核心注册逻辑已移至：
// - src/utils/amazonRegisterCore.js (完整的注册流程)
// - src/refactored-backend/services/task/operations/RegisterOperations.js (原始逻辑)

// 简化的 Worker 类 - 仅用于前端UI
// 实际的注册逻辑在主进程中通过 AmazonRegisterCore 执行
class AmazonRegisterWorker {
    constructor(config) {
        this.config = config;
        this.accountInfo = null;
    }

    // 从email----password格式中提取邮箱和密码
    extractEmailPassword(emailLine) {
        if (emailLine && emailLine.includes('----')) {
            const parts = emailLine.split('----');
            return {
                email: parts[0].trim(),
                password: parts[1].trim()
            };
        }
        return {
            email: emailLine ? emailLine.trim() : null,
            password: null
        };
    }

}

// ============================================
// 注释：原始的完整注册逻辑已移至：
// - src/utils/amazonRegisterCore.js (核心逻辑)
// - src/refactored-backend/services/task/operations/RegisterOperations.js (原始参考)
// 
// 前端现在通过 IPC 调用主进程执行注册
// ============================================

// ============================================
// UI界面初始化
// ============================================

function initAmazonRegister() {
    console.log('🚀 初始化亚马逊注册模块（整合原始Toolbox脚本）');

    // UI元素
    const startBtn = document.getElementById('start-register-btn');
    const stopBtn = document.getElementById('stop-register-btn');
    const taskList = document.getElementById('task-list');
    const exportBtn = document.getElementById('export-accounts-btn');
    const exportFailedBtn = document.getElementById('export-failed-btn');
    const clearResultsBtn = document.getElementById('clear-register-results-btn');
    
    // 准备数据元素
    const phoneFileInput = document.getElementById('phone-data-file');
    const emailFileInput = document.getElementById('email-data-file');
    const proxyFileInput = document.getElementById('proxy-data-file');
    const generateProxyBtn = document.getElementById('generate-proxy-btn');
    const clearAllDataBtn = document.getElementById('clear-all-data-btn');
    const browserType = document.getElementById('browser-type');
    
    // 统计元素
    const statSuccess = document.getElementById('stat-success');
    const statFailed = document.getElementById('stat-failed');
    const statRunning = document.getElementById('stat-running');
    const statError = document.getElementById('stat-error');
    
    // 数据存储
    let phoneData = [];
    let emailData = [];
    let proxyData = [];
    let registeredAccounts = [];
    let failedAttempts = [];
    let tasks = [];
    let stats = {
        success: 0,
        failed: 0,
        running: 0,
        error: 0
    };

    // 更新统计信息
    function updateStats() {
        statSuccess.textContent = stats.success;
        statFailed.textContent = stats.failed;
        statRunning.textContent = stats.running;
        statError.textContent = stats.error;
    }

    // 更新数据计数
    function updateDataCount(type, count) {
        const countEl = document.getElementById(`${type}-count`);
        if (countEl) {
            countEl.textContent = count > 0 ? `已导入 ${count} 条` : '未导入';
            countEl.style.color = count > 0 ? '#38ef7d' : 'rgba(255, 255, 255, 0.6)';
        }
        
        // 更新注册数量显示（自动按邮箱数量）
        if (type === 'email') {
            const registerCountDisplay = document.getElementById('register-count-display');
            if (registerCountDisplay) {
                registerCountDisplay.value = count;
            }
        }
    }

    // 添加任务到列表
    function addTask(taskData) {
        tasks.push(taskData);
        renderTaskList();
    }

    // 渲染任务列表
    function renderTaskList() {
        if (tasks.length === 0) {
            taskList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
                    <div style="font-size: 14px;">暂无任务</div>
                </div>
            `;
            return;
        }

        taskList.innerHTML = tasks.map((task, index) => `
            <div style="background: white; border-radius: 6px; padding: 12px; margin-bottom: 8px; border-left: 4px solid ${task.status === 'success' ? '#38ef7d' : task.status === 'failed' ? '#eb3349' : task.status === 'running' ? '#4facfe' : '#fa709a'}; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="font-size: 13px; font-weight: 600; color: #333;">
                        ${task.status === 'success' ? '✅' : task.status === 'failed' ? '❌' : task.status === 'running' ? '⏳' : '⚠️'}
                        ${task.email || '未知邮箱'}
                    </div>
                    <div style="font-size: 11px; color: #999;">${new Date(task.time).toLocaleTimeString()}</div>
                </div>
                <div style="font-size: 12px; color: #666;">${task.message || task.account || task.error || ''}</div>
                ${task.otp ? `<div style="font-size: 11px; color: #999; margin-top: 4px;">🔐 2FA: ${task.otp}</div>` : ''}
            </div>
        `).join('');
    }

    // 文件上传处理
    const handleFileUpload = (input, dataArray, type) => {
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const lines = event.target.result.split('\n').filter(line => line.trim());
                    if (type === 'phone') phoneData = lines;
                    else if (type === 'email') emailData = lines;
                    else if (type === 'proxy') proxyData = lines;
                    updateDataCount(type, lines.length);
                    console.log(`✅ ${type}数据导入成功: ${lines.length}条`);
                };
                reader.readAsText(file);
            }
        });
    };

    handleFileUpload(phoneFileInput, phoneData, 'phone');
    handleFileUpload(emailFileInput, emailData, 'email');
    handleFileUpload(proxyFileInput, proxyData, 'proxy');

    // 清空所有数据
    clearAllDataBtn.addEventListener('click', () => {
        phoneData = [];
        emailData = [];
        proxyData = [];
        phoneFileInput.value = '';
        emailFileInput.value = '';
        proxyFileInput.value = '';
        updateDataCount('phone', 0);
        updateDataCount('email', 0);
        updateDataCount('proxy', 0);
        // 清空注册数量显示
        const registerCountDisplay = document.getElementById('register-count-display');
        if (registerCountDisplay) {
            registerCountDisplay.value = '0';
        }
        console.log('🗑️ 所有数据已清空');
    });

    // 代理生成按钮
    generateProxyBtn.addEventListener('click', () => {
        // 打开代理生成工具
        const modal = document.querySelector('.modal');
        if (modal && window.openToolModal) {
            window.openToolModal('proxy-generation');
        }
    });

    // 清空结果
    clearResultsBtn.addEventListener('click', () => {
        tasks = [];
        registeredAccounts = [];
        failedAttempts = [];
        stats = { success: 0, failed: 0, running: 0, error: 0 };
        updateStats();
        renderTaskList();
        console.log('🗑️ 注册结果已清空');
    });

    // 注册队列管理
    let registerQueue = [];
    let isRunning = false;

    // 执行单个注册任务（使用原始Toolbox逻辑）
    async function executeRegister(config) {
        try {
            // 通过 IPC 调用主进程启动浏览器
            console.log('[Register] 准备启动浏览器...');
            console.log('[Register] 配置:', config);
            
            // 使用 window.amazonBrowserAPI 调用主进程
            const browserResult = await window.amazonBrowserAPI.launchBrowser({
                platformClient: config.platformClient,
                args: config.args || [],
                cache: config.cache,
                arrange: config.arrange,
                proxy: config.proxy || ''  // 传递代理配置
            });
            
            if (!browserResult.success) {
                throw new Error(browserResult.error || '启动浏览器失败');
            }
            
            // 保存 containerCode 到 config，用于失败时删除环境
            config.containerCode = browserResult.containerCode;
            
            console.log('[Register] 浏览器启动成功');
            console.log('[Register] containerCode:', browserResult.containerCode);
            console.log('[Register] 开始注册Amazon账号...');
            
            // 执行注册脚本 - 传递完整配置给主进程
            const registerResult = await window.amazonBrowserAPI.executeRegisterScript({
                // 账号信息
                emailLine: config.emailLine,
                password: config.password,
                
                // 站点
                site: config.site || 'com',
                
                // Captcha配置
                captchaApiKey: config.captchaApiKey,
                
                // 邮箱验证配置
                emailServiceType: config.emailServiceType || 'microsoft',
                
                // 2FA配置
                enable2FA: config.enable2FA,
                enable2FAManual: config.enable2FAManual,
                
                // 地址绑定
                bindAddress: config.bindAddress,
                
                // 手机号
                phone: config.phone,
                
                // 密码规则
                passwordRule: config.passwordRule
            });
            
            if (!registerResult.success) {
                throw new Error(registerResult.error || registerResult.message || '注册失败');
            }
            
            console.log('[Register] 注册脚本执行成功:', registerResult.message);
            
            const result = {
                success: true,
                account: {
                    email: config.emailLine,
                    password: config.password || 'default_password',
                    createdAt: new Date().toISOString()
                },
                containerCode: browserResult.containerCode
            };
            
            // 注册成功，关闭浏览器但不删除环境（可选）
            // 如果配置了注册成功后不保留环境，可以在这里删除
            console.log('[Register] 注册完成');
            
            return result;
            
        } catch (error) {
            // 注册失败，根据配置决定是否删除环境
            if (config.failedDeleteEnvironment) {
                await cleanupEnvironmentOnFailure(config, error);
            }
            
            return {
                success: false,
                error: error.message,
                account: config
            };
        }
    }

    // 注册失败时清理环境
    async function cleanupEnvironmentOnFailure(config, error) {
        try {
            console.log('🗑️ 注册失败，开始清理环境...');
            
            // 如果有 containerCode，删除环境
            if (config.containerCode) {
                console.log(`正在删除环境: ${config.containerCode}`);
                const deleteResult = await window.amazonBrowserAPI.deleteContainer(config.containerCode);
                if (deleteResult.success) {
                    console.log('✅ 环境删除成功');
                } else {
                    console.warn('⚠️ 环境删除失败:', deleteResult.error);
                }
            } else {
                console.warn('⚠️ 没有 containerCode，跳过环境删除');
            }
            
        } catch (cleanupError) {
            console.warn('⚠️ 环境清理失败:', cleanupError.message);
        }
    }

    // 批量注册处理
    async function processBatchRegister() {
        while (registerQueue.length > 0 && isRunning) {
            const task = registerQueue.shift();
            
            try {
                console.log(`🔄 开始注册任务 ${task.index}/${task.total}`);
                
                const result = await executeRegister(task.config);
                
                stats.running--;
                
                const taskData = {
                    time: Date.now(),
                    email: result.account?.email || (task.config.emailLine ? task.config.emailLine.split('----')[0] : '未知'),
                    status: result.success ? 'success' : 'failed'
                };
                
                if (result.success) {
                    stats.success++;
                    registeredAccounts.push(result.account);
                    taskData.account = `${result.account.email}----${result.account.password}`;
                    taskData.message = '注册成功 ✅';
                    if (result.account.otpSecret) {
                        taskData.otp = result.account.otpSecret;
                    }
                } else {
                    stats.failed++;
                    failedAttempts.push({
                        email: result.account?.email || (task.config.emailLine ? task.config.emailLine.split('----')[0] : '未知'),
                        error: result.error
                    });
                    taskData.error = result.error || '注册失败';
                }
                
                addTask(taskData);
                updateStats();
                
            } catch (error) {
                console.error('❌ 任务执行错误:', error);
                stats.running--;
                stats.error++;
                
                addTask({
                    time: Date.now(),
                    email: task.config.emailLine ? task.config.emailLine.split('----')[0] : '未知',
                    status: 'error',
                    error: error.message
                });
                
                updateStats();
            }
            
            // 任务间隔（使用配置的操作延迟）
            const delaySeconds = parseInt(task.config.operationDelay || 3);
            await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000 + Math.random() * 2000));
        }
        
        // 所有任务完成
        if (registerQueue.length === 0) {
            finishRegister();
        }
    }

    function finishRegister() {
        isRunning = false;
        startBtn.disabled = false;
        startBtn.style.opacity = '1';
        startBtn.style.cursor = 'pointer';
        stopBtn.disabled = true;
        stopBtn.style.opacity = '0.5';
        stopBtn.style.cursor = 'not-allowed';
        stopBtn.style.background = '#6c757d';
        
        stats.running = 0;
        updateStats();
        
        console.log('🎉 亚马逊注册完成', {
            success: stats.success,
            failed: stats.failed,
            error: stats.error,
            total: stats.success + stats.failed + stats.error
        });
        
        addTask({
            time: Date.now(),
            email: '批量任务',
            status: 'success',
            message: `🎉 注册完成！成功: ${stats.success} | 失败: ${stats.failed} | 错误: ${stats.error} | 总计: ${stats.success + stats.failed + stats.error}`
        });
    }

    startBtn.addEventListener('click', async () => {
        const browser = browserType.value;
        
        // 读取常规设置（使用原始toolbox的字段名）
        const platformClient = document.getElementById('task-platform').value;  // 原始: platformClient
        const complicating = parseInt(document.getElementById('concurrent-count').value);  // 原始: complicating (并发数量统一使用这个)
        
        // 读取启动参数（多选下拉框）- 原始: args
        const launchParamsSelect = document.getElementById('launch-params');
        const args = Array.from(launchParamsSelect.selectedOptions).map(opt => opt.value).filter(v => v);
        
        // 读取密码规则 - 原始: passwordRule
        const passwordRule = document.getElementById('password-source').value;  // email-password 或 username-matching
        
        // 读取开关设置（原始toolbox字段名）
        const cache = document.getElementById('enable-cache').checked;  // 原始: cache
        const arrange = document.getElementById('auto-arrange').checked;  // 原始: arrange
        const failedDeleteEnvironment = document.getElementById('delete-on-failure').checked;  // 原始: failedDeleteEnvironment
        const bindAddress = document.getElementById('bind-address').checked;  // 原始: bindAddress
        
        // 读取Amazon配置项
        const amazonSite = document.getElementById('amazon-site').value;
        const enable2FA = document.getElementById('enable-2fa').value;
        const emailServiceType = document.getElementById('email-service-type').value;
        const operationDelay = document.getElementById('operation-delay').value;
        const captchaApiKey = document.getElementById('captcha-api-key').value.trim();

        // 数据验证 - 注册数按邮箱数量
        if (emailData.length === 0) {
            alert('❌ 请先导入邮箱数据\n\n格式: email----password\n例如: test@gmail.com----Password123');
            return;
        }

        if (proxyData.length === 0) {
            alert('❌ 请先导入代理数据');
            return;
        }

        // 注册数量按邮箱数量为准
        const count = emailData.length;

        // UI更新
        startBtn.disabled = true;
        startBtn.style.opacity = '0.5';
        startBtn.style.cursor = 'not-allowed';
        stopBtn.disabled = false;
        stopBtn.style.opacity = '1';
        stopBtn.style.cursor = 'pointer';
        stopBtn.style.background = 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)';
        
        // 重置统计
        registeredAccounts = [];
        failedAttempts = [];
        stats = { success: 0, failed: 0, running: 0, error: 0 };
        stats.running = count;
        updateStats();

        console.log('🚀 开始亚马逊批量注册（完整Toolbox逻辑+新配置）', { 
            count, 
            complicating,  // 并发数量（9999=自适应，1-20=指定值）
            browser,
            platformClient,
            args,
            amazonSite,
            enable2FA,
            emailServiceType,
            operationDelay,
            bindAddress,
            failedDeleteEnvironment,
            proxyCount: proxyData.length 
        });

        // 生成注册队列
        registerQueue = [];
        isRunning = true;
        
        for (let i = 0; i < count; i++) {
            const proxy = proxyData[i % proxyData.length];
            const emailLine = emailData[i]; // 格式: email----password
            const phone = phoneData.length > 0 ? phoneData[i % phoneData.length] : null;
            
            registerQueue.push({
                index: i + 1,
                total: count,
                config: {
                    proxy,
                    emailLine, // 使用完整的email----password格式
                    phone,
                    browser,
                    // 常规设置（原始toolbox字段名）
                    platformClient: platformClient,      // 任务平台
                    complicating: complicating,          // 并发数量
                    args: args,                          // 启动参数数组
                    passwordRule: passwordRule,          // 密码规则
                    cache: cache,                        // 是否缓存
                    arrange: arrange,                    // 自动排列
                    failedDeleteEnvironment: failedDeleteEnvironment,  // 失败删除环境
                    bindAddress: bindAddress,            // 绑定地址
                    // Amazon配置项
                    site: amazonSite,
                    enable2FA: enable2FA,
                    emailServiceType: emailServiceType,
                    operationDelay: operationDelay,
                    captchaApiKey: captchaApiKey
                }
            });
        }

        // 启动多线程处理（使用配置的并发数量）
        // complicating: 9999表示自适应（使用默认值4），否则使用指定的并发数
        const defaultThreads = 4;  // 默认并发数
        const actualThreads = complicating === 9999 ? defaultThreads : complicating;
        const promises = [];
        for (let i = 0; i < Math.min(actualThreads, count); i++) {
            promises.push(processBatchRegister());
        }
        
        console.log(`🔄 启动 ${Math.min(actualThreads, count)} 个并发任务 (complicating: ${complicating === 9999 ? '自适应=' + actualThreads : complicating})`);
        
        await Promise.all(promises);
    });

    stopBtn.addEventListener('click', () => {
        isRunning = false;
        registerQueue = [];
        
        startBtn.disabled = false;
        startBtn.style.opacity = '1';
        startBtn.style.cursor = 'pointer';
        stopBtn.disabled = true;
        stopBtn.style.opacity = '0.5';
        stopBtn.style.cursor = 'not-allowed';
        stopBtn.style.background = '#6c757d';
        stats.running = 0;
        updateStats();
        
        console.log('⏸️ 已停止注册（队列清空）');
        
        addTask({
            time: Date.now(),
            email: '系统消息',
            status: 'error',
            message: '⏸️ 用户手动停止注册任务'
        });
    });

    // 导出成功账号
    exportBtn.addEventListener('click', () => {
        if (registeredAccounts.length === 0) {
            alert('没有可导出的账号');
            return;
        }

        const content = registeredAccounts.map(acc => {
            let line = `${acc.email}----${acc.password}`;
            if (acc.otpSecret) {
                line += `----${acc.otpSecret}`;
            }
            return line;
        }).join('\n');
        
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `amazon_accounts_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('📥 成功账号已导出');
    });

    // 导出失败记录
    exportFailedBtn.addEventListener('click', () => {
        if (failedAttempts.length === 0) {
            alert('没有失败记录可导出');
            return;
        }

        const content = failedAttempts.map(item => `${item.email}----${item.error}`).join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `amazon_failed_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('📥 失败记录已导出');
    });

    // 上传区域hover效果
    document.querySelectorAll('.upload-zone').forEach(zone => {
        zone.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(255, 255, 255, 0.2)';
            this.style.borderColor = 'rgba(255, 255, 255, 0.6)';
        });
        zone.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(255, 255, 255, 0.1)';
            this.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        });
    });

    // 初始化
    updateStats();
    renderTaskList();
    console.log('✅ 亚马逊注册模块初始化完成（完整Toolbox逻辑+新配置）');
    console.log('📋 功能说明:');
    console.log('  ✅ 使用邮箱密码作为Amazon密码（格式: email----password）');
    console.log('  ✅ 注册数量按邮箱数量自动确定');
    console.log('  ✅ 支持多个Amazon站点选择（美国、英国、德国等）');
    console.log('  ✅ 支持2FA自动绑定（可选）');
    console.log('  ✅ 支持邮箱验证码自动获取（Microsoft Graph / IMAP）');
    console.log('  ✅ 支持Captcha自动识别（需要API Key）');
    console.log('  ✅ 完整的原始Toolbox注册逻辑');
}

// 导出到全局
window.initAmazonRegister = initAmazonRegister;
