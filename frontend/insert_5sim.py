import re

# Read the original file
with open(r'C:\Users\sxh\toolbox-rebuild\frontend\src\renderer\js\tools.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 5SIM tool definition to insert
fivesim_tool = """        ,
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
        }"""

# Find the position to insert (before 'cookie-transformer')
pattern = r"(\s*},\s*'cookie-transformer':)"
match = re.search(pattern, content)

if match:
    insert_pos = match.start()
    new_content = content[:insert_pos] + fivesim_tool + "\n" + content[insert_pos:]
    
    # Now add the listener function setup case
    # Find the switch case for cookie-transformer
    case_pattern = r"(case 'amazon-register':\s+setupRegisterListeners\(\);\s+break;)"
    case_match = re.search(case_pattern, new_content)
    
    if case_match:
        case_insert_pos = case_match.end()
        listener_case = "\n        case '5sim-sms-verification':\n            setup5simListeners();\n            break;"
        new_content = new_content[:case_insert_pos] + listener_case + new_content[case_insert_pos:]
    
    # Add the setup5simListeners function at the end (before updateCardListDisplay)
    listener_function = """

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

            if (!window.appSocket) {
                alert('WebSocket未连接，请检查后端服务');
                if (statusSpan) {
                    statusSpan.textContent = 'WebSocket未连接';
                    statusSpan.style.color = 'var(--error-color)';
                }
                return;
            }

            // Emit request to backend
            window.appSocket.emit('request.fivesim.buyNumber', {
                apiKey,
                country,
                service,
                operator,
                count
            });

            // Listen for response (only once)
            const responseHandler = (data) => {
                console.log('5SIM response:', data);
                
                if (data.success) {
                    if (outputArea) outputArea.value = data.lines.join('\\n');
                    if (statusSpan) {
                        statusSpan.textContent = `成功生成 ${data.lines.length} 个号码`;
                        statusSpan.style.color = 'var(--success-color)';
                    }
                    if (countDisplay) countDisplay.textContent = data.lines.length;
                    
                    if (data.errors && data.errors.length > 0) {
                        console.warn('Some requests failed:', data.errors);
                    }
                } else {
                    alert('生成失败: ' + (data.error || '未知错误'));
                    if (statusSpan) {
                        statusSpan.textContent = '生成失败: ' + (data.error || '未知错误');
                        statusSpan.style.color = 'var(--error-color)';
                    }
                }
                
                // Remove listener after handling
                window.appSocket.off('response.fivesim.buyNumber', responseHandler);
            };

            window.appSocket.on('response.fivesim.buyNumber', responseHandler);
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

"""
    
    # Find updateCardListDisplay function and insert before it
    func_pattern = r"(// Update card list display\nfunction updateCardListDisplay)"
    func_match = re.search(func_pattern, new_content)
    
    if func_match:
        func_insert_pos = func_match.start()
        new_content = new_content[:func_insert_pos] + listener_function + "\n" + new_content[func_insert_pos:]
    
    # Write back
    with open(r'C:\Users\sxh\toolbox-rebuild\frontend\src\renderer\js\tools.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("Successfully added 5SIM tool to tools.js")
else:
    print("Could not find insertion point")
