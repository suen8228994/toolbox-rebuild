// proxyGeneration.js - 代理生成功能

function initProxyGeneration() {
    const quantityInput = document.getElementById('proxy-quantity');
    const countrySelect = document.getElementById('proxy-country');
    const prefixInput = document.getElementById('proxy-prefix');
    const passwordInput = document.getElementById('proxy-password');
    const generateBtn = document.getElementById('btn-generate-proxies');
    const clearBtn = document.getElementById('btn-clear-proxies');
    const copyBtn = document.getElementById('btn-copy-proxies');
    const outputArea = document.getElementById('proxy-output');
    const countDisplay = document.getElementById('proxy-count');

    if (!generateBtn || !outputArea) {
        console.warn('代理生成: UI元素未找到');
        return;
    }

    // 更新计数
    function updateCount() {
        const lines = outputArea.value.split('\n').filter(line => line.trim());
        if (countDisplay) {
            countDisplay.textContent = lines.length;
        }
    }

    // 生成代理
    generateBtn.addEventListener('click', async () => {
        const quantity = parseInt(quantityInput.value) || 1;
        let country = countrySelect.value;
        const prefix = prefixInput.value.trim() || 'rZwC7qlCe8';
        const password = passwordInput.value.trim() || '52572596';

        // 如果选择了随机，从可用国家中随机选择一个
        if (country === 'RANDOM') {
            const countries = ['IN','ID','JP','KR','HK','PH','SG','VN','MM','TH','MY','TW','KP','BD','BT','MV','NP','PK','LK','BH','KW','OM','SE','QA','SA','AE','YE','CY','IQ','IL','JO','LB','PS','SY','AF','AM','AZ','IR','TR','KZ','KG','TJ','TM','UZ','GE','TL','MO','GB','FR','RU','IT','DE','LU','BY','BE','AT','ES','IE','FI','VA','PT','LV','PL','LT','HU','MD','NL','CH','MC','CZ','NO','IS','GR','MT','EE','UA','HR','US','CA','JM','LC','MX','PA','BR','AR','CO','CL','VE','PE','NZ','PW','AU','MG','MZ','ZA','ET','KE','GH','NG','DZ'];
            country = countries[Math.floor(Math.random() * countries.length)];
            console.log(`随机选择国家: ${country}`);
        }

        if (quantity < 1 || quantity > 100) {
            alert('数量必须在 1-100 之间');
            return;
        }

        generateBtn.disabled = true;
        generateBtn.textContent = '生成中...';

        try {
            // 调用preload暴露的API
            if (!window.proxyGeneratorAPI) {
                throw new Error('proxyGeneratorAPI 未找到，请检查preload.js');
            }

            const proxies = await window.proxyGeneratorAPI.generateProxies({
                country,
                quantity,
                prefix,
                password
            });

            // 显示结果
            if (outputArea.value) {
                outputArea.value += '\n' + proxies.join('\n');
            } else {
                outputArea.value = proxies.join('\n');
            }

            updateCount();
            
            // 显示成功提示
            const originalText = generateBtn.textContent;
            generateBtn.textContent = `✅ 成功生成 ${proxies.length} 个`;
            setTimeout(() => {
                generateBtn.textContent = originalText;
            }, 2000);

        } catch (error) {
            console.error('生成代理失败:', error);
            alert('生成失败: ' + error.message);
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = '生成代理';
        }
    });

    // 清空结果
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            outputArea.value = '';
            updateCount();
        });
    }

    // 复制到剪贴板
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const text = outputArea.value;
            if (!text.trim()) {
                alert('没有内容可以复制');
                return;
            }

            try {
                await navigator.clipboard.writeText(text);
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✅ 已复制';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 2000);
            } catch (err) {
                console.error('复制失败:', err);
                alert('复制失败，请手动复制');
            }
        });
    }

    // 初始化计数
    updateCount();
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.initProxyGeneration = initProxyGeneration;
}
