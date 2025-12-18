// Socket.IO Connection
let socket;
let isConnected = false;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    console.log('CvvUtils application initializing...');
    
    // 检查 getToolContent 函数
    console.log('🔍 检查 getToolContent 函数:');
    console.log('  - window.getToolContent:', window.getToolContent);
    console.log('  - typeof window.getToolContent:', typeof window.getToolContent);
    
    // 检查preload暴露的API
    console.log('🔍 检查Preload API状态:');
    console.log('  - window.msGraphAPI:', window.msGraphAPI ? '✅ 已加载' : '❌ 未加载');
    console.log('  - window.hotmailBatchAPI:', window.hotmailBatchAPI ? '✅ 已加载' : '❌ 未加载');
    
    if (window.msGraphAPI) {
        console.log('    - msGraphAPI.startDeviceCode:', typeof window.msGraphAPI.startDeviceCode);
        console.log('    - msGraphAPI.pollForToken:', typeof window.msGraphAPI.pollForToken);
    }
    
    if (window.hotmailBatchAPI) {
        console.log('    - hotmailBatchAPI.batchRegister:', typeof window.hotmailBatchAPI.batchRegister);
    }
    
    // 显示可用功能提示
    console.log('📌 可用功能：');
    console.log('  ✅ Cookie转换 (无需后端)');
    console.log('  ✅ Roxy转HubStudio (无需后端)');
    console.log('  ✅ 小火箭二维码 (无需后端)');
    console.log('  ✅ 微软邮箱取软 (无需后端)');
    console.log('  ' + (window.msGraphAPI ? '✅' : '❌') + ' 微软账号授权 (无需后端)');
    console.log('  ' + (window.hotmailBatchAPI ? '✅' : '❌') + ' Hotmail批量注册 (无需后端)');
    console.log('  ✅ 5SIM短信验证 (无需后端)');
    console.log('  ⚠️  Amazon测活/注册 (需要后端服务)');

    // Initialize Socket.IO
    initializeSocket();

    // Setup event listeners
    setupEventListeners();
});

// Socket.IO initialization
function initializeSocket() {
    const backendUrl = 'http://localhost:6791';
    console.log('Connecting to backend:', backendUrl);

    socket = io(backendUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10
    });

    // Export socket globally
    window.appSocket = socket;

    socket.on('connect', () => {
        console.log('Socket.IO Connected');
        isConnected = true;
        updateConnectionStatus('后端已连接', true);
    });

    socket.on('disconnect', () => {
        console.log('Socket.IO Disconnected');
        isConnected = false;
        updateConnectionStatus('后端已断开', false);
    });

    socket.on('connect_error', (error) => {
        console.error('Socket.IO Connection error:', error);
        updateConnectionStatus('后端未连接 (部分功能可用)', false);
    });

    // Listen for task events
    socket.on('backend.task.runState', (state) => {
        console.log('Task state updated:', state);
        updateTaskStatus(state);
    });

    socket.on('run.task.log', (log) => {
        console.log('Task log:', log);
        addLogMessage(log);
    });
}

// Update connection status
function updateConnectionStatus(text, connected) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = connected ? '🔌 ' + text : '⚠️ ' + text;
        statusElement.style.color = connected ? 'var(--success-color)' : 'var(--error-color)';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // Tool cards
    const toolCards = document.querySelectorAll('.tool-card');
    toolCards.forEach(card => {
        card.addEventListener('click', () => {
            const toolName = card.getAttribute('data-tool');
            openToolModal(toolName);
        });
    });

    // Modal close
    const modalClose = document.querySelector('.modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    // 注意: 已移除点击模态框外部关闭的功能，只能通过关闭按钮(X)关闭

    // Log panel controls
    const btnClearLog = document.querySelector('.btn-clear-log');
    if (btnClearLog) {
        btnClearLog.addEventListener('click', clearLog);
    }

    const btnCloseLog = document.querySelector('.btn-close-log');
    if (btnCloseLog) {
        btnCloseLog.addEventListener('click', () => {
            document.getElementById('log-panel').classList.remove('active');
        });
    }
}

// Switch tabs
function switchTab(tabName) {
    // Update nav tabs
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        }
    });

    // Update panels
    const panels = document.querySelectorAll('.tab-panel');
    panels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === tabName) {
            panel.classList.add('active');
        }
    });
}

// Open tool modal
function openToolModal(toolName) {
    console.log('openToolModal called with toolName:', toolName);
    console.log('window.getToolContent exists:', !!window.getToolContent);
    console.log('window.getToolContent type:', typeof window.getToolContent);
    
    // 特殊处理：账号管理工具打开独立窗口
    if (toolName === 'account-manager') {
        if (window.accountManagerAPI && typeof window.accountManagerAPI.openAccountManager === 'function') {
            try {
                window.accountManagerAPI.openAccountManager();
                console.log('✅ 账号管理窗口已打开');
            } catch (error) {
                console.error('❌ 打开账号管理窗口失败:', error);
                alert('打开账号管理窗口失败，请查看控制台了解详情');
            }
        } else {
            console.error('❌ accountManagerAPI 不可用');
            alert('账号管理功能不可用，请确保程序正确初始化');
        }
        return;
    }
    
    if (typeof window.getToolContent !== 'function') {
        console.error('❌ window.getToolContent 不是函数！可能 tools.js 没有正确加载');
        alert('错误：工具加载失败，请刷新页面重试\n详细信息请查看控制台');
        return;
    }
    
    const modal = document.getElementById('tool-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    // Get tool content
    const toolContent = window.getToolContent(toolName);

    title.textContent = toolContent.title;
    body.innerHTML = toolContent.html;

    // Execute inline scripts manually (innerHTML doesn't execute scripts automatically)
    const scripts = body.querySelectorAll('script');
    console.log('找到内联脚本数量:', scripts.length);
    scripts.forEach((oldScript, index) => {
        const hasSrc = oldScript.hasAttribute('src');
        const srcValue = oldScript.getAttribute('src');
        const hasContent = oldScript.textContent.trim().length > 0;
        
        console.log(`执行脚本 ${index + 1}:`, {
            hasSrc,
            src: srcValue,
            hasContent,
            contentLength: oldScript.textContent.length
        });
        
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
        });
        
        if (hasContent) {
            newScript.textContent = oldScript.textContent;
        }
        
        // 添加错误处理
        newScript.onerror = (err) => {
            console.error(`❌ 脚本 ${index + 1} 执行出错:`, {
                src: srcValue,
                error: err,
                message: err.message || '加载失败'
            });
        };
        
        newScript.onload = () => {
            console.log(`✅ 脚本 ${index + 1} 加载成功`, srcValue || '(内联脚本)');
            
            // 检查模块是否加载
            if (srcValue && srcValue.includes('hotmailBatchRegister')) {
                console.log('检查 HotmailBatchRegisterModule:', typeof window.HotmailBatchRegisterModule);
            }
        };
        
        try {
            oldScript.parentNode.replaceChild(newScript, oldScript);
            console.log(`✅ 脚本 ${index + 1} 已插入DOM`);
            
            // 检查是否创建了测试函数
            if (toolName === 'hotmail-batch-register' && window.testBatchRegisterClick) {
                console.log('✅ 检测到 window.testBatchRegisterClick 函数已创建');
                console.log('尝试获取按钮...');
                const btn = document.getElementById('btn-start-batch-register');
                console.log('按钮元素:', btn);
                if (btn) {
                    console.log('按钮 disabled:', btn.disabled);
                    console.log('按钮 onclick:', btn.onclick);
                    console.log('按钮事件监听器已绑定');
                    
                    // 添加额外的点击日志
                    const originalClick = btn.click.bind(btn);
                    btn.click = function() {
                        console.log('🔴 按钮 click() 被调用');
                        return originalClick();
                    };
                }
            }
        } catch (err) {
            console.error('❌ 脚本', index + 1, '执行失败:', err);
        }
    });

    modal.classList.add('active');

    // Setup 5SIM specific listeners if this is the 5SIM tool
    if (toolName === '5sim-sms-verification') {
        setup5simListeners();
    }

    // Setup Microsoft Email Extract if this is the microsoft-email-extract tool
    if (toolName === 'microsoft-email-extract') {
        if (typeof window.initMicrosoftEmailExtract === 'function') {
            window.initMicrosoftEmailExtract();
        } else {
            console.error('❌ initMicrosoftEmailExtract 函数未找到');
        }
    }

    // Setup Proxy Generation if this is the proxy-generation tool
    if (toolName === 'proxy-generation') {
        if (typeof window.initProxyGeneration === 'function') {
            window.initProxyGeneration();
        } else {
            console.error('❌ initProxyGeneration 函数未找到');
        }
    }

    // Setup Amazon Register if this is the amazon-register tool
    if (toolName === 'amazon-register') {
        if (typeof window.initAmazonRegister === 'function') {
            window.initAmazonRegister();
        } else {
            console.error('❌ initAmazonRegister 函数未找到');
        }
    }
}

// Setup 5SIM listeners
function setup5simListeners() {
    const modal = document.getElementById('tool-modal');
    if (!modal) return;

    // Tab switching
    const tabs = modal.querySelectorAll('.header-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            // Update tab states
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update content visibility
            const tabContents = modal.querySelectorAll('.tab-content');
            tabContents.forEach(content => {
                content.classList.remove('active');
                content.style.display = 'none';
            });
            
            const targetContent = modal.querySelector(`#tab-${targetTab}`);
            if (targetContent) {
                targetContent.classList.add('active');
                targetContent.style.display = 'block';
            }
        });
    });

    // Load saved API key from localStorage
    const apiKeyInput = modal.querySelector('#fivesim-apikey');
    if (apiKeyInput) {
        const savedApiKey = localStorage.getItem('fivesimApiKey') || '';
        apiKeyInput.value = savedApiKey;
    }

    // Save API Key button
    const btnSaveApiKey = modal.querySelector('#btn-save-fivesim-apikey');
    if (btnSaveApiKey) {
        btnSaveApiKey.addEventListener('click', () => {
            const apiKey = modal.querySelector('#fivesim-apikey').value.trim();
            if (!apiKey) {
                alert('请先填写 API Key');
                return;
            }
            localStorage.setItem('fivesimApiKey', apiKey);
            alert('API Key 已保存到本地');
        });
    }

    // Clear API Key button
    const btnClearApiKey = modal.querySelector('#btn-clear-fivesim-apikey');
    if (btnClearApiKey) {
        btnClearApiKey.addEventListener('click', () => {
            if (confirm('确定要清除保存的 API Key 吗?')) {
                localStorage.removeItem('fivesimApiKey');
                const apiKeyInput = modal.querySelector('#fivesim-apikey');
                if (apiKeyInput) apiKeyInput.value = '';
                alert('API Key 已清除');
            }
        });
    }

    // Generate 5SIM numbers button
    const btnGenerate = modal.querySelector('#btn-generate-fivesim');
    if (btnGenerate) {
        btnGenerate.addEventListener('click', async () => {
            const apiKey = modal.querySelector('#fivesim-apikey').value.trim();
            if (!apiKey) {
                alert('请先在 API设置 标签页填写 API Key');
                return;
            }

            const country = modal.querySelector('#fivesim-country').value;
            const service = modal.querySelector('#fivesim-service').value.trim();
            const operator = modal.querySelector('#fivesim-operator').value;
            const count = Math.max(1, Math.min(20, parseInt(modal.querySelector('#fivesim-count-input').value || '1', 10)));

            if (!service) {
                alert('请填写 service(产品代号),例如 amazon / other / ot');
                return;
            }

            const outputArea = modal.querySelector('#fivesim-output');
            const statusSpan = modal.querySelector('#fivesim-status');
            const countDisplay = modal.querySelector('#fivesim-count');

            if (outputArea) outputArea.value = '';
            if (statusSpan) {
                statusSpan.textContent = '正在向 5SIM 请求号码，请稍等...';
                statusSpan.style.color = 'var(--primary-color)';
            }

            console.log('Requesting 5SIM numbers:', { country, service, operator, count });

            // 直接调用5SIM API（API1协议 - Deprecated但仍可用）
            const results = [];
            const errors = [];

            try {
                for (let i = 0; i < count; i++) {
                    try {
                        // 构建5SIM API1请求URL
                        const params = new URLSearchParams({
                            api_key: apiKey,
                            action: 'getNumber',
                            service: service,
                            country: country,
                            operator: operator
                        });

                        const apiUrl = `http://api1.5sim.net/stubs/handler_api.php?${params.toString()}`;
                        
                        console.log(`Request ${i + 1}/${count}:`, apiUrl);

                        // 使用fetch调用API
                        const response = await fetch(apiUrl);
                        const text = await response.text();

                        console.log(`Response ${i + 1}:`, text);

                        // 解析响应（格式: ACCESS_NUMBER:订单ID:手机号）
                        if (text.startsWith('ACCESS_NUMBER:')) {
                            const parts = text.split(':');
                            if (parts.length >= 3) {
                                const orderId = parts[1];
                                const phoneNumber = parts[2];
                                
                                // 构建查询短信的URL
                                const smsCheckUrl = `http://api1.5sim.net/stubs/handler_api.php?api_key=${apiKey}&action=getStatus&id=${orderId}`;
                                
                                // 格式: +手机号----查询URL
                                results.push(`+${phoneNumber}----${smsCheckUrl}`);
                                
                                if (statusSpan) {
                                    statusSpan.textContent = `已生成 ${results.length}/${count} 个号码...`;
                                }
                            }
                        } else if (text.startsWith('NO_NUMBERS')) {
                            errors.push(`请求 ${i + 1}: 暂无可用号码`);
                            console.warn(`No numbers available for request ${i + 1}`);
                        } else if (text.startsWith('BAD_KEY')) {
                            alert('API Key 无效，请检查后重试');
                            if (statusSpan) {
                                statusSpan.textContent = 'API Key 无效';
                                statusSpan.style.color = 'var(--error-color)';
                            }
                            return;
                        } else if (text.startsWith('NO_BALANCE')) {
                            alert('账户余额不足');
                            if (statusSpan) {
                                statusSpan.textContent = '账户余额不足';
                                statusSpan.style.color = 'var(--error-color)';
                            }
                            return;
                        } else {
                            errors.push(`请求 ${i + 1}: ${text}`);
                            console.warn(`Unexpected response for request ${i + 1}:`, text);
                        }

                        // 延迟500ms避免请求过快
                        if (i < count - 1) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }

                    } catch (error) {
                        errors.push(`请求 ${i + 1}: ${error.message}`);
                        console.error(`Request ${i + 1} failed:`, error);
                    }
                }

                // 显示结果
                if (results.length > 0) {
                    if (outputArea) outputArea.value = results.join('\n');
                    if (statusSpan) {
                        statusSpan.textContent = `成功生成 ${results.length} 个号码${errors.length > 0 ? ` (${errors.length}个失败)` : ''}`;
                        statusSpan.style.color = 'var(--success-color)';
                    }
                    if (countDisplay) countDisplay.textContent = results.length;

                    if (errors.length > 0) {
                        console.warn('Some requests failed:', errors);
                    }
                } else {
                    alert('未能生成任何号码\n' + errors.join('\n'));
                    if (statusSpan) {
                        statusSpan.textContent = '生成失败';
                        statusSpan.style.color = 'var(--error-color)';
                    }
                }

            } catch (error) {
                console.error('5SIM request failed:', error);
                alert('请求失败: ' + error.message);
                if (statusSpan) {
                    statusSpan.textContent = '请求失败: ' + error.message;
                    statusSpan.style.color = 'var(--error-color)';
                }
            }
        });
    }

    // Copy to clipboard button
    const btnCopy = modal.querySelector('#btn-copy-fivesim');
    if (btnCopy) {
        btnCopy.addEventListener('click', async () => {
            const outputArea = modal.querySelector('#fivesim-output');
            const text = outputArea ? outputArea.value : '';
            
            if (!text.trim()) {
                alert('没有内容可以复制');
                return;
            }
            
            try {
                await navigator.clipboard.writeText(text);
                alert('已复制到剪贴板');
            } catch (err) {
                console.error('Copy failed:', err);
                alert('复制失败，可以手动 Ctrl+C');
            }
        });
    }
}

// Close modal
function closeModal() {
    const modal = document.getElementById('tool-modal');
    modal.classList.remove('active');
}

// Update task status
function updateTaskStatus(status) {
    const statusText = document.querySelector('.status-text');
    const statusIndicator = document.querySelector('.status-indicator');

    if (status === 'running') {
        statusText.textContent = 'Running';
        statusIndicator.style.background = 'var(--success-color)';
    } else if (status === 'stop') {
        statusText.textContent = 'Stopped';
        statusIndicator.style.background = 'var(--error-color)';
    } else {
        statusText.textContent = 'Ready';
        statusIndicator.style.background = 'var(--warning-color)';
    }
}

// Add log message
function addLogMessage(log) {
    const logContent = document.getElementById('log-content');
    const logPanel = document.getElementById('log-panel');

    // Show log panel
    logPanel.classList.add('active');

    const logItem = document.createElement('div');
    logItem.className = `log-item ${getLogType(log.logID)}`;

    const time = new Date().toLocaleTimeString();
    logItem.innerHTML = `
        <span class="log-time">[${time}]</span>
        <span class="log-message">${log.message}</span>
    `;

    logContent.appendChild(logItem);

    // Auto scroll to bottom
    logContent.scrollTop = logContent.scrollHeight;
}

// Get log type from logID
function getLogType(logID) {
    if (logID.includes('Error')) return 'error';
    if (logID.includes('Success')) return 'success';
    if (logID.includes('Warn')) return 'warning';
    return 'info';
}

// Clear log
function clearLog() {
    const logContent = document.getElementById('log-content');
    logContent.innerHTML = '<div class="log-item info"><span class="log-time">[' +
        new Date().toLocaleTimeString() +
        ']</span><span class="log-message">Log cleared</span></div>';
}

// Initialize particles background
function initializeParticles() {
    if (typeof particlesJS !== 'undefined') {
        particlesJS('particles-js', {
            particles: {
                number: { value: 80, density: { enable: true, value_area: 800 } },
                color: { value: '#667eea' },
                shape: { type: 'circle' },
                opacity: { value: 0.5, random: false },
                size: { value: 3, random: true },
                line_linked: {
                    enable: true,
                    distance: 150,
                    color: '#667eea',
                    opacity: 0.4,
                    width: 1
                },
                move: {
                    enable: true,
                    speed: 2,
                    direction: 'none',
                    random: false,
                    straight: false,
                    out_mode: 'out',
                    bounce: false
                }
            },
            interactivity: {
                detect_on: 'canvas',
                events: {
                    onhover: { enable: true, mode: 'repulse' },
                    onclick: { enable: true, mode: 'push' },
                    resize: true
                },
                modes: {
                    repulse: { distance: 100, duration: 0.4 },
                    push: { particles_nb: 4 }
                }
            },
            retina_detect: true
        });
    }
}
