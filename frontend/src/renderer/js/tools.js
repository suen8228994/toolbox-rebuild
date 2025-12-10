// Tool definitions and content generator
const toolDefinitions = {
    'amazon-check-live': {
        title: '🔍 亚马逊批量测活',
        html: `
            <div class="tool-content">
                <div class="section">
                    <label>账号文件 (格式: email----password 或上传文件)</label>
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <input type="file" id="account-file-input" accept=".txt" style="flex: 1;">
                        <button id="clear-accounts-btn" class="secondary-btn">清空</button>
                    </div>
                    <textarea id="accounts-input" rows="10" placeholder="email1----password1&#10;email2----password2&#10;..."></textarea>
                    <div style="margin-top: 5px; color: #666; font-size: 12px;">
                        <span id="account-count">账号数量: 0</span>
                    </div>
                </div>
                
                <div class="section">
                    <label>代理配置</label>
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <select id="proxy-type" style="flex: 1;">
                            <option value="none">不使用代理</option>
                            <option value="http">HTTP代理</option>
                            <option value="socks5">SOCKS5代理</option>
                        </select>
                        <input type="file" id="proxy-file-input" accept=".txt" style="flex: 1;">
                    </div>
                    <textarea id="proxy-input" rows="4" placeholder="代理格式: host:port:username:password&#10;每行一个代理"></textarea>
                    <div style="margin-top: 5px; color: #666; font-size: 12px;">
                        <span id="proxy-count">代理数量: 0</span>
                    </div>
                </div>

                <div class="section">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <label>并发数量</label>
                            <input type="number" id="thread-count" value="5" min="1" max="50">
                        </div>
                        <div>
                            <label>超时时间(秒)</label>
                            <input type="number" id="timeout-seconds" value="30" min="10" max="120">
                        </div>
                        <div>
                            <label>重试次数</label>
                            <input type="number" id="retry-count" value="2" min="0" max="5">
                        </div>
                        <div>
                            <label>延迟(毫秒)</label>
                            <input type="number" id="delay-ms" value="1000" min="0" max="10000" step="100">
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button id="start-check-btn" class="primary-btn">开始测活</button>
                        <button id="stop-check-btn" class="secondary-btn" disabled>停止</button>
                        <button id="export-alive-btn" class="secondary-btn">导出存活账号</button>
                        <button id="export-dead-btn" class="secondary-btn">导出失效账号</button>
                        <button id="clear-results-btn" class="secondary-btn">清空结果</button>
                    </div>
                </div>

                <div class="section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h4>测活结果</h4>
                        <div style="font-size: 12px; color: #666;">
                            <span id="alive-count" style="color: #4CAF50;">存活: 0</span> |
                            <span id="dead-count" style="color: #f44336;">失效: 0</span> |
                            <span id="total-checked">已检测: 0</span>
                        </div>
                    </div>
                    <div id="check-results" class="results-container" style="max-height: 400px; overflow-y: auto;"></div>
                </div>
            </div>

            <script>
                (function() {
                    const startBtn = document.getElementById('start-check-btn');
                    const stopBtn = document.getElementById('stop-check-btn');
                    const resultsDiv = document.getElementById('check-results');
                    const accountsInput = document.getElementById('accounts-input');
                    const accountFileInput = document.getElementById('account-file-input');
                    const proxyFileInput = document.getElementById('proxy-file-input');
                    const proxyInput = document.getElementById('proxy-input');
                    const clearAccountsBtn = document.getElementById('clear-accounts-btn');
                    const exportAliveBtn = document.getElementById('export-alive-btn');
                    const exportDeadBtn = document.getElementById('export-dead-btn');
                    const clearResultsBtn = document.getElementById('clear-results-btn');
                    
                    let isRunning = false;
                    let aliveAccounts = [];
                    let deadAccounts = [];
                    let aliveCount = 0;
                    let deadCount = 0;
                    let totalChecked = 0;

                    // 更新账号数量
                    function updateAccountCount() {
                        const count = accountsInput.value.trim().split('\\n').filter(line => line.trim()).length;
                        document.getElementById('account-count').textContent = \`账号数量: \${count}\`;
                    }

                    // 更新代理数量
                    function updateProxyCount() {
                        const count = proxyInput.value.trim().split('\\n').filter(line => line.trim()).length;
                        document.getElementById('proxy-count').textContent = \`代理数量: \${count}\`;
                    }

                    // 更新统计信息
                    function updateStats() {
                        document.getElementById('alive-count').textContent = \`存活: \${aliveCount}\`;
                        document.getElementById('dead-count').textContent = \`失效: \${deadCount}\`;
                        document.getElementById('total-checked').textContent = \`已检测: \${totalChecked}\`;
                    }

                    accountsInput.addEventListener('input', updateAccountCount);
                    proxyInput.addEventListener('input', updateProxyCount);

                    // 账号文件上传
                    accountFileInput.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                accountsInput.value = event.target.result;
                                updateAccountCount();
                            };
                            reader.readAsText(file);
                        }
                    });

                    // 代理文件上传
                    proxyFileInput.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                proxyInput.value = event.target.result;
                                updateProxyCount();
                            };
                            reader.readAsText(file);
                        }
                    });

                    // 清空账号
                    clearAccountsBtn.addEventListener('click', () => {
                        accountsInput.value = '';
                        accountFileInput.value = '';
                        updateAccountCount();
                    });

                    // 清空结果
                    clearResultsBtn.addEventListener('click', () => {
                        resultsDiv.innerHTML = '';
                        aliveAccounts = [];
                        deadAccounts = [];
                        aliveCount = 0;
                        deadCount = 0;
                        totalChecked = 0;
                        updateStats();
                    });

                    startBtn.addEventListener('click', async () => {
                        const accounts = accountsInput.value.trim();
                        const proxyType = document.getElementById('proxy-type').value;
                        const proxies = proxyInput.value.trim();
                        const threads = parseInt(document.getElementById('thread-count').value);
                        const timeout = parseInt(document.getElementById('timeout-seconds').value);
                        const retry = parseInt(document.getElementById('retry-count').value);
                        const delay = parseInt(document.getElementById('delay-ms').value);

                        if (!accounts) {
                            alert('请输入账号信息');
                            return;
                        }

                        isRunning = true;
                        startBtn.disabled = true;
                        stopBtn.disabled = false;
                        resultsDiv.innerHTML = '<p style="color: #2196F3;">⏳ 正在检测账号...</p>';
                        
                        // 重置统计
                        aliveAccounts = [];
                        deadAccounts = [];
                        aliveCount = 0;
                        deadCount = 0;
                        totalChecked = 0;
                        updateStats();

                        try {
                            window.appSocket.emit('request.amazon.checkLive', {
                                accounts: accounts.split('\\n').filter(line => line.trim()),
                                proxyType: proxyType,
                                proxies: proxies ? proxies.split('\\n').filter(line => line.trim()) : [],
                                threads: threads,
                                timeout: timeout * 1000,
                                retry: retry,
                                delay: delay
                            });

                            // 清除之前的监听器
                            window.appSocket.off('backend.amazon.checkResult');
                            window.appSocket.off('backend.amazon.checkComplete');

                            window.appSocket.on('backend.amazon.checkResult', (data) => {
                                totalChecked++;
                                const resultItem = document.createElement('div');
                                resultItem.style.padding = '8px';
                                resultItem.style.marginBottom = '5px';
                                resultItem.style.borderRadius = '4px';
                                resultItem.style.fontSize = '13px';
                                
                                if (data.isAlive) {
                                    aliveCount++;
                                    aliveAccounts.push(data.account);
                                    resultItem.style.backgroundColor = '#e8f5e9';
                                    resultItem.style.borderLeft = '3px solid #4CAF50';
                                    resultItem.innerHTML = \`<strong style="color: #4CAF50;">✓ 存活</strong> \${data.account}\`;
                                } else {
                                    deadCount++;
                                    deadAccounts.push(data.account);
                                    resultItem.style.backgroundColor = '#ffebee';
                                    resultItem.style.borderLeft = '3px solid #f44336';
                                    resultItem.innerHTML = \`<strong style="color: #f44336;">✗ 失效</strong> \${data.account}\${data.message ? \` - \${data.message}\` : ''}\`;
                                }
                                
                                resultsDiv.appendChild(resultItem);
                                resultsDiv.scrollTop = resultsDiv.scrollHeight;
                                updateStats();
                            });

                            window.appSocket.on('backend.amazon.checkComplete', () => {
                                isRunning = false;
                                startBtn.disabled = false;
                                stopBtn.disabled = true;
                                const completeMsg = document.createElement('div');
                                completeMsg.style.padding = '10px';
                                completeMsg.style.marginTop = '10px';
                                completeMsg.style.backgroundColor = '#e3f2fd';
                                completeMsg.style.borderRadius = '4px';
                                completeMsg.style.textAlign = 'center';
                                completeMsg.style.fontWeight = 'bold';
                                completeMsg.innerHTML = \`🎉 测活完成！存活: \${aliveCount} | 失效: \${deadCount} | 总计: \${totalChecked}\`;
                                resultsDiv.appendChild(completeMsg);
                            });

                        } catch (error) {
                            resultsDiv.innerHTML = '<p style="color: #f44336;">错误: ' + error.message + '</p>';
                            startBtn.disabled = false;
                            stopBtn.disabled = true;
                            isRunning = false;
                        }
                    });

                    stopBtn.addEventListener('click', () => {
                        window.appSocket.emit('request.amazon.stopCheck');
                        isRunning = false;
                        startBtn.disabled = false;
                        stopBtn.disabled = true;
                    });

                    // 导出存活账号
                    exportAliveBtn.addEventListener('click', () => {
                        if (aliveAccounts.length === 0) {
                            alert('没有存活账号可导出');
                            return;
                        }
                        const content = aliveAccounts.join('\\n');
                        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = \`amazon_alive_\${Date.now()}.txt\`;
                        a.click();
                        URL.revokeObjectURL(url);
                    });

                    // 导出失效账号
                    exportDeadBtn.addEventListener('click', () => {
                        if (deadAccounts.length === 0) {
                            alert('没有失效账号可导出');
                            return;
                        }
                        const content = deadAccounts.join('\\n');
                        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = \`amazon_dead_\${Date.now()}.txt\`;
                        a.click();
                        URL.revokeObjectURL(url);
                    });
                })();
            </script>
        `
    },

    'amazon-register': {
        title: '📝 亚马逊批量注册',
        html: `
            <div class="tool-content">
                <div class="section">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <label>注册数量</label>
                            <input type="number" id="register-count" value="1" min="1" max="100">
                        </div>
                        <div>
                            <label>并发数量</label>
                            <input type="number" id="register-threads" value="3" min="1" max="10">
                        </div>
                    </div>
                </div>

                <div class="section">
                    <label>代理配置</label>
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <input type="file" id="register-proxy-file" accept=".txt" style="flex: 1;">
                        <button id="clear-register-proxies-btn" class="secondary-btn">清空</button>
                    </div>
                    <textarea id="register-proxy-input" rows="4" placeholder="host:port:username:password&#10;每行一个代理"></textarea>
                    <div style="margin-top: 5px; color: #666; font-size: 12px;">
                        <span id="register-proxy-count">代理数量: 0</span>
                    </div>
                </div>

                <div class="section">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <label>邮箱类型</label>
                            <select id="email-type">
                                <option value="gmail">Gmail</option>
                                <option value="outlook">Outlook</option>
                                <option value="hotmail">Hotmail</option>
                                <option value="custom">自定义</option>
                            </select>
                        </div>
                        <div>
                            <label>自定义后缀</label>
                            <input type="text" id="email-suffix" placeholder="@example.com" disabled>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <label>密码长度</label>
                            <input type="number" id="password-length" value="12" min="8" max="32">
                        </div>
                        <div>
                            <label>姓名类型</label>
                            <select id="name-type">
                                <option value="random">随机英文名</option>
                                <option value="chinese">中文拼音</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <label>验证码接收方式</label>
                    <select id="verification-method">
                        <option value="manual">手动输入</option>
                        <option value="api">API自动接码</option>
                    </select>
                    <input type="text" id="verification-api-key" placeholder="API密钥（如使用API接码）" style="margin-top: 10px; display: none;">
                </div>

                <div class="section">
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button id="start-register-btn" class="primary-btn">开始注册</button>
                        <button id="stop-register-btn" class="secondary-btn" disabled>停止</button>
                        <button id="export-accounts-btn" class="secondary-btn">导出账号</button>
                        <button id="export-failed-btn" class="secondary-btn">导出失败记录</button>
                        <button id="clear-register-results-btn" class="secondary-btn">清空结果</button>
                    </div>
                </div>

                <div class="section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h4>注册结果</h4>
                        <div style="font-size: 12px; color: #666;">
                            <span id="success-count" style="color: #4CAF50;">成功: 0</span> |
                            <span id="failed-count" style="color: #f44336;">失败: 0</span> |
                            <span id="total-register">总计: 0</span>
                        </div>
                    </div>
                    <div id="register-results" class="results-container" style="max-height: 400px; overflow-y: auto;"></div>
                </div>
            </div>

            <script>
                (function() {
                    const startBtn = document.getElementById('start-register-btn');
                    const stopBtn = document.getElementById('stop-register-btn');
                    const resultsDiv = document.getElementById('register-results');
                    const exportBtn = document.getElementById('export-accounts-btn');
                    const exportFailedBtn = document.getElementById('export-failed-btn');
                    const clearResultsBtn = document.getElementById('clear-register-results-btn');
                    const proxyInput = document.getElementById('register-proxy-input');
                    const proxyFileInput = document.getElementById('register-proxy-file');
                    const clearProxiesBtn = document.getElementById('clear-register-proxies-btn');
                    const emailType = document.getElementById('email-type');
                    const emailSuffix = document.getElementById('email-suffix');
                    const verificationMethod = document.getElementById('verification-method');
                    const verificationApiKey = document.getElementById('verification-api-key');
                    
                    let registeredAccounts = [];
                    let failedAttempts = [];
                    let successCount = 0;
                    let failedCount = 0;
                    let totalRegister = 0;

                    // 更新代理数量
                    function updateProxyCount() {
                        const count = proxyInput.value.trim().split('\\n').filter(line => line.trim()).length;
                        document.getElementById('register-proxy-count').textContent = \`代理数量: \${count}\`;
                    }

                    // 更新统计信息
                    function updateStats() {
                        document.getElementById('success-count').textContent = \`成功: \${successCount}\`;
                        document.getElementById('failed-count').textContent = \`失败: \${failedCount}\`;
                        document.getElementById('total-register').textContent = \`总计: \${totalRegister}\`;
                    }

                    proxyInput.addEventListener('input', updateProxyCount);

                    // 代理文件上传
                    proxyFileInput.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                proxyInput.value = event.target.result;
                                updateProxyCount();
                            };
                            reader.readAsText(file);
                        }
                    });

                    // 清空代理
                    clearProxiesBtn.addEventListener('click', () => {
                        proxyInput.value = '';
                        proxyFileInput.value = '';
                        updateProxyCount();
                    });

                    // 邮箱类型切换
                    emailType.addEventListener('change', (e) => {
                        if (e.target.value === 'custom') {
                            emailSuffix.disabled = false;
                            emailSuffix.focus();
                        } else {
                            emailSuffix.disabled = true;
                            emailSuffix.value = '';
                        }
                    });

                    // 验证方式切换
                    verificationMethod.addEventListener('change', (e) => {
                        if (e.target.value === 'api') {
                            verificationApiKey.style.display = 'block';
                        } else {
                            verificationApiKey.style.display = 'none';
                        }
                    });

                    // 清空结果
                    clearResultsBtn.addEventListener('click', () => {
                        resultsDiv.innerHTML = '';
                        registeredAccounts = [];
                        failedAttempts = [];
                        successCount = 0;
                        failedCount = 0;
                        totalRegister = 0;
                        updateStats();
                    });

                    startBtn.addEventListener('click', () => {
                        const count = parseInt(document.getElementById('register-count').value);
                        const threads = parseInt(document.getElementById('register-threads').value);
                        const proxies = proxyInput.value.trim();
                        const emailTypeValue = emailType.value;
                        const customSuffix = emailSuffix.value.trim();
                        const passwordLen = parseInt(document.getElementById('password-length').value);
                        const nameType = document.getElementById('name-type').value;
                        const verificationMethodValue = verificationMethod.value;
                        const apiKey = verificationApiKey.value.trim();

                        if (!proxies) {
                            alert('请输入代理配置');
                            return;
                        }

                        if (emailTypeValue === 'custom' && !customSuffix) {
                            alert('请输入自定义邮箱后缀');
                            return;
                        }

                        if (verificationMethodValue === 'api' && !apiKey) {
                            alert('请输入API密钥');
                            return;
                        }

                        startBtn.disabled = true;
                        stopBtn.disabled = false;
                        resultsDiv.innerHTML = '<p style="color: #2196F3;">⏳ 正在注册账号...</p>';
                        
                        // 重置统计
                        registeredAccounts = [];
                        failedAttempts = [];
                        successCount = 0;
                        failedCount = 0;
                        totalRegister = 0;
                        updateStats();

                        // 清除之前的监听器
                        window.appSocket.off('backend.amazon.registerResult');
                        window.appSocket.off('backend.amazon.registerComplete');

                        window.appSocket.emit('request.amazon.register', {
                            count: count,
                            threads: threads,
                            proxies: proxies.split('\\n').filter(line => line.trim()),
                            emailType: emailTypeValue,
                            customSuffix: customSuffix,
                            passwordLength: passwordLen,
                            nameType: nameType,
                            verificationMethod: verificationMethodValue,
                            apiKey: apiKey
                        });

                        window.appSocket.on('backend.amazon.registerResult', (data) => {
                            totalRegister++;
                            const resultItem = document.createElement('div');
                            resultItem.style.padding = '8px';
                            resultItem.style.marginBottom = '5px';
                            resultItem.style.borderRadius = '4px';
                            resultItem.style.fontSize = '13px';
                            
                            if (data.success) {
                                successCount++;
                                registeredAccounts.push(data.account);
                                resultItem.style.backgroundColor = '#e8f5e9';
                                resultItem.style.borderLeft = '3px solid #4CAF50';
                                resultItem.innerHTML = \`<strong style="color: #4CAF50;">✓ 成功</strong> \${data.account.email}----\${data.account.password}\`;
                            } else {
                                failedCount++;
                                failedAttempts.push(data.error || '未知错误');
                                resultItem.style.backgroundColor = '#ffebee';
                                resultItem.style.borderLeft = '3px solid #f44336';
                                resultItem.innerHTML = \`<strong style="color: #f44336;">✗ 失败</strong> \${data.error}\`;
                            }
                            
                            resultsDiv.appendChild(resultItem);
                            resultsDiv.scrollTop = resultsDiv.scrollHeight;
                            updateStats();
                        });

                        window.appSocket.on('backend.amazon.registerComplete', () => {
                            startBtn.disabled = false;
                            stopBtn.disabled = true;
                            const completeMsg = document.createElement('div');
                            completeMsg.style.padding = '10px';
                            completeMsg.style.marginTop = '10px';
                            completeMsg.style.backgroundColor = '#e3f2fd';
                            completeMsg.style.borderRadius = '4px';
                            completeMsg.style.textAlign = 'center';
                            completeMsg.style.fontWeight = 'bold';
                            completeMsg.innerHTML = \`🎉 注册完成！成功: \${successCount} | 失败: \${failedCount} | 总计: \${totalRegister}\`;
                            resultsDiv.appendChild(completeMsg);
                        });
                    });

                    stopBtn.addEventListener('click', () => {
                        window.appSocket.emit('request.amazon.stopRegister');
                        startBtn.disabled = false;
                        stopBtn.disabled = true;
                    });

                    // 导出成功账号
                    exportBtn.addEventListener('click', () => {
                        if (registeredAccounts.length === 0) {
                            alert('没有可导出的账号');
                            return;
                        }

                        const content = registeredAccounts.map(acc => \`\${acc.email}----\${acc.password}\`).join('\\n');
                        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = \`amazon_accounts_\${Date.now()}.txt\`;
                        a.click();
                        URL.revokeObjectURL(url);
                    });

                    // 导出失败记录
                    exportFailedBtn.addEventListener('click', () => {
                        if (failedAttempts.length === 0) {
                            alert('没有失败记录可导出');
                            return;
                        }

                        const content = failedAttempts.join('\\n');
                        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = \`amazon_failed_\${Date.now()}.txt\`;
                        a.click();
                        URL.revokeObjectURL(url);
                    });
                })();
            </script>
        `
    },

    'cookie-transformer': {
        title: '🍪 Cookie转换',
        html: `
            <div class="tool-content">
                <div class="section">
                    <label>输入Cookie格式</label>
                    <select id="input-format">
                        <option value="netscape">Netscape格式</option>
                        <option value="json">JSON格式</option>
                        <option value="header">Header格式</option>
                    </select>
                </div>

                <div class="section">
                    <label>输入Cookie</label>
                    <textarea id="cookie-input" rows="10" placeholder="粘贴Cookie内容..."></textarea>
                </div>

                <div class="section">
                    <label>输出Cookie格式</label>
                    <select id="output-format">
                        <option value="netscape">Netscape格式</option>
                        <option value="json">JSON格式</option>
                        <option value="header">Header格式</option>
                    </select>
                </div>

                <div class="section">
                    <button id="transform-btn" class="primary-btn">转换</button>
                    <button id="copy-result-btn" class="secondary-btn">复制结果</button>
                </div>

                <div class="section">
                    <label>转换结果</label>
                    <textarea id="cookie-output" rows="10" readonly></textarea>
                </div>
            </div>

            <script>
                (function() {
                    const transformBtn = document.getElementById('transform-btn');
                    const copyBtn = document.getElementById('copy-result-btn');
                    const inputTextarea = document.getElementById('cookie-input');
                    const outputTextarea = document.getElementById('cookie-output');
                    const inputFormat = document.getElementById('input-format');
                    const outputFormat = document.getElementById('output-format');

                    transformBtn.addEventListener('click', () => {
                        const input = inputTextarea.value.trim();
                        if (!input) {
                            alert('请输入Cookie内容');
                            return;
                        }

                        window.appSocket.emit('request.cookie.transform', {
                            input: input,
                            inputFormat: inputFormat.value,
                            outputFormat: outputFormat.value
                        });

                        window.appSocket.once('backend.cookie.transformResult', (data) => {
                            if (data.success) {
                                outputTextarea.value = data.output;
                            } else {
                                alert('转换失败: ' + data.error);
                                outputTextarea.value = '';
                            }
                        });
                    });

                    copyBtn.addEventListener('click', () => {
                        if (!outputTextarea.value) {
                            alert('没有可复制的内容');
                            return;
                        }
                        outputTextarea.select();
                        document.execCommand('copy');
                        alert('已复制到剪贴板');
                    });
                })();
            </script>
        `
    },

    'roxybrowser-to-hubstudio': {
        title: '🔄 Roxy转HubStudio',
        html: `
            <div class="tool-content">
                <div class="section">
                    <label>RoxyBrowser配置文件</label>
                    <input type="file" id="roxy-file-input" accept=".json,.txt">
                </div>

                <div class="section">
                    <label>或直接粘贴配置</label>
                    <textarea id="roxy-text-input" rows="10" placeholder="粘贴RoxyBrowser配置内容..."></textarea>
                </div>

                <div class="section">
                    <button id="convert-roxy-btn" class="primary-btn">转换</button>
                    <button id="download-hubstudio-btn" class="secondary-btn" disabled>下载HubStudio配置</button>
                </div>

                <div class="section">
                    <label>转换结果预览</label>
                    <textarea id="hubstudio-preview" rows="10" readonly></textarea>
                </div>

                <div class="section">
                    <div id="conversion-status"></div>
                </div>
            </div>

            <script>
                (function() {
                    const fileInput = document.getElementById('roxy-file-input');
                    const textInput = document.getElementById('roxy-text-input');
                    const convertBtn = document.getElementById('convert-roxy-btn');
                    const downloadBtn = document.getElementById('download-hubstudio-btn');
                    const previewTextarea = document.getElementById('hubstudio-preview');
                    const statusDiv = document.getElementById('conversion-status');
                    let convertedData = null;

                    fileInput.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                textInput.value = event.target.result;
                            };
                            reader.readAsText(file);
                        }
                    });

                    convertBtn.addEventListener('click', () => {
                        const input = textInput.value.trim();
                        if (!input) {
                            alert('请选择文件或粘贴配置内容');
                            return;
                        }

                        statusDiv.innerHTML = '<p>正在转换...</p>';
                        downloadBtn.disabled = true;

                        window.appSocket.emit('request.roxy.convert', {
                            roxyConfig: input
                        });

                        window.appSocket.once('backend.roxy.convertResult', (data) => {
                            if (data.success) {
                                convertedData = data.hubstudioConfig;
                                previewTextarea.value = JSON.stringify(convertedData, null, 2);
                                downloadBtn.disabled = false;
                                statusDiv.innerHTML = '<p class="success">✓ 转换成功！</p>';
                            } else {
                                statusDiv.innerHTML = \`<p class="error">✗ 转换失败: \${data.error}</p>\`;
                                previewTextarea.value = '';
                                downloadBtn.disabled = true;
                            }
                        });
                    });

                    downloadBtn.addEventListener('click', () => {
                        if (!convertedData) return;

                        const blob = new Blob([JSON.stringify(convertedData, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = \`hubstudio_config_\${Date.now()}.json\`;
                        a.click();
                        URL.revokeObjectURL(url);
                    });
                })();
            </script>
        `
    },

    'qrcode-generation': {
        title: '📱 小火箭二维码生成',
        html: `
            <div class="tool-content">
                <div class="section">
                    <label>代理配置</label>
                    <textarea id="proxy-config-input" rows="6" placeholder="输入Shadowrocket配置链接或文本..."></textarea>
                </div>

                <div class="section">
                    <label>二维码大小</label>
                    <select id="qr-size">
                        <option value="200">小 (200x200)</option>
                        <option value="300" selected>中 (300x300)</option>
                        <option value="400">大 (400x400)</option>
                    </select>
                </div>

                <div class="section">
                    <button id="generate-qr-btn" class="primary-btn">生成二维码</button>
                    <button id="download-qr-btn" class="secondary-btn" disabled>下载二维码</button>
                </div>

                <div class="section">
                    <div id="qrcode-container" style="text-align: center; min-height: 320px; display: flex; align-items: center; justify-content: center;">
                        <p style="color: #888;">二维码将在这里显示</p>
                    </div>
                </div>
            </div>

            <script>
                (function() {
                    const generateBtn = document.getElementById('generate-qr-btn');
                    const downloadBtn = document.getElementById('download-qr-btn');
                    const configInput = document.getElementById('proxy-config-input');
                    const sizeSelect = document.getElementById('qr-size');
                    const container = document.getElementById('qrcode-container');
                    let currentQRDataURL = null;

                    generateBtn.addEventListener('click', () => {
                        const config = configInput.value.trim();
                        if (!config) {
                            alert('请输入代理配置');
                            return;
                        }

                        const size = parseInt(sizeSelect.value);
                        container.innerHTML = '<p>正在生成二维码...</p>';
                        downloadBtn.disabled = true;

                        window.appSocket.emit('request.qrcode.generate', {
                            config: config,
                            size: size
                        });

                        window.appSocket.once('backend.qrcode.generateResult', (data) => {
                            if (data.success) {
                                currentQRDataURL = data.qrCodeDataURL;
                                container.innerHTML = \`<img src="\${data.qrCodeDataURL}" alt="QR Code" style="max-width: 100%;">\`;
                                downloadBtn.disabled = false;
                            } else {
                                container.innerHTML = \`<p class="error">生成失败: \${data.error}</p>\`;
                                downloadBtn.disabled = true;
                            }
                        });
                    });

                    downloadBtn.addEventListener('click', () => {
                        if (!currentQRDataURL) return;

                        const a = document.createElement('a');
                        a.href = currentQRDataURL;
                        a.download = \`shadowrocket_qr_\${Date.now()}.png\`;
                        a.click();
                    });
                })();
            </script>
        `
    },

    'microsoft-email': {
        title: '📧 微软邮箱取软',
        html: `
            <div class="tool-content">
                <div class="section">
                    <label>邮箱账号</label>
                    <input type="text" id="ms-email" placeholder="your-email@outlook.com">
                </div>

                <div class="section">
                    <label>邮箱密码</label>
                    <input type="password" id="ms-password" placeholder="密码">
                </div>

                <div class="section">
                    <label>搜索关键词 (可选)</label>
                    <input type="text" id="search-keyword" placeholder="验证码">
                </div>

                <div class="section">
                    <label>获取邮件数量</label>
                    <input type="number" id="email-count" value="10" min="1" max="50">
                </div>

                <div class="section">
                    <button id="fetch-emails-btn" class="primary-btn">获取验证码</button>
                    <button id="refresh-emails-btn" class="secondary-btn">刷新</button>
                </div>

                <div class="section">
                    <h4>邮件列表</h4>
                    <div id="emails-list" class="results-container"></div>
                </div>
            </div>

            <script>
                (function() {
                    const fetchBtn = document.getElementById('fetch-emails-btn');
                    const refreshBtn = document.getElementById('refresh-emails-btn');
                    const emailsList = document.getElementById('emails-list');

                    function fetchEmails() {
                        const email = document.getElementById('ms-email').value.trim();
                        const password = document.getElementById('ms-password').value.trim();
                        const keyword = document.getElementById('search-keyword').value.trim();
                        const count = parseInt(document.getElementById('email-count').value);

                        if (!email || !password) {
                            alert('请输入邮箱和密码');
                            return;
                        }

                        emailsList.innerHTML = '<p>正在获取邮件...</p>';

                        window.appSocket.emit('request.microsoft.fetchEmails', {
                            email: email,
                            password: password,
                            keyword: keyword,
                            count: count
                        });

                        window.appSocket.once('backend.microsoft.emailsResult', (data) => {
                            if (data.success) {
                                if (data.emails.length === 0) {
                                    emailsList.innerHTML = '<p>未找到相关邮件</p>';
                                } else {
                                    emailsList.innerHTML = '';
                                    data.emails.forEach((email, index) => {
                                        const emailItem = document.createElement('div');
                                        emailItem.className = 'result-item';
                                        emailItem.innerHTML = \`
                                            <strong>[\${index + 1}] \${email.subject}</strong><br>
                                            <small>发件人: \${email.from}</small><br>
                                            <small>时间: \${email.date}</small><br>
                                            <div style="margin-top: 8px; padding: 8px; background: #f5f5f5; border-radius: 4px;">
                                                \${email.code || email.preview}
                                            </div>
                                        \`;
                                        emailsList.appendChild(emailItem);
                                    });
                                }
                            } else {
                                emailsList.innerHTML = \`<p class="error">获取失败: \${data.error}</p>\`;
                            }
                        });
                    }

                    fetchBtn.addEventListener('click', fetchEmails);
                    refreshBtn.addEventListener('click', fetchEmails);
                })();
            </script>
        `
    }
};

// Export tool content getter
function getToolContent(toolName) {
    return toolDefinitions[toolName] || {
        title: '工具未找到',
        html: '<p>该工具暂未实现</p>'
    };
}

// Export for use in main.js
if (typeof window !== 'undefined') {
    window.getToolContent = getToolContent;
}
