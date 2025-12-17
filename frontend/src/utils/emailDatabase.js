// src/utils/emailDatabase.js
// 邮箱账号数据库管理

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;

/**
 * 初始化数据库
 */
function initDatabase() {
  try {
    // 获取用户数据目录
    const userDataPath = app ? app.getPath('userData') : path.join(__dirname, '../../data');
    const dbPath = path.join(userDataPath, 'emails.db');
    
    // 确保目录存在
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    // 打开数据库
    db = new Database(dbPath);
    
    // 创建邮箱账号表
    db.exec(`
      CREATE TABLE IF NOT EXISTS email_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        birth_date TEXT,
        domain TEXT DEFAULT 'outlook.com',
        refresh_token TEXT,
        access_token TEXT,
        token_expires_at INTEGER,
        is_authorized INTEGER DEFAULT 0,
        is_used INTEGER DEFAULT 0,
        registration_date INTEGER NOT NULL,
        last_used_date INTEGER,
        notes TEXT,
        status TEXT DEFAULT 'active',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `);
    
    // 创建批量注册任务表
    db.exec(`
      CREATE TABLE IF NOT EXISTS batch_registration_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_name TEXT,
        total_count INTEGER NOT NULL,
        success_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        authorized_count INTEGER DEFAULT 0,
        domain TEXT DEFAULT 'outlook.com',
        concurrency INTEGER DEFAULT 3,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        status TEXT DEFAULT 'running',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `);
    
    // 创建任务关联表
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        email_id INTEGER NOT NULL,
        registration_order INTEGER,
        FOREIGN KEY (task_id) REFERENCES batch_registration_tasks(id),
        FOREIGN KEY (email_id) REFERENCES email_accounts(id)
      )
    `);
    
    // 创建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_email ON email_accounts(email);
      CREATE INDEX IF NOT EXISTS idx_is_authorized ON email_accounts(is_authorized);
      CREATE INDEX IF NOT EXISTS idx_is_used ON email_accounts(is_used);
      CREATE INDEX IF NOT EXISTS idx_status ON email_accounts(status);
      CREATE INDEX IF NOT EXISTS idx_task_id ON task_emails(task_id);
    `);
    
    console.log('✅ 数据库初始化成功:', dbPath);
    return db;
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
}

/**
 * 获取数据库实例
 */
function getDatabase() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * 创建批量注册任务
 */
function createBatchTask(options) {
  const db = getDatabase();
  const { taskName, totalCount, domain, concurrency } = options;
  
  const stmt = db.prepare(`
    INSERT INTO batch_registration_tasks 
    (task_name, total_count, domain, concurrency, start_time)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    taskName || `批量注册_${new Date().toLocaleString()}`,
    totalCount,
    domain || 'outlook.com',
    concurrency || 3,
    Date.now()
  );
  
  return result.lastInsertRowid;
}

/**
 * 更新批量任务状态
 */
function updateBatchTask(taskId, updates) {
  const db = getDatabase();
  const fields = [];
  const values = [];
  
  if (updates.successCount !== undefined) {
    fields.push('success_count = ?');
    values.push(updates.successCount);
  }
  if (updates.failedCount !== undefined) {
    fields.push('failed_count = ?');
    values.push(updates.failedCount);
  }
  if (updates.authorizedCount !== undefined) {
    fields.push('authorized_count = ?');
    values.push(updates.authorizedCount);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.endTime !== undefined) {
    fields.push('end_time = ?');
    values.push(updates.endTime);
  }
  
  if (fields.length === 0) return;
  
  values.push(taskId);
  
  const stmt = db.prepare(`
    UPDATE batch_registration_tasks 
    SET ${fields.join(', ')}
    WHERE id = ?
  `);
  
  stmt.run(...values);
}

/**
 * 保存邮箱账号
 */
function saveEmailAccount(account) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT INTO email_accounts 
    (email, password, first_name, last_name, birth_date, domain, 
     refresh_token, is_authorized, registration_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      password = excluded.password,
      refresh_token = excluded.refresh_token,
      is_authorized = excluded.is_authorized
  `);
  
  const result = stmt.run(
    account.email,
    account.password,
    account.firstName || null,
    account.lastName || null,
    account.birthDate || null,
    account.domain || 'outlook.com',
    account.refreshToken || null,
    account.refreshToken ? 1 : 0,
    Date.now()
  );
  
  return result.lastInsertRowid || db.prepare('SELECT id FROM email_accounts WHERE email = ?').get(account.email).id;
}

/**
 * 关联邮箱到任务
 */
function linkEmailToTask(taskId, emailId, order) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT INTO task_emails (task_id, email_id, registration_order)
    VALUES (?, ?, ?)
  `);
  
  stmt.run(taskId, emailId, order);
}

/**
 * 更新邮箱账号
 */
function updateEmailAccount(email, updates) {
  const db = getDatabase();
  const fields = [];
  const values = [];
  
  if (updates.refreshToken !== undefined) {
    fields.push('refresh_token = ?');
    values.push(updates.refreshToken);
  }
  if (updates.accessToken !== undefined) {
    fields.push('access_token = ?');
    values.push(updates.accessToken);
  }
  if (updates.tokenExpiresAt !== undefined) {
    fields.push('token_expires_at = ?');
    values.push(updates.tokenExpiresAt);
  }
  if (updates.isAuthorized !== undefined) {
    fields.push('is_authorized = ?');
    values.push(updates.isAuthorized ? 1 : 0);
  }
  if (updates.isUsed !== undefined) {
    fields.push('is_used = ?');
    values.push(updates.isUsed ? 1 : 0);
    if (updates.isUsed) {
      fields.push('last_used_date = ?');
      values.push(Date.now());
    }
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }
  
  if (fields.length === 0) return;
  
  values.push(email);
  
  const stmt = db.prepare(`
    UPDATE email_accounts 
    SET ${fields.join(', ')}
    WHERE email = ?
  `);
  
  stmt.run(...values);
}

/**
 * 查询邮箱账号
 */
function getEmailAccount(email) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM email_accounts WHERE email = ?');
  return stmt.get(email);
}

/**
 * 查询所有未授权的账号
 */
function getUnauthorizedAccounts() {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM email_accounts 
    WHERE is_authorized = 0 AND status = 'active'
    ORDER BY created_at DESC
  `);
  return stmt.all();
}

/**
 * 查询未使用的授权账号
 */
function getAvailableAccounts(limit = 10) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM email_accounts 
    WHERE is_authorized = 1 AND is_used = 0 AND status = 'active'
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

/**
 * 查询任务详情
 */
function getTaskDetails(taskId) {
  const db = getDatabase();
  
  // 获取任务信息
  const task = db.prepare('SELECT * FROM batch_registration_tasks WHERE id = ?').get(taskId);
  if (!task) return null;
  
  // 获取关联的邮箱
  const emails = db.prepare(`
    SELECT e.*, te.registration_order
    FROM email_accounts e
    JOIN task_emails te ON e.id = te.email_id
    WHERE te.task_id = ?
    ORDER BY te.registration_order
  `).all(taskId);
  
  return {
    ...task,
    emails
  };
}

/**
 * 获取统计信息
 */
function getStatistics() {
  const db = getDatabase();
  
  const total = db.prepare('SELECT COUNT(*) as count FROM email_accounts').get().count;
  const authorized = db.prepare('SELECT COUNT(*) as count FROM email_accounts WHERE is_authorized = 1').get().count;
  const unauthorized = db.prepare('SELECT COUNT(*) as count FROM email_accounts WHERE is_authorized = 0').get().count;
  const used = db.prepare('SELECT COUNT(*) as count FROM email_accounts WHERE is_used = 1').get().count;
  const available = db.prepare('SELECT COUNT(*) as count FROM email_accounts WHERE is_authorized = 1 AND is_used = 0').get().count;
  const tasks = db.prepare('SELECT COUNT(*) as count FROM batch_registration_tasks').get().count;
  
  return {
    total,
    authorized,
    unauthorized,
    used,
    available,
    tasks
  };
}

/**
 * 导出账号数据
 */
function exportAccounts(filter = {}) {
  const db = getDatabase();
  let query = 'SELECT * FROM email_accounts WHERE 1=1';
  const params = [];
  
  if (filter.isAuthorized !== undefined) {
    query += ' AND is_authorized = ?';
    params.push(filter.isAuthorized ? 1 : 0);
  }
  if (filter.isUsed !== undefined) {
    query += ' AND is_used = ?';
    params.push(filter.isUsed ? 1 : 0);
  }
  if (filter.status) {
    query += ' AND status = ?';
    params.push(filter.status);
  }
  
  query += ' ORDER BY created_at DESC';
  
  if (filter.limit) {
    query += ' LIMIT ?';
    params.push(filter.limit);
  }
  
  const stmt = db.prepare(query);
  return stmt.all(...params);
}

/**
 * 关闭数据库
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  createBatchTask,
  updateBatchTask,
  saveEmailAccount,
  linkEmailToTask,
  updateEmailAccount,
  getEmailAccount,
  getUnauthorizedAccounts,
  getAvailableAccounts,
  getTaskDetails,
  getStatistics,
  exportAccounts,
  closeDatabase
};
