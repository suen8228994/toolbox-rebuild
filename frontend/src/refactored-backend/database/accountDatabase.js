/**
 * 账号数据库管理模块
 * 支持 SQLite 或 JSON 文件存储
 */

const path = require('path');
const fs = require('fs');

let Database;
let useSQLite = false; // 默认使用 JSON，除非 SQLite 可用

try {
  Database = require('better-sqlite3');
  // 尝试创建一个测试数据库
  const testDb = new Database(':memory:');
  testDb.close();
  useSQLite = true;
  console.log('✅ better-sqlite3 可用，使用 SQLite 模式');
} catch (err) {
  console.warn('⚠️  better-sqlite3 不可用，使用 JSON 文件存储');
  console.warn('   原因:', err.message);
}

class AccountDatabase {
  constructor() {
    console.log('初始化 AccountDatabase...');
    console.log('存储模式:', useSQLite ? 'SQLite' : 'JSON');
    
    // 数据库文件路径
    const dbDir = path.join(__dirname, '../../data');
    console.log('数据库目录:', dbDir);
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log('✅ 数据库目录已创建');
    }
    
    if (useSQLite) {
      this.dbPath = path.join(dbDir, 'accounts.db');
      console.log('数据库文件路径:', this.dbPath);
      this.db = null;
      this.initSQLite();
    } else {
      this.jsonPath = path.join(dbDir, 'accounts.json');
      console.log('JSON 文件路径:', this.jsonPath);
      this.initJSON();
    }
  }

  // ===== SQLite 模式 =====

  initSQLite() {
    this.db = new Database(this.dbPath);
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        otpSecret TEXT,
        registerSuccess INTEGER DEFAULT 0,
        otpSuccess INTEGER DEFAULT 0,
        addressSuccess INTEGER DEFAULT 0,
        registerTime INTEGER NOT NULL,
        updateTime INTEGER NOT NULL,
        notes TEXT
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_email ON accounts(email);
      CREATE INDEX IF NOT EXISTS idx_registerTime ON accounts(registerTime DESC);
    `);
    
    console.log('✅ SQLite 数据库初始化完成');
  }

  // ===== JSON 模式 =====

  initJSON() {
    this.jsonData = { accounts: [], nextId: 1 };
    
    if (fs.existsSync(this.jsonPath)) {
      try {
        const content = fs.readFileSync(this.jsonPath, 'utf8');
        this.jsonData = JSON.parse(content);
        if (!Array.isArray(this.jsonData.accounts)) {
          this.jsonData.accounts = [];
        }
        if (typeof this.jsonData.nextId !== 'number') {
          this.jsonData.nextId = this.jsonData.accounts.length > 0 
            ? Math.max(...this.jsonData.accounts.map(a => a.id)) + 1 
            : 1;
        }
        console.log('✅ JSON 文件加载成功，账号数:', this.jsonData.accounts.length);
      } catch (err) {
        console.error('❌ JSON 文件解析失败:', err.message);
        console.log('创建新的 JSON 文件');
        this.saveJSON();
      }
    } else {
      this.saveJSON();
      console.log('✅ 新 JSON 文件已创建');
    }
  }

  saveJSON() {
    fs.writeFileSync(this.jsonPath, JSON.stringify(this.jsonData, null, 2), 'utf8');
  }

  // ===== 公共接口 =====

  insertAccount(accountData) {
    if (useSQLite) {
      return this.insertAccountSQLite(accountData);
    } else {
      return this.insertAccountJSON(accountData);
    }
  }

  insertAccountSQLite(accountData) {
    const stmt = this.db.prepare(`
      INSERT INTO accounts (
        email, password, name, otpSecret, 
        registerSuccess, otpSuccess, addressSuccess,
        registerTime, updateTime, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();
    const result = stmt.run(
      accountData.email,
      accountData.password,
      accountData.name || '',
      accountData.otpSecret || '',
      accountData.registerSuccess ? 1 : 0,
      accountData.otpSuccess ? 1 : 0,
      accountData.addressSuccess ? 1 : 0,
      now,
      now,
      accountData.notes || ''
    );

    return result.lastInsertRowid;
  }

  insertAccountJSON(accountData) {
    const now = Date.now();
    const account = {
      id: this.jsonData.nextId++,
      email: accountData.email,
      password: accountData.password,
      name: accountData.name || '',
      otpSecret: accountData.otpSecret || '',
      registerSuccess: accountData.registerSuccess ? 1 : 0,
      otpSuccess: accountData.otpSuccess ? 1 : 0,
      addressSuccess: accountData.addressSuccess ? 1 : 0,
      registerTime: now,
      updateTime: now,
      notes: accountData.notes || ''
    };
    
    this.jsonData.accounts.push(account);
    this.saveJSON();
    return account.id;
  }

  updateAccountStatus(id, statusData) {
    if (useSQLite) {
      return this.updateAccountStatusSQLite(id, statusData);
    } else {
      return this.updateAccountStatusJSON(id, statusData);
    }
  }

  updateAccountStatusSQLite(id, statusData) {
    const fields = [];
    const values = [];

    if (statusData.registerSuccess !== undefined) {
      fields.push('registerSuccess = ?');
      values.push(statusData.registerSuccess ? 1 : 0);
    }
    if (statusData.otpSuccess !== undefined) {
      fields.push('otpSuccess = ?');
      values.push(statusData.otpSuccess ? 1 : 0);
    }
    if (statusData.addressSuccess !== undefined) {
      fields.push('addressSuccess = ?');
      values.push(statusData.addressSuccess ? 1 : 0);
    }
    if (statusData.otpSecret !== undefined) {
      fields.push('otpSecret = ?');
      values.push(statusData.otpSecret);
    }

    if (fields.length === 0) return;

    fields.push('updateTime = ?');
    values.push(Date.now());
    values.push(id);

    const sql = `UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    stmt.run(...values);
  }

  updateAccountStatusJSON(id, statusData) {
    const account = this.jsonData.accounts.find(a => a.id === id);
    if (!account) return;

    if (statusData.registerSuccess !== undefined) {
      account.registerSuccess = statusData.registerSuccess ? 1 : 0;
    }
    if (statusData.otpSuccess !== undefined) {
      account.otpSuccess = statusData.otpSuccess ? 1 : 0;
    }
    if (statusData.addressSuccess !== undefined) {
      account.addressSuccess = statusData.addressSuccess ? 1 : 0;
    }
    if (statusData.otpSecret !== undefined) {
      account.otpSecret = statusData.otpSecret;
    }

    account.updateTime = Date.now();
    this.saveJSON();
  }

  getAccounts(page = 1, pageSize = 10, filters = {}) {
    if (useSQLite) {
      return this.getAccountsSQLite(page, pageSize, filters);
    } else {
      return this.getAccountsJSON(page, pageSize, filters);
    }
  }

  getAccountsSQLite(page, pageSize, filters) {
    const offset = (page - 1) * pageSize;
    const conditions = [];
    const params = [];

    if (filters.registerSuccess !== undefined) {
      conditions.push('registerSuccess = ?');
      params.push(filters.registerSuccess ? 1 : 0);
    }
    if (filters.otpSuccess !== undefined) {
      conditions.push('otpSuccess = ?');
      params.push(filters.otpSuccess ? 1 : 0);
    }
    if (filters.addressSuccess !== undefined) {
      conditions.push('addressSuccess = ?');
      params.push(filters.addressSuccess ? 1 : 0);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM accounts ${whereClause}`);
    const { total } = countStmt.get(...params);

    const dataStmt = this.db.prepare(`
      SELECT * FROM accounts 
      ${whereClause}
      ORDER BY registerTime DESC 
      LIMIT ? OFFSET ?
    `);
    const accounts = dataStmt.all(...params, pageSize, offset);

    return {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      data: accounts.map(acc => ({
        ...acc,
        registerSuccess: acc.registerSuccess === 1,
        otpSuccess: acc.otpSuccess === 1,
        addressSuccess: acc.addressSuccess === 1
      }))
    };
  }

  getAccountsJSON(page, pageSize, filters) {
    let filtered = this.jsonData.accounts;

    if (filters.registerSuccess !== undefined) {
      filtered = filtered.filter(a => (a.registerSuccess === 1) === filters.registerSuccess);
    }
    if (filters.otpSuccess !== undefined) {
      filtered = filtered.filter(a => (a.otpSuccess === 1) === filters.otpSuccess);
    }
    if (filters.addressSuccess !== undefined) {
      filtered = filtered.filter(a => (a.addressSuccess === 1) === filters.addressSuccess);
    }

    // 按注册时间倒序排序
    filtered.sort((a, b) => b.registerTime - a.registerTime);

    const total = filtered.length;
    const offset = (page - 1) * pageSize;
    const pageData = filtered.slice(offset, offset + pageSize);

    return {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      data: pageData.map(acc => ({
        ...acc,
        registerSuccess: acc.registerSuccess === 1,
        otpSuccess: acc.otpSuccess === 1,
        addressSuccess: acc.addressSuccess === 1
      }))
    };
  }

  getAllAccounts(filters = {}) {
    if (useSQLite) {
      return this.getAllAccountsSQLite(filters);
    } else {
      return this.getAllAccountsJSON(filters);
    }
  }

  getAllAccountsSQLite(filters) {
    const conditions = [];
    const params = [];

    if (filters.registerSuccess !== undefined) {
      conditions.push('registerSuccess = ?');
      params.push(filters.registerSuccess ? 1 : 0);
    }
    if (filters.otpSuccess !== undefined) {
      conditions.push('otpSuccess = ?');
      params.push(filters.otpSuccess ? 1 : 0);
    }
    if (filters.addressSuccess !== undefined) {
      conditions.push('addressSuccess = ?');
      params.push(filters.addressSuccess ? 1 : 0);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const stmt = this.db.prepare(`SELECT * FROM accounts ${whereClause} ORDER BY registerTime DESC`);
    const accounts = stmt.all(...params);

    return accounts.map(acc => ({
      ...acc,
      registerSuccess: acc.registerSuccess === 1,
      otpSuccess: acc.otpSuccess === 1,
      addressSuccess: acc.addressSuccess === 1
    }));
  }

  getAllAccountsJSON(filters) {
    let filtered = this.jsonData.accounts;

    if (filters.registerSuccess !== undefined) {
      filtered = filtered.filter(a => (a.registerSuccess === 1) === filters.registerSuccess);
    }
    if (filters.otpSuccess !== undefined) {
      filtered = filtered.filter(a => (a.otpSuccess === 1) === filters.otpSuccess);
    }
    if (filters.addressSuccess !== undefined) {
      filtered = filtered.filter(a => (a.addressSuccess === 1) === filters.addressSuccess);
    }

    filtered.sort((a, b) => b.registerTime - a.registerTime);

    return filtered.map(acc => ({
      ...acc,
      registerSuccess: acc.registerSuccess === 1,
      otpSuccess: acc.otpSuccess === 1,
      addressSuccess: acc.addressSuccess === 1
    }));
  }

  deleteAccount(id) {
    if (useSQLite) {
      return this.deleteAccountSQLite(id);
    } else {
      return this.deleteAccountJSON(id);
    }
  }

  deleteAccountSQLite(id) {
    const stmt = this.db.prepare('DELETE FROM accounts WHERE id = ?');
    stmt.run(id);
  }

  deleteAccountJSON(id) {
    const index = this.jsonData.accounts.findIndex(a => a.id === id);
    if (index !== -1) {
      this.jsonData.accounts.splice(index, 1);
      this.saveJSON();
    }
  }

  close() {
    if (useSQLite && this.db) {
      this.db.close();
    }
  }
}

// 导出单例
let instance = null;

function getAccountDatabase() {
  if (!instance) {
    try {
      console.log('创建 AccountDatabase 实例...');
      instance = new AccountDatabase();
      console.log('✅ AccountDatabase 实例创建成功');
    } catch (err) {
      console.error('❌ AccountDatabase 实例创建失败:', err.message);
      console.error('Stack:', err.stack);
      throw err;
    }
  }
  return instance;
}

module.exports = { getAccountDatabase, AccountDatabase };
