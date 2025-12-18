/**
 * 账号管理界面脚本
 */

// 在独立窗口中，直接使用 require 获取数据库模块
const path = require('path');
// __dirname = frontend/src/renderer，目标 = frontend/src/refactored-backend
const accountDatabasePath = path.join(__dirname, '..', 'refactored-backend', 'database', 'accountDatabase.js');
console.log('加载数据库模块路径:', accountDatabasePath);

const { getAccountDatabase } = require(accountDatabasePath);
const accountDb = getAccountDatabase();
const { remote } = require('electron');
const fs = require('fs');

let currentPage = 1;
const pageSize = 10;
let currentFilters = {};

// 页面加载时初始化
window.addEventListener('DOMContentLoaded', () => {
    loadAccounts();
    
    // 绑定筛选器事件
    document.getElementById('filterRegister')?.addEventListener('change', applyFilters);
    document.getElementById('filterOtp')?.addEventListener('change', applyFilters);
    document.getElementById('filterAddress')?.addEventListener('change', applyFilters);
    document.getElementById('resetFilters')?.addEventListener('click', resetFilters);
    
    // 绑定导出按钮事件
    document.getElementById('exportSuccessBtn')?.addEventListener('click', exportAccounts);
    document.getElementById('exportFailedBtn')?.addEventListener('click', exportFailedAccounts);
});

/**
 * 加载账号列表
 */
async function loadAccounts() {
    try {
        const result = accountDb.getAccounts(currentPage, pageSize, currentFilters);
        renderTable(result);
        renderPagination(result);
    } catch (error) {
        console.error('加载账号列表失败:', error);
        alert('加载失败: ' + error.message);
    }
}

/**
 * 渲染表格
 */
function renderTable(result) {
    const tbody = document.getElementById('accountTableBody');
    
    if (result.data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    <div>📭</div>
                    <div>暂无数据</div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = result.data.map(account => `
        <tr>
            <td>${account.id}</td>
            <td>${escapeHtml(account.email)}</td>
            <td>${escapeHtml(account.password)}</td>
            <td>${escapeHtml(account.name || '-')}</td>
            <td class="otp-secret" title="${escapeHtml(account.otpSecret || '')}">${escapeHtml(account.otpSecret || '-')}</td>
            <td>
                <select class="status-select ${account.registerSuccess ? 'status-yes' : 'status-no'}" 
                        onchange="updateStatus(${account.id}, 'registerSuccess', this.value)">
                    <option value="1" ${account.registerSuccess ? 'selected' : ''}>是</option>
                    <option value="0" ${!account.registerSuccess ? 'selected' : ''}>否</option>
                </select>
            </td>
            <td>
                <select class="status-select ${account.otpSuccess ? 'status-yes' : 'status-no'}" 
                        onchange="updateStatus(${account.id}, 'otpSuccess', this.value)">
                    <option value="1" ${account.otpSuccess ? 'selected' : ''}>是</option>
                    <option value="0" ${!account.otpSuccess ? 'selected' : ''}>否</option>
                </select>
            </td>
            <td>
                <select class="status-select ${account.addressSuccess ? 'status-yes' : 'status-no'}" 
                        onchange="updateStatus(${account.id}, 'addressSuccess', this.value)">
                    <option value="1" ${account.addressSuccess ? 'selected' : ''}>是</option>
                    <option value="0" ${!account.addressSuccess ? 'selected' : ''}>否</option>
                </select>
            </td>
            <td>${formatDate(account.registerTime)}</td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-danger btn-small" onclick="deleteAccount(${account.id})">删除</button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * 渲染分页
 */
function renderPagination(result) {
    const pagination = document.getElementById('pagination');
    
    if (result.totalPages === 0) {
        pagination.innerHTML = '';
        return;
    }

    pagination.innerHTML = `
        <button onclick="goToPage(1)" ${currentPage === 1 ? 'disabled' : ''}>首页</button>
        <button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>
        <span class="page-info">第 ${currentPage} / ${result.totalPages} 页 (共 ${result.total} 条)</span>
        <button onclick="goToPage(${currentPage + 1})" ${currentPage === result.totalPages ? 'disabled' : ''}>下一页</button>
        <button onclick="goToPage(${result.totalPages})" ${currentPage === result.totalPages ? 'disabled' : ''}>末页</button>
    `;
}

/**
 * 跳转页面
 */
function goToPage(page) {
    currentPage = page;
    loadAccounts();
}

/**
 * 应用筛选
 */
function applyFilters() {
    const registerFilter = document.getElementById('filterRegister').value;
    const otpFilter = document.getElementById('filterOtp').value;
    const addressFilter = document.getElementById('filterAddress').value;

    currentFilters = {};
    if (registerFilter !== '') {
        currentFilters.registerSuccess = registerFilter === '1';
    }
    if (otpFilter !== '') {
        currentFilters.otpSuccess = otpFilter === '1';
    }
    if (addressFilter !== '') {
        currentFilters.addressSuccess = addressFilter === '1';
    }

    currentPage = 1;
    loadAccounts();
}

/**
 * 重置筛选
 */
function resetFilters() {
    document.getElementById('filterRegister').value = '';
    document.getElementById('filterOtp').value = '';
    document.getElementById('filterAddress').value = '';
    currentFilters = {};
    currentPage = 1;
    loadAccounts();
}

/**
 * 更新账号状态
 */
async function updateStatus(id, field, value) {
    try {
        const statusData = {};
        statusData[field] = value === '1';
        accountDb.updateAccountStatus(id, statusData);
        console.log(`✅ 状态已更新: ID=${id}, ${field}=${value}`);
        // 不需要重新加载，因为下拉框已经显示新值
    } catch (error) {
        console.error('更新状态失败:', error);
        alert('更新失败: ' + error.message);
        loadAccounts(); // 重新加载以还原状态
    }
}

/**
 * 删除账号
 */
async function deleteAccount(id) {
    if (!confirm('确定要删除这个账号吗？')) {
        return;
    }

    try {
        accountDb.deleteAccount(id);
        console.log(`✅ 账号已删除: ID=${id}`);
        loadAccounts();
    } catch (error) {
        console.error('删除账号失败:', error);
        alert('删除失败: ' + error.message);
    }
}

/**
 * 导出成功账号
 */
async function exportAccounts() {
    try {
        const filters = { registerSuccess: true };
        const accounts = accountDb.getAllAccounts(filters);
        
        if (accounts.length === 0) {
            alert('没有找到符合条件的账号');
            return;
        }
        
        // 格式化导出数据
        const exportData = accounts.map(acc => 
            `${acc.email}----${acc.password}----${acc.otpSecret || ''}`
        ).join('\n');
        
        // 使用对话框选择保存位置
        const { dialog } = remote;
        const result = await dialog.showSaveDialog({
            title: '导出成功账号',
            defaultPath: `success_accounts_${Date.now()}.txt`,
            filters: [
                { name: 'Text Files', extensions: ['txt'] }
            ]
        });
        
        if (!result.canceled && result.filePath) {
            fs.writeFileSync(result.filePath, exportData, 'utf8');
            alert(`导出成功！共导出 ${accounts.length} 个账号`);
        }
    } catch (error) {
        console.error('导出失败:', error);
        alert('导出失败: ' + error.message);
    }
}

/**
 * 导出失败账号
 */
async function exportFailedAccounts() {
    try {
        const filters = { registerSuccess: false };
        const accounts = accountDb.getAllAccounts(filters);
        
        if (accounts.length === 0) {
            alert('没有找到符合条件的账号');
            return;
        }
        
        // 格式化导出数据
        const exportData = accounts.map(acc => 
            `${acc.email}----${acc.password}----${acc.otpSecret || ''}`
        ).join('\n');
        
        // 使用对话框选择保存位置
        const { dialog } = remote;
        const result = await dialog.showSaveDialog({
            title: '导出失败账号',
            defaultPath: `failed_accounts_${Date.now()}.txt`,
            filters: [
                { name: 'Text Files', extensions: ['txt'] }
            ]
        });
        
        if (!result.canceled && result.filePath) {
            fs.writeFileSync(result.filePath, exportData, 'utf8');
            alert(`导出成功！共导出 ${accounts.length} 个账号`);
        }
    } catch (error) {
        console.error('导出失败:', error);
        alert('导出失败: ' + error.message);
    }
}

/**
 * 返回主界面
 */
function goBack() {
    window.close(); // 关闭当前窗口
}

/**
 * 格式化日期
 */
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * HTML转义
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
