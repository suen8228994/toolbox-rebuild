// 模块：Hotmail批量注册工具
// 独立模块，避免影响其他功能

class HotmailBatchRegisterModule {
    constructor() {
        this.isRunning = false;
        this.successAccounts = [];
        this.totalCount = 0;
        this.successCount = 0;
        this.failedCount = 0;
        this.tokenCount = 0;
        
        // DOM元素将在init时绑定
        this.elements = {};
    }
    
    /**
     * 初始化模块
     */
    init(containerElement) {
        console.log('=== HotmailBatchRegisterModule 初始化 ===');
        
        // 绑定DOM元素
        this.elements = {
            btnStart: containerElement.querySelector('#btn-start-batch-register'),
            btnStop: containerElement.querySelector('#btn-stop-batch-register'),
            btnExport: containerElement.querySelector('#btn-export-tokens'),
            btnClear: containerElement.querySelector('#btn-clear-hotmail-results'),
            resultsDiv: containerElement.querySelector('#hotmail-register-results'),
            successListDiv: containerElement.querySelector('#hotmail-success-list'),
            countInput: containerElement.querySelector('#hotmail-register-count'),
            threadsInput: containerElement.querySelector('#hotmail-threads'),
            domainSelect: containerElement.querySelector('#hotmail-domain'),
            clientIdInput: containerElement.querySelector('#hotmail-client-id')
        };
        
        // 绑定事件
        this.bindEvents();
        
        console.log('HotmailBatchRegisterModule 初始化完成');
    }
    
    /**
     * 绑定事件监听器
     */
    bindEvents() {
        this.elements.btnClear.addEventListener('click', () => this.clearResults());
        this.elements.btnExport.addEventListener('click', () => this.exportTokens());
        this.elements.btnStart.addEventListener('click', () => this.startBatchRegister());
        this.elements.btnStop.addEventListener('click', () => this.stopBatchRegister());
    }
    
    /**
     * 更新统计数据
     */
    updateStats() {
        document.getElementById('hotmail-total-count').textContent = `总数: ${this.totalCount}`;
        document.getElementById('hotmail-success-count').textContent = `成功: ${this.successCount}`;
        document.getElementById('hotmail-failed-count').textContent = `失败: ${this.failedCount}`;
        document.getElementById('hotmail-token-count').textContent = `已获取Token: ${this.tokenCount}`;
    }
    
    /**
     * 添加日志
     */
    addLog(message, type = 'info') {
        const logItem = document.createElement('div');
        logItem.style.padding = '6px 8px';
        logItem.style.marginBottom = '4px';
        logItem.style.borderRadius = '3px';
        logItem.style.fontSize = '13px';
        logItem.style.borderLeft = '3px solid';
        
        const colors = {
            info: { bg: '#e3f2fd', border: '#2196F3', color: '#1976D2' },
            success: { bg: '#e8f5e9', border: '#4CAF50', color: '#388E3C' },
            error: { bg: '#ffebee', border: '#f44336', color: '#D32F2F' },
            warning: { bg: '#fff3e0', border: '#ff9800', color: '#F57C00' }
        };
        
        const style = colors[type] || colors.info;
        logItem.style.backgroundColor = style.bg;
        logItem.style.borderLeftColor = style.border;
        logItem.style.color = style.color;
        logItem.innerHTML = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        this.elements.resultsDiv.appendChild(logItem);
        this.elements.resultsDiv.scrollTop = this.elements.resultsDiv.scrollHeight;
    }
    
    /**
     * 添加成功账号到列表
     */
    addSuccessAccount(account) {
        const item = document.createElement('div');
        item.style.padding = '8px';
        item.style.marginBottom = '5px';
        item.style.backgroundColor = '#fff';
        item.style.borderRadius = '3px';
        item.style.fontSize = '12px';
        item.style.borderLeft = '3px solid #4CAF50';
        item.innerHTML = `<strong>${account.email}</strong><br>` +
            `<small>密码: ${account.password}</small><br>` +
            `<small style="color: #666;">Token: ${account.refreshToken ? account.refreshToken.substring(0, 30) + '...' : '未获取'}</small>`;
        this.elements.successListDiv.appendChild(item);
    }
    
    /**
     * 清空结果
     */
    clearResults() {
        this.elements.resultsDiv.innerHTML = '';
        this.elements.successListDiv.innerHTML = '';
        this.successAccounts = [];
        this.totalCount = 0;
        this.successCount = 0;
        this.failedCount = 0;
        this.tokenCount = 0;
        this.updateStats();
    }
    
    /**
     * 导出Token文件
     */
    exportTokens() {
        if (this.successAccounts.length === 0) {
            alert('没有可导出的账号');
            return;
        }
        
        const content = this.successAccounts
            .filter(acc => acc.refreshToken)
            .map(acc => `${acc.email}|${acc.clientId}|${acc.refreshToken}`)
            .join('\n');
        
        if (!content) {
            alert('没有已获取Token的账号');
            return;
        }
        
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hotmail_tokens_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    /**
     * 停止批量注册
     */
    stopBatchRegister() {
        this.isRunning = false;
        this.elements.btnStart.disabled = false;
        this.elements.btnStop.disabled = true;
        this.addLog('用户手动停止', 'warning');
    }
    
    /**
     * 开始批量注册（主流程）
     */
    async startBatchRegister() {
        if (this.isRunning) return;
        
        console.log('开始批量注册');
        
        // 获取配置
        const count = parseInt(this.elements.countInput.value);
        const threads = parseInt(this.elements.threadsInput.value);
        const domain = this.elements.domainSelect.value;
        const clientId = this.elements.clientIdInput.value.trim();
        
        // 验证输入
        if (!clientId) {
            alert('请输入Client ID');
            return;
        }
        
        if (count < 1 || count > 20) {
            alert('注册数量必须在1-20之间');
            return;
        }
        
        // 检查API
        if (!window.playwrightRegisterAPI || !window.oauthAutomationAPI || !window.emailDatabaseAPI) {
            alert('API未加载，请刷新页面重试');
            console.error('API状态:', { 
                playwrightRegisterAPI: !!window.playwrightRegisterAPI,
                oauthAutomationAPI: !!window.oauthAutomationAPI,
                emailDatabaseAPI: !!window.emailDatabaseAPI
            });
            return;
        }
        
        // 生成代理
        this.addLog('正在自动生成代理...', 'info');
        let proxies = [];
        try {
            // 使用页面选择的代理国家（如果有）或随机选择
            const countryEl = document.getElementById('proxy-country');
            let country = countryEl ? countryEl.value : undefined;
            if (country === 'RANDOM') {
                const countries = ['IN','ID','JP','KR','HK','PH','SG','VN','MM','TH','MY','TW','KP','BD','BT','MV','NP','PK','LK','BH','KW','OM','SE','QA','SA','AE','YE','CY','IQ','IL','JO','LB','PS','SY','AF','AM','AZ','IR','TR','KZ','KG','TJ','TM','UZ','GE','TL','MO','GB','FR','RU','IT','DE','LU','BY','BE','AT','ES','IE','FI','VA','PT','LV','PL','LT','HU','MD','NL','CH','MC','CZ','NO','IS','GR','MT','EE','UA','HR','US','CA','JM','LC','MX','PA','BR','AR','CO','CL','VE','PE','NZ','PW','AU','MG','MZ','ZA','ET','KE','GH','NG','DZ'];
                country = countries[Math.floor(Math.random() * countries.length)];
            }

            const opts = { quantity: count, prefix: 'rZwC7qlCe8', password: '52572596' };
            if (country) opts.country = country;

            proxies = await window.proxyGeneratorAPI.generateProxies(opts);
            this.addLog(`成功生成 ${proxies.length} 个代理`, 'success');
        } catch (error) {
            this.addLog(`代理生成失败: ${error.message}`, 'warning');
            proxies = [];
        }
        
        // 设置状态
        this.isRunning = true;
        this.elements.btnStart.disabled = true;
        this.elements.btnStop.disabled = false;
        
        // 重置统计
        this.successAccounts = [];
        this.totalCount = count;
        this.successCount = 0;
        this.failedCount = 0;
        this.tokenCount = 0;
        this.updateStats();
        
        this.addLog(`开始批量注册 ${count} 个 @${domain} 邮箱`, 'info');
        this.addLog(`并发数: ${threads}`, 'info');
        if (proxies.length > 0) {
            this.addLog(`代理数: ${proxies.length}`, 'info');
        }
        
        try {
            // 初始化数据库
            await window.emailDatabaseAPI.init();
            
            // 创建任务
            const taskId = await window.emailDatabaseAPI.createTask({
                quantity: count,
                config: JSON.stringify({ domain, threads, clientId })
            });
            
            this.addLog(`任务ID: ${taskId}`, 'info');
            
            // ==================== 阶段1：注册 ====================
            await this.runRegistrationPhase(count, threads, domain, proxies);
            
            // ==================== 阶段2：授权 ====================
            await this.runAuthorizationPhase(clientId);
            
            // ==================== 完成 ====================
            await this.finishTask(taskId);
            
        } catch (error) {
            this.addLog(`执行失败: ${error.message}`, 'error');
            console.error('批量注册错误:', error);
        } finally {
            this.isRunning = false;
            this.elements.btnStart.disabled = false;
            this.elements.btnStop.disabled = true;
        }
    }
    
    /**
     * 阶段1：批量注册
     */
    async runRegistrationPhase(count, threads, domain, proxies) {
        this.addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
        this.addLog('📝 第一阶段：Playwright自动化注册', 'info');
        this.addLog('⏱️ 每个窗口注册3个账号，请手动完成验证', 'warning');
        
        const registerResults = await window.playwrightRegisterAPI.batchRegister({
            quantity: count,
            concurrency: threads,
            proxies: proxies,
            domain: domain,
            
            onProgress: (progress) => {
                const typeMap = {
                    'start': 'info',
                    'info': 'info',
                    'success': 'success',
                    'error': 'error',
                    'warning': 'warning'
                };
                
                const logType = typeMap[progress.type] || 'info';
                
                if (progress.email) {
                    if (progress.step) {
                        this.addLog(`  [${progress.email}] ${progress.step}: ${progress.message}`, logType);
                    } else {
                        this.addLog(`  ${progress.message}`, logType);
                    }
                } else {
                    this.addLog(progress.message, logType);
                }
            },
            
            onComplete: (summary) => {
                this.addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
                this.addLog('注册阶段完成！', 'success');
                this.addLog(`成功: ${summary.success} | 失败: ${summary.fail}`, 'info');
            }
        });
        
        // 处理注册结果
        for (const result of registerResults) {
            if (result.success) {
                this.successCount++;
                this.successAccounts.push({
                    email: result.email,
                    password: result.password,
                    data: result.data,
                    clientId: null,
                    refreshToken: null
                });
                this.addLog(`注册成功: ${result.email}`, 'success');
            } else {
                this.failedCount++;
                this.addLog(`注册失败: ${result.email || '未知'} - ${result.error || result.message}`, 'error');
            }
            this.updateStats();
        }
    }
    
    /**
     * 阶段2：OAuth授权
     */
    async runAuthorizationPhase(clientId) {
        if (this.successAccounts.length === 0) {
            this.addLog('没有成功注册的账号，跳过授权阶段', 'warning');
            return;
        }
        
        this.addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
        this.addLog(`🔑 第二阶段：自动化OAuth授权 (${this.successAccounts.length}个账号)`, 'info');
        this.addLog('⏱️ 每个账号需要15-30秒...', 'warning');
        
        const authResults = await window.oauthAutomationAPI.batchAutomateAuth(
            this.successAccounts.map(acc => ({
                email: acc.email,
                password: acc.password
            })),
            clientId,
            {
                concurrency: 1,  // 授权串行执行
                onProgress: (progress) => {
                    const typeMap = {
                        'start': 'info',
                        'info': 'info',
                        'success': 'success',
                        'error': 'error',
                        'progress': 'info'
                    };
                    
                    const logType = typeMap[progress.type] || 'info';
                    
                    if (progress.email) {
                        if (progress.step) {
                            this.addLog(`  [${progress.email}] ${progress.step}: ${progress.message}`, logType);
                        } else {
                            this.addLog(`  ${progress.message}`, logType);
                        }
                    } else {
                        this.addLog(progress.message, logType);
                    }
                },
                onComplete: (summary) => {
                    this.addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
                    this.addLog('授权阶段完成！', 'success');
                    this.addLog(`成功: ${summary.success} | 失败: ${summary.fail}`, 'info');
                }
            }
        );
        
        // 保存授权结果
        for (const authResult of authResults) {
            if (authResult.success) {
                this.tokenCount++;
                
                // 更新本地账号对象
                const account = this.successAccounts.find(a => a.email === authResult.email);
                if (account) {
                    account.clientId = clientId;
                    account.refreshToken = authResult.refreshToken;
                    account.accessToken = authResult.accessToken;
                }
                
                // 保存到数据库
                await window.emailDatabaseAPI.saveAccount({
                    email: authResult.email,
                    password: account.password,
                    refresh_token: authResult.refreshToken,
                    access_token: authResult.accessToken,
                    is_authorized: 1,
                    is_used: 0
                });
                
                // 添加到成功列表
                this.addSuccessAccount(account);
                
                this.addLog(`已保存: ${authResult.email} (Token: ${authResult.refreshToken.substring(0, 20)}...)`, 'success');
            }
        }
        
        this.updateStats();
    }
    
    /**
     * 完成任务
     */
    async finishTask(taskId) {
        await window.emailDatabaseAPI.updateTask(taskId, {
            end_time: new Date().toISOString(),
            status: 'completed',
            success_count: this.successCount,
            fail_count: this.failedCount
        });
        
        this.addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
        this.addLog('全部完成！', 'success');
        this.addLog('最终统计:', 'info');
        this.addLog(`   注册成功: ${this.successCount}`, 'success');
        this.addLog(`   注册失败: ${this.failedCount}`, 'error');
        this.addLog(`   已获取Token: ${this.tokenCount}`, 'success');
    }
}

// 导出模块
window.HotmailBatchRegisterModule = HotmailBatchRegisterModule;
