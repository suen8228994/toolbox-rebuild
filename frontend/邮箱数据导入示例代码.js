/**
 * 原始Toolbox邮箱数据导入处理示例代码
 * 
 * 根据对原始toolbox的分析,这里展示了前端如何处理邮箱数据文件
 */

// ============================================
// 1. 数据格式说明
// ============================================

/**
 * TXT格式 (每行一个账号):
 * email1|client_id1|refresh_token1
 * email2|client_id2|refresh_token2
 * email3|client_id3|refresh_token3
 */

/**
 * JSON格式 (与LocalStorage msTokenHistory一致):
 * [
 *   {
 *     "email": "example1@outlook.com",
 *     "token": "example1@outlook.com|client_id|refresh_token",
 *     "time": "2025/12/11 22:30:45"
 *   },
 *   {
 *     "email": "example2@outlook.com",
 *     "token": "example2@outlook.com|client_id|refresh_token",
 *     "time": "2025/12/11 22:31:00"
 *   }
 * ]
 */

// ============================================
// 2. 文件选择和读取
// ============================================

function selectAndReadFile() {
    // 创建文件输入元素
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.json';
    
    input.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const content = await readFileContent(file);
            const accounts = parseFileContent(content, file.name);
            
            if (accounts.length === 0) {
                alert('未找到有效的邮箱数据');
                return;
            }
            
            // 保存到LocalStorage
            saveToLocalStorage(accounts);
            
            alert(`成功导入 ${accounts.length} 个邮箱账号`);
            
            // 显示导入的账号
            displayAccounts(accounts);
            
        } catch (error) {
            alert('文件读取失败: ' + error.message);
            console.error(error);
        }
    });
    
    input.click();
}

// ============================================
// 3. 文件内容读取
// ============================================

function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            resolve(e.target.result);
        };
        
        reader.onerror = () => {
            reject(new Error('文件读取失败'));
        };
        
        // 以文本格式读取
        reader.readAsText(file, 'UTF-8');
    });
}

// ============================================
// 4. 解析文件内容
// ============================================

function parseFileContent(content, filename) {
    const accounts = [];
    
    // 判断文件类型
    const isJson = filename.toLowerCase().endsWith('.json');
    
    if (isJson) {
        // JSON格式解析
        try {
            const jsonData = JSON.parse(content);
            
            if (Array.isArray(jsonData)) {
                // 直接是数组格式
                for (const item of jsonData) {
                    const account = parseJsonItem(item);
                    if (account) accounts.push(account);
                }
            } else if (jsonData.email && jsonData.token) {
                // 单个对象
                const account = parseJsonItem(jsonData);
                if (account) accounts.push(account);
            }
        } catch (error) {
            throw new Error('JSON格式错误: ' + error.message);
        }
    } else {
        // TXT格式解析 (每行一个账号)
        const lines = content.split(/\r?\n/);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('#')) continue; // 跳过空行和注释
            
            const account = parseTextLine(line, i + 1);
            if (account) accounts.push(account);
        }
    }
    
    return accounts;
}

// ============================================
// 5. 解析JSON项
// ============================================

function parseJsonItem(item) {
    if (!item.email || !item.token) {
        console.warn('JSON项缺少必要字段:', item);
        return null;
    }
    
    // 验证token格式: email|client_id|refresh_token
    const parts = item.token.split('|');
    if (parts.length !== 3) {
        console.warn('Token格式错误:', item.token);
        return null;
    }
    
    return {
        email: parts[0].trim(),
        clientId: parts[1].trim(),
        refreshToken: parts[2].trim(),
        token: item.token,
        time: item.time || new Date().toLocaleString()
    };
}

// ============================================
// 6. 解析文本行
// ============================================

function parseTextLine(line, lineNumber) {
    // 格式: email|client_id|refresh_token
    const parts = line.split('|');
    
    if (parts.length !== 3) {
        console.warn(`第${lineNumber}行格式错误:`, line);
        return null;
    }
    
    const email = parts[0].trim();
    const clientId = parts[1].trim();
    const refreshToken = parts[2].trim();
    
    // 简单验证
    if (!email || !clientId || !refreshToken) {
        console.warn(`第${lineNumber}行数据不完整:`, line);
        return null;
    }
    
    // 验证邮箱格式
    if (!email.includes('@')) {
        console.warn(`第${lineNumber}行邮箱格式错误:`, email);
        return null;
    }
    
    return {
        email: email,
        clientId: clientId,
        refreshToken: refreshToken,
        token: line,
        time: new Date().toLocaleString()
    };
}

// ============================================
// 7. 保存到LocalStorage
// ============================================

function saveToLocalStorage(accounts) {
    // 读取现有历史记录
    const history = JSON.parse(localStorage.getItem('msTokenHistory') || '[]');
    
    // 转换为LocalStorage格式
    const newItems = accounts.map(acc => ({
        email: acc.email,
        token: acc.token,
        time: acc.time
    }));
    
    // 合并并去重(基于email)
    const emailSet = new Set();
    const merged = [];
    
    // 先添加新导入的
    for (const item of newItems) {
        if (!emailSet.has(item.email)) {
            emailSet.add(item.email);
            merged.push(item);
        }
    }
    
    // 再添加历史记录中不重复的
    for (const item of history) {
        if (!emailSet.has(item.email)) {
            emailSet.add(item.email);
            merged.push(item);
        }
    }
    
    // 限制最多保存100个
    if (merged.length > 100) {
        merged.length = 100;
    }
    
    // 保存
    localStorage.setItem('msTokenHistory', JSON.stringify(merged));
}

// ============================================
// 8. 显示账号列表
// ============================================

function displayAccounts(accounts) {
    console.log('=== 导入的邮箱账号 ===');
    accounts.forEach((acc, idx) => {
        console.log(`${idx + 1}. ${acc.email}`);
        console.log(`   Client ID: ${acc.clientId}`);
        console.log(`   Refresh Token: ${acc.refreshToken.substring(0, 50)}...`);
        console.log(`   Time: ${acc.time}`);
        console.log('');
    });
}

// ============================================
// 9. 调用后端API (发送到NestJS后端)
// ============================================

async function callBackendAPI(account) {
    try {
        const response = await fetch('http://localhost:6790/v2/email/all', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: account.clientId,
                refresh_token: account.refreshToken
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        console.error('调用后端API失败:', error);
        throw error;
    }
}

// ============================================
// 10. 使用示例
// ============================================

// 在HTML中添加按钮:
// <button onclick="selectAndReadFile()">导入邮箱数据</button>

// 或者在页面加载时自动显示已保存的账号:
document.addEventListener('DOMContentLoaded', () => {
    const history = JSON.parse(localStorage.getItem('msTokenHistory') || '[]');
    console.log(`已保存 ${history.length} 个邮箱账号`);
    
    if (history.length > 0) {
        console.log('最近的账号:');
        history.slice(0, 5).forEach((item, idx) => {
            console.log(`${idx + 1}. ${item.email} (${item.time})`);
        });
    }
});

// ============================================
// 11. 批量调用示例
// ============================================

async function batchCallAPI() {
    const history = JSON.parse(localStorage.getItem('msTokenHistory') || '[]');
    
    for (let i = 0; i < history.length; i++) {
        const item = history[i];
        const parts = item.token.split('|');
        
        if (parts.length !== 3) continue;
        
        const account = {
            email: parts[0],
            clientId: parts[1],
            refreshToken: parts[2]
        };
        
        console.log(`正在处理账号 ${i + 1}/${history.length}: ${account.email}`);
        
        try {
            const result = await callBackendAPI(account);
            console.log(`成功获取邮件:`, result.length);
        } catch (error) {
            console.error(`账号 ${account.email} 处理失败:`, error.message);
        }
        
        // 延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('批量处理完成');
}

// ============================================
// 12. 导出当前所有账号
// ============================================

function exportAllAccounts() {
    const history = JSON.parse(localStorage.getItem('msTokenHistory') || '[]');
    
    if (history.length === 0) {
        alert('没有可导出的账号');
        return;
    }
    
    // 提供两种格式选择
    const choice = confirm('点击【确定】导出为TXT格式\n点击【取消】导出为JSON格式');
    
    let content, filename, mimeType;
    
    if (choice) {
        // TXT格式
        content = history.map(item => item.token).join('\n');
        filename = 'exported_accounts_' + Date.now() + '.txt';
        mimeType = 'text/plain;charset=utf-8';
    } else {
        // JSON格式
        content = JSON.stringify(history, null, 2);
        filename = 'exported_accounts_' + Date.now() + '.json';
        mimeType = 'application/json;charset=utf-8';
    }
    
    // 下载文件
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    alert(`已导出 ${history.length} 个账号到文件: ${filename}`);
}

// 导出函数供全局使用
window.EmailImporter = {
    selectAndReadFile,
    exportAllAccounts,
    batchCallAPI,
    callBackendAPI
};
