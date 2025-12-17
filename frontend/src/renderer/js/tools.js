// ═══════════════════════════════════════════════════════════════
// 工具定义文件 - 已按功能模块化分类
// ═══════════════════════════════════════════════════════════════
// 
// 文件结构:
// 1. Amazon相关工具 (测活、注册)
// 2. 转换工具 (Cookie转换、Roxy转HubStudio)
// 3. 微软相关工具 (邮箱、OAuth、批量注册)
// 4. 实用工具 (二维码、代理、录屏、短信)
//
// 每个工具独立定义,便于维护和修改
// ═══════════════════════════════════════════════════════════════

const toolDefinitions = {

// ┌─────────────────────────────────────────────────────────────┐
// │  1. AMAZON 相关工具                                          │
// └─────────────────────────────────────────────────────────────┘

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

// ┌──────────────────────────────────────────────────────────────┐
// │  Amazon注册工具 - 批量注册亚马逊账号                          │
// └──────────────────────────────────────────────────────────────┘

    'amazon-register': {
        title: '📝 亚马逊批量注册',
        html: `
            <div class="tool-content" style="max-height: 80vh; overflow-y: auto; padding-right: 10px;">
                <!-- 准备数据区域 -->
                <div class="section" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px;">
                    <h3 style="font-size: 18px; font-weight: bold; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                        📂 准备数据
                    </h3>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                        <div style="position: relative; background: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 15px; cursor: pointer; transition: all 0.3s; border: 2px dashed rgba(255, 255, 255, 0.3);" class="upload-zone" data-type="phone">
                            <input type="file" id="phone-data-file" accept=".txt" style="position: absolute; inset: 0; opacity: 0; cursor: pointer;">
                            <div style="text-align: center;">
                                <div style="font-size: 24px; margin-bottom: 8px;">📱</div>
                                <div style="font-size: 13px; font-weight: 600;">手机API数据</div>
                                <div id="phone-count" style="font-size: 11px; margin-top: 5px; opacity: 0.8;">未导入</div>
                            </div>
                        </div>
                        <div style="position: relative; background: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 15px; cursor: pointer; transition: all 0.3s; border: 2px dashed rgba(255, 255, 255, 0.3);" class="upload-zone" data-type="email">
                            <input type="file" id="email-data-file" accept=".txt" style="position: absolute; inset: 0; opacity: 0; cursor: pointer;">
                            <div style="text-align: center;">
                                <div style="font-size: 24px; margin-bottom: 8px;">📧</div>
                                <div style="font-size: 13px; font-weight: 600;">邮箱数据</div>
                                <div id="email-count" style="font-size: 11px; margin-top: 5px; opacity: 0.8;">未导入</div>
                            </div>
                        </div>
                        <div style="position: relative; background: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 15px; cursor: pointer; transition: all 0.3s; border: 2px dashed rgba(255, 255, 255, 0.3);" class="upload-zone" data-type="proxy">
                            <input type="file" id="proxy-data-file" accept=".txt" style="position: absolute; inset: 0; opacity: 0; cursor: pointer;">
                            <div style="text-align: center;">
                                <div style="font-size: 24px; margin-bottom: 8px;">🔐</div>
                                <div style="font-size: 13px; font-weight: 600;">代理数据</div>
                                <div id="proxy-count" style="font-size: 11px; margin-top: 5px; opacity: 0.8;">未导入</div>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 15px; align-items: center;">
                        <select id="browser-type" style="flex: 1; padding: 8px 12px; border-radius: 6px; background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid rgba(255, 255, 255, 0.3); font-size: 13px;">
                            <option value="hubstudio" style="color: #333;">HubStudio</option>
                            <option value="adspower" style="color: #333;">AdsPower</option>
                            <option value="bitbrowser" style="color: #333;">BitBrowser</option>
                        </select>
                        <button id="generate-proxy-btn" style="padding: 8px 16px; background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 6px; color: white; font-size: 13px; cursor: pointer; transition: all 0.3s; font-weight: 600;">🎲 代理生成</button>
                        <button id="clear-all-data-btn" style="padding: 8px 16px; background: rgba(255, 59, 48, 0.8); border: none; border-radius: 6px; color: white; font-size: 13px; cursor: pointer; transition: all 0.3s; font-weight: 600;">🗑️ 清空全部</button>
                    </div>
                </div>

                <!-- 统计卡片区域 -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px;">
                    <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">✅ 成功</div>
                        <div id="stat-success" style="font-size: 28px; font-weight: bold;">0</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">❌ 失败</div>
                        <div id="stat-failed" style="font-size: 28px; font-weight: bold;">0</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">⏳ 进行中</div>
                        <div id="stat-running" style="font-size: 28px; font-weight: bold;">0</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">⚠️ 异常</div>
                        <div id="stat-error" style="font-size: 28px; font-weight: bold;">0</div>
                    </div>
                </div>

                <!-- 统一配置区域 -->
                <div class="section">
                    <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 15px; color: #667eea;">⚙️ 注册配置</h4>
                    
                    <!-- 第一行：平台、并发、密码、站点 -->
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px;">
                        <div>
                            <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">🖥️ 任务平台</label>
                            <select id="task-platform" style="width: 100%; padding: 6px;">
                                <option value="hubstudio">HubStudio</option>
                                <option value="roxybrowser" disabled>RoxyBrowser</option>
                                <option value="adspower" disabled>AdsPower</option>
                                <option value="bitbrowser" disabled>BitBrowser</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">🔢 并发数量</label>
                            <select id="concurrent-count" style="width: 100%; padding: 6px;">
                                <option value="9999">自适应</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4" selected>4</option>
                                <option value="5">5</option>
                                <option value="8">8</option>
                                <option value="10">10</option>
                                <option value="20">20</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">🔑 密码规则</label>
                            <select id="password-source" style="width: 100%; padding: 6px;">
                                <option value="email-password">与邮箱密码相同</option>
                                <option value="username-matching">根据用户名生成</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">🌍 站点</label>
                            <select id="amazon-site" style="width: 100%; padding: 6px;">
                                <option value="com">美国(.com)</option>
                                <option value="co.uk">英国(.co.uk)</option>
                                <option value="de">德国(.de)</option>
                                <option value="fr">法国(.fr)</option>
                                <option value="it">意大利(.it)</option>
                                <option value="es">西班牙(.es)</option>
                                <option value="ca">加拿大(.ca)</option>
                                <option value="co.jp">日本(.co.jp)</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- 第二行：启动参数、2FA、邮箱服务、操作延迟 -->
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                        <div>
                            <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">🚀 启动参数（Ctrl多选，默认8个）</label>
                            <select id="launch-params" style="width: 100%; height: 85px; padding: 4px;" multiple>
                                <option value="--start-maximized">启动时窗口最大化</option>
                                <option value="--kiosk">全屏且无工具栏</option>
                                <option value="--disable-extensions" selected>禁用所有扩展 ✓</option>
                                <option value="--disable-notifications" selected>禁用网页通知 ✓</option>
                                <option value="--no-default-browser-check" selected>禁用默认浏览器检查 ✓</option>
                                <option value="--disable-prompt-on-repost" selected>禁用表单重复提交提示 ✓</option>
                                <option value="--disable-background-timer-throttling" selected>后台定时器不受限制 ✓</option>
                                <option value="--disable-renderer-backgrounding" selected>禁止渲染进程后台化 ✓</option>
                                <option value="--disable-backgrounding-occluded-windows" selected>被遮挡窗口不受后台限制 ✓</option>
                                <option value="--disable-gpu">禁用GPU加速</option>
                                <option value="--disable-software-rasterizer">禁用软件光栅化</option>
                                <option value="--no-sandbox">关闭沙盒</option>
                                <option value="--disable-breakpad">禁用崩溃报告</option>
                                <option value="--disable-component-extensions-with-background-pages" selected>禁用带后台页的组件扩展 ✓</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">🔐 2FA</label>
                            <select id="enable-2fa" style="width: 100%; padding: 6px; margin-bottom: 8px;">
                                <option value="true">启用</option>
                                <option value="false">禁用</option>
                            </select>
                            <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">📧 邮箱</label>
                            <select id="email-service-type" style="width: 100%; padding: 6px;">
                                <option value="microsoft">Graph</option>
                                <option value="imap">IMAP</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">⏱️ 延迟</label>
                            <input type="number" id="operation-delay" value="3" min="1" max="10" style="width: 100%; padding: 6px; margin-bottom: 8px;">
                            <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">🤖 Captcha</label>
                            <input type="text" id="captcha-api-key" placeholder="选填" style="width: 100%; padding: 6px;">
                        </div>
                        <div>
                            <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">📊 注册数</label>
                            <input type="text" id="register-count-display" value="0" disabled style="width: 100%; padding: 6px; background: #f0f0f0; color: #666; margin-bottom: 8px;">
                            <div style="font-size: 10px; color: #999; margin-bottom: 8px;">根据邮箱数自动</div>
                        </div>
                    </div>
                    
                    <!-- 第三行：开关选项 -->
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 6px; background: #f9f9f9;">
                            <label style="font-size: 12px; color: #666;">💾 缓存</label>
                            <label class="switch" style="position: relative; display: inline-block; width: 44px; height: 20px;">
                                <input type="checkbox" id="enable-cache" checked style="opacity: 0; width: 0; height: 0;">
                                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: 0.4s; border-radius: 20px;"></span>
                            </label>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 6px; background: #f9f9f9;">
                            <label style="font-size: 12px; color: #666;">📐 自动排列</label>
                            <label class="switch" style="position: relative; display: inline-block; width: 44px; height: 20px;">
                                <input type="checkbox" id="auto-arrange" style="opacity: 0; width: 0; height: 0;">
                                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: 0.4s; border-radius: 20px;"></span>
                            </label>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 6px; background: #f9f9f9;">
                            <label style="font-size: 12px; color: #666;">🗑️ 失败删除</label>
                            <label class="switch" style="position: relative; display: inline-block; width: 44px; height: 20px;">
                                <input type="checkbox" id="delete-on-failure" style="opacity: 0; width: 0; height: 0;">
                                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: 0.4s; border-radius: 20px;"></span>
                            </label>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 6px; background: #f9f9f9;">
                            <label style="font-size: 12px; color: #666;">📍 自动绑定</label>
                            <label class="switch" style="position: relative; display: inline-block; width: 44px; height: 20px;">
                                <input type="checkbox" id="bind-address" checked style="opacity: 0; width: 0; height: 0;">
                                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: 0.4s; border-radius: 20px;"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- 操作按钮 -->
                <div class="section" style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
                    <button id="start-register-btn" style="flex: 1; min-width: 120px; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">🚀 开始注册</button>
                    <button id="stop-register-btn" style="flex: 1; min-width: 120px; padding: 12px 24px; background: #6c757d; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: not-allowed; opacity: 0.5;" disabled>⏸️ 停止</button>
                    <button id="export-accounts-btn" class="secondary-btn" style="min-width: 120px;">📥 导出账号</button>
                    <button id="export-failed-btn" class="secondary-btn" style="min-width: 120px;">📋 导出失败</button>
                    <button id="clear-register-results-btn" class="secondary-btn" style="min-width: 120px;">🗑️ 清空结果</button>
                </div>

                <!-- 任务列表 -->
                <div class="section">
                    <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 15px; color: #667eea;">📝 注册任务列表</h4>
                    <div id="task-list" style="max-height: 350px; overflow-y: auto; background: #f8f9fa; border-radius: 8px; padding: 10px;">
                        <div style="text-align: center; padding: 40px; color: #999;">
                            <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
                            <div style="font-size: 14px;">暂无任务</div>
                        </div>
                    </div>
                </div>
            </div>
        `
    },

// ┌─────────────────────────────────────────────────────────────┐
// │  2. 转换工具 - COOKIE & 浏览器配置转换                        │
// └─────────────────────────────────────────────────────────────┘

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

// ┌──────────────────────────────────────────────────────────────┐
// │  RoxyBrowser转HubStudio - 浏览器配置转换                    │
// └──────────────────────────────────────────────────────────────┘

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

// ┌─────────────────────────────────────────────────────────────┐
// │  3. 实用工具 - 二维码、代理等                                │
// └─────────────────────────────────────────────────────────────┘

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

    'proxy-generation': {
        title: '🌐 生成代理',
        html: `
            <div class="tool-content">
                <div class="section">
                    <h3>代理生成配置</h3>
                    <div class="form-row">
                        <div class="form-item">
                            <label>生成数量</label>
                            <input type="number" id="proxy-quantity" value="5" min="1" max="100">
                        </div>
                        <div class="form-item">
                            <label>国家</label>
                            <select id="proxy-country">
                                <option value="RANDOM">🎲 随机</option>
                                <option value="US">美国 (US)</option>
                                <option value="UK">英国 (UK)</option>
                                <option value="CA">加拿大 (CA)</option>
                                <option value="AU">澳大利亚 (AU)</option>
                                <option value="DE">德国 (DE)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h3>高级配置</h3>
                    <div class="form-item">
                        <label>用户名前缀</label>
                        <input type="text" id="proxy-prefix" value="rZwC7qlCe8" placeholder="用户名前缀">
                    </div>
                    <div class="form-item">
                        <label>统一密码</label>
                        <input type="text" id="proxy-password" value="52572596" placeholder="代理密码">
                    </div>
                </div>

                <div class="section">
                    <button id="btn-generate-proxies" class="primary-btn">🚀 生成代理</button>
                    <button id="btn-clear-proxies" class="secondary-btn">清空</button>
                    <button id="btn-copy-proxies" class="secondary-btn">📋 复制全部</button>
                    <span style="margin-left: 15px; color: var(--text-gray);">已生成: <span id="proxy-count">0</span> 个</span>
                </div>

                <div class="section">
                    <h3>生成结果</h3>
                    <p style="font-size: 12px; color: var(--text-gray); margin-bottom: 8px;">
                        格式: Host:Port:Username:Password
                    </p>
                    <textarea id="proxy-output" rows="15" placeholder="生成的代理将显示在这里..." style="font-family: monospace; font-size: 12px;"></textarea>
                </div>
            </div>
        `
    },

// ┌─────────────────────────────────────────────────────────────┐
// │  4. 微软相关工具 - 邮箱、OAuth、批量注册                      │
// └─────────────────────────────────────────────────────────────┘

    'microsoft-email-extract': {
        title: '📬 微软邮箱提取',
        html: `
            <div class="tool-content">
                <div class="section">
                    <h3>配置信息</h3>
                    <div class="form-item">
                        <label>Client ID</label>
                        <input type="text" id="ms-extract-clientid" placeholder="输入你的 Client ID" style="width: 100%;">
                    </div>
                    <div class="form-item">
                        <label>Refresh Token</label>
                        <textarea id="ms-extract-refresh-token" rows="3" placeholder="输入你的 Refresh Token" style="width: 100%; font-family: monospace;"></textarea>
                    </div>
                    <button id="btn-extract-emails" class="primary-btn">提取最新邮件</button>
                </div>

                <div class="section">
                    <h3>执行日志</h3>
                    <div id="extract-log" style="background: rgba(0,0,0,0.3); color: var(--text-light); border: 1px solid rgba(102, 126, 234, 0.3); border-radius: 8px; padding: 15px; min-height: 300px; max-height: 500px; overflow-y: auto; font-family: monospace; font-size: 13px; white-space: pre-wrap;"></div>
                </div>
            </div>
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
    },

// ┌──────────────────────────────────────────────────────────────┐
// │  微软Graph OAuth授权 - Device Code Flow                     │
// └──────────────────────────────────────────────────────────────┘

    'ms-graph-oauth': {
        title: '🔑 微软账号授权',
        html: `
            <div class="tool-content">
                <div class="section">
                    <h3>Microsoft Graph OAuth授权</h3>
                    <p>使用Device Code Flow获取Refresh Token（无需密码）</p>
                </div>

                <div class="section">
                    <label>邮箱账号（可选，仅作提示）</label>
                    <input type="text" id="ms-email" placeholder="example@outlook.com">
                </div>

                <div class="section">
                    <label>Client ID</label>
                    <input type="text" id="ms-client-id" value="4ef1dfe5-98e5-48e9-bbb3-fc4984a8c489" placeholder="Azure AD应用ID">
                </div>

                <div class="section">
                    <button id="btn-start-oauth" class="primary-btn">🚀 开始授权</button>
                    <button id="btn-clear-oauth-log" class="secondary-btn">清空日志</button>
                </div>

                <div class="section">
                    <h4>授权日志</h4>
                    <div id="oauth-log" class="results-container" style="max-height: 400px; overflow-y: auto; background: #f5f5f5; padding: 10px; border-radius: 4px;"></div>
                </div>

                <div class="section">
                    <h4>Refresh Token</h4>
                    <textarea id="oauth-result" rows="6" readonly style="font-family: monospace; font-size: 12px;"></textarea>
                    <button id="btn-copy-token" class="secondary-btn" style="margin-top: 10px;">📋 复制Token</button>
                </div>
            </div>

            <script>
                (function() {
                    const btnStart = document.getElementById('btn-start-oauth');
                    const btnClear = document.getElementById('btn-clear-oauth-log');
                    const btnCopy = document.getElementById('btn-copy-token');
                    const logDiv = document.getElementById('oauth-log');
                    const resultTextarea = document.getElementById('oauth-result');
                    
                    function addLog(message, type = 'info') {
                        const time = new Date().toLocaleTimeString();
                        const colorMap = {
                            'info': '#333',
                            'success': '#4CAF50',
                            'error': '#f44336',
                            'warning': '#ff9800'
                        };
                        logDiv.innerHTML += \`<div style="color: \${colorMap[type]}; margin: 3px 0;">[\${time}] \${message}</div>\`;
                        logDiv.scrollTop = logDiv.scrollHeight;
                    }
                    
                    btnStart.addEventListener('click', async () => {
                        const email = document.getElementById('ms-email').value.trim();
                        const clientId = document.getElementById('ms-client-id').value.trim();
                        
                        if (!clientId) {
                            addLog('请填写Client ID', 'error');
                            return;
                        }
                        
                        btnStart.disabled = true;
                        addLog('开始授权流程...', 'info');
                        
                        try {
                            // 使用暴露的outlookAuthAPI
                            if (!window.outlookAuthAPI) {
                                throw new Error('outlookAuthAPI未加载，请检查preload.js');
                            }
                            
                            // 1. 获取device code
                            addLog('正在获取验证码...', 'info');
                            const dc = await window.outlookAuthAPI.startDeviceLogin(clientId);
                            
                            addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
                            addLog(\`✅ 验证码获取成功！\`, 'success');
                            addLog(\`📋 请打开浏览器访问: \${dc.verificationUri}\`, 'warning');
                            addLog(\`🔑 输入验证码: \${dc.userCode}\`, 'warning');
                            if (email) {
                                addLog(\`👤 建议登录账号: \${email}\`, 'info');
                            }
                            addLog(\`⏱️ 验证码有效期: \${dc.expiresIn}秒 (\${Math.floor(dc.expiresIn/60)}分钟)\`, 'info');
                            addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
                            addLog('⏳ 等待授权完成，正在轮询...', 'info');
                            
                            // 2. 轮询token
                            const tokens = await window.outlookAuthAPI.pollForToken(clientId, dc.deviceCode, dc.interval);
                            
                            addLog('✅ 授权成功！', 'success');
                            resultTextarea.value = tokens.refreshToken;
                            addLog(\`🎫 Access Token (前40位): \${tokens.accessToken.slice(0, 40)}...\`, 'success');
                            addLog(\`🔄 Refresh Token (前40位): \${tokens.refreshToken.slice(0, 40)}...\`, 'success');
                            addLog(\`⏰ 过期时间: \${tokens.expiresIn}秒\`, 'info');
                            
                            // 3. 获取用户信息
                            try {
                                const userInfo = await window.outlookAuthAPI.getMe(clientId, tokens.accessToken);
                                addLog(\`📧 邮箱地址: \${userInfo.mail || userInfo.userPrincipalName}\`, 'success');
                                addLog(\`👤 显示名称: \${userInfo.displayName}\`, 'info');
                            } catch (e) {
                                addLog('获取用户信息失败，但token已获取', 'warning');
                            }
                            
                        } catch (err) {
                            addLog(\`❌ 错误: \${err.message}\`, 'error');
                            console.error('OAuth授权错误:', err);
                        } finally {
                            btnStart.disabled = false;
                        }
                    });
                    
                    btnClear.addEventListener('click', () => {
                        logDiv.innerHTML = '';
                    });
                    
                    btnCopy.addEventListener('click', () => {
                        const token = resultTextarea.value;
                        if (token) {
                            navigator.clipboard.writeText(token);
                            addLog('Token已复制到剪贴板', 'success');
                        }
                    });
                })();
            </script>
        `
    },

// ┌──────────────────────────────────────────────────────────────┐
// │  5SIM短信验证工具                                            │
// └──────────────────────────────────────────────────────────────┘

    '5sim-sms-verification': {
        title: '📱 5SIM短信验证',
        html: `
            <div class="tool-workspace">
                <!-- Top Bar -->
                <div class="workspace-header">
                    <div class="header-tabs">
                        <button class="header-tab active" data-tab="fivesim-generate">生成号码</button>
                        <button class="header-tab" data-tab="fivesim-settings">API设置</button>
                        <span class="tab-indicator">已生成: <span id="fivesim-count">0</span></span>
                    </div>
                    <div class="header-actions">
                        <span class="platform-badge">5SIM API</span>
                    </div>
                </div>

                <!-- Tab Content: Generate Numbers -->
                <div class="tab-content active" id="tab-fivesim-generate">
                    <div class="content-section">
                        <h3 class="section-title">生成虚拟号码</h3>
                        <div class="form-grid">
                            <div class="form-item">
                                <label>国家(country)</label>
                                <select id="fivesim-country">
                                    <option value="usa">USA (美国)</option>
                                    <option value="england">England (英国)</option>
                                    <option value="canada">Canada (加拿大)</option>
                                    <option value="0">任意国家</option>
                                </select>
                            </div>
                            <div class="form-item">
                                <label>服务(service)</label>
                                <input type="text" id="fivesim-service" placeholder="例如 amazon / other / ot" value="amazon">
                            </div>
                            <div class="form-item">
                                <label>运营商(operator)</label>
                                <select id="fivesim-operator">
                                    <option value="any">任意</option>
                                    <option value="virtual">virtual</option>
                                    <option value="virtual18">virtual18</option>
                                    <option value="virtual60">virtual60</option>
                                </select>
                            </div>
                            <div class="form-item">
                                <label>生成数量</label>
                                <input type="number" id="fivesim-count-input" min="1" max="20" value="3">
                            </div>
                        </div>
                        <button class="btn btn-generate" id="btn-generate-fivesim">生成配置</button>
                        <div id="fivesim-status" style="margin-top: 10px; color: var(--text-gray);"></div>
                    </div>

                    <!-- Results Display -->
                    <div class="content-section" style="margin-top: 20px;">
                        <h3 class="section-title">结果(每一行就是一个"手机+api数据")</h3>
                        <textarea id="fivesim-output" spellcheck="false" placeholder="+1*******----http://api1.5sim.net/stubs/handler_api.php?..." style="width: 100%; min-height: 200px; background: rgba(0,0,0,0.3); color: var(--text-light); border: 1px solid rgba(102, 126, 234, 0.3); border-radius: 8px; padding: 15px; font-family: monospace; font-size: 13px; resize: vertical;"></textarea>
                        <div style="margin-top: 10px;">
                            <button class="btn btn-action" id="btn-copy-fivesim">复制全部到剪贴板</button>
                        </div>
                    </div>
                </div>

                <!-- Tab Content: API Settings -->
                <div class="tab-content" id="tab-fivesim-settings">
                    <div class="content-section">
                        <h3 class="section-title">API配置</h3>
                        <div class="form-item" style="max-width: 600px;">
                            <label>API1 协议 api_key (Deprecated API)</label>
                            <input type="text" id="fivesim-apikey" placeholder="在 5SIM 个人中心找 API key API1 protocol 那一行" style="width: 100%;">
                            <small style="display: block; margin-top: 5px; color: var(--text-gray);">
                                提示: API Key 会自动保存到本地，下次打开会自动加载
                            </small>
                        </div>
                        <div style="margin-top: 15px;">
                            <button class="btn btn-action" id="btn-save-fivesim-apikey">保存 API Key</button>
                            <button class="btn btn-action" id="btn-clear-fivesim-apikey">清除 API Key</button>
                        </div>
                    </div>
                </div>
            </div>
        `
    }

// ┌──────────────────────────────────────────────────────────────┐
// │  工具定义结束                                                │
// └──────────────────────────────────────────────────────────────┘
};

// ═══════════════════════════════════════════════════════════════
// 工具内容获取函数
// ═══════════════════════════════════════════════════════════════

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
