// src/utils/emailDatabaseJSON.js
// 邮箱账号数据库管理 - JSON存储版本（不需要编译）

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let dataPath = null;
let accountsFile = null;
let tasksFile = null;

/**
 * 初始化数据库
 */
function initDatabase() {
  return Promise.resolve().then(() => {
    // 获取用户数据目录
    const userDataPath = app ? app.getPath('userData') : path.join(__dirname, '../../data');
    dataPath = path.join(userDataPath, 'emailData');
    
    // 确保目录存在
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
    }
    
    accountsFile = path.join(dataPath, 'accounts.json');
    tasksFile = path.join(dataPath, 'tasks.json');
    
    // 初始化文件
    if (!fs.existsSync(accountsFile)) {
      fs.writeFileSync(accountsFile, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(tasksFile)) {
      fs.writeFileSync(tasksFile, JSON.stringify([], null, 2));
    }
    
    console.log('✅ JSON数据库初始化成功:', dataPath);
    return dataPath;
  }).catch(error => {
    console.error('❌ JSON数据库初始化失败:', error);
    throw error;
  });
}

// 辅助函数：读取JSON文件
function readJSON(file) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`读取${file}失败:`, error);
    return [];
  }
}

// 辅助函数：写入JSON文件
function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`写入${file}失败:`, error);
    return false;
  }
}

/**
 * 保存邮箱账号
 */
async function saveEmailAccount(account) {
  const accounts = readJSON(accountsFile);
  
  // 检查是否已存在
  const existingIndex = accounts.findIndex(a => a.email === account.email);
  
  const now = new Date().toISOString();
  const accountData = {
    id: existingIndex >= 0 ? accounts[existingIndex].id : Date.now(),
    email: account.email,
    password: account.password,
    refresh_token: account.refresh_token || null,
    access_token: account.access_token || null,
    token_expires_at: account.token_expires_at || null,
    is_authorized: account.is_authorized || 0,
    is_used: account.is_used || 0,
    created_at: existingIndex >= 0 ? accounts[existingIndex].created_at : now,
    updated_at: now
  };
  
  if (existingIndex >= 0) {
    accounts[existingIndex] = accountData;
  } else {
    accounts.push(accountData);
  }
  
  writeJSON(accountsFile, accounts);
  return accountData;
}

/**
 * 更新邮箱账号
 */
function updateEmailAccount(email, updates) {
  const accounts = readJSON(accountsFile);
  const index = accounts.findIndex(a => a.email === email);
  
  if (index === -1) {
    throw new Error(`账号不存在: ${email}`);
  }
  
  accounts[index] = {
    ...accounts[index],
    ...updates,
    updated_at: new Date().toISOString()
  };
  
  writeJSON(accountsFile, accounts);
  return accounts[index];
}

/**
 * 获取邮箱账号
 */
function getEmailAccount(email) {
  const accounts = readJSON(accountsFile);
  return accounts.find(a => a.email === email) || null;
}

/**
 * 获取所有未授权账号
 */
function getUnauthorizedAccounts() {
  const accounts = readJSON(accountsFile);
  return accounts.filter(a => !a.is_authorized);
}

/**
 * 获取所有可用账号（已授权且未使用）
 */
function getAvailableAccounts() {
  const accounts = readJSON(accountsFile);
  return accounts.filter(a => a.is_authorized && !a.is_used);
}

/**
 * 创建批量任务
 */
function createBatchTask(config) {
  const tasks = readJSON(tasksFile);
  
  const task = {
    id: Date.now(),
    quantity: config.quantity,
    start_time: new Date().toISOString(),
    end_time: null,
    status: 'running',
    success_count: 0,
    fail_count: 0,
    config: JSON.stringify(config)
  };
  
  tasks.push(task);
  writeJSON(tasksFile, tasks);
  
  return task.id;
}

/**
 * 更新批量任务
 */
function updateBatchTask(taskId, data) {
  const tasks = readJSON(tasksFile);
  const index = tasks.findIndex(t => t.id === taskId);
  
  if (index === -1) {
    throw new Error(`任务不存在: ${taskId}`);
  }
  
  tasks[index] = {
    ...tasks[index],
    ...data
  };
  
  writeJSON(tasksFile, tasks);
}

/**
 * 关联邮箱到任务
 */
function linkEmailToTask(taskId, email) {
  const account = getEmailAccount(email);
  if (!account) {
    throw new Error(`账号不存在: ${email}`);
  }
  
  updateEmailAccount(email, {
    task_id: taskId,
    is_used: 1
  });
}

/**
 * 获取任务关联的邮箱
 */
function getTaskEmails(taskId) {
  const accounts = readJSON(accountsFile);
  return accounts.filter(a => a.task_id === taskId);
}

/**
 * 获取统计信息
 */
function getStatistics() {
  const accounts = readJSON(accountsFile);
  const tasks = readJSON(tasksFile);
  
  return {
    total: accounts.length,
    authorized: accounts.filter(a => a.is_authorized).length,
    unauthorized: accounts.filter(a => !a.is_authorized).length,
    used: accounts.filter(a => a.is_used).length,
    available: accounts.filter(a => a.is_authorized && !a.is_used).length,
    tasks: tasks.length
  };
}

/**
 * 导出账号
 */
function exportAccounts(filter = {}) {
  let accounts = readJSON(accountsFile);
  
  // 应用过滤
  if (filter.onlyAuthorized) {
    accounts = accounts.filter(a => a.is_authorized);
  }
  if (filter.onlyAvailable) {
    accounts = accounts.filter(a => a.is_authorized && !a.is_used);
  }
  
  // 根据格式导出
  const format = filter.format || 'json';
  
  switch (format) {
    case 'json':
      return accounts;
      
    case 'csv':
      let csv = 'email,password,refresh_token,is_authorized,is_used\n';
      accounts.forEach(a => {
        csv += `${a.email},${a.password},${a.refresh_token || ''},${a.is_authorized},${a.is_used}\n`;
      });
      return csv;
      
    case 'txt':
      return accounts.map(a => `${a.email}:${a.password}`).join('\n');
      
    default:
      return accounts;
  }
}

module.exports = {
  initDatabase,
  saveEmailAccount,
  updateEmailAccount,
  getEmailAccount,
  getUnauthorizedAccounts,
  getAvailableAccounts,
  createBatchTask,
  updateBatchTask,
  linkEmailToTask,
  getTaskEmails,
  getStatistics,
  exportAccounts
};
