// 测试 better-sqlite3
console.log('开始测试 better-sqlite3...');

try {
  const Database = require('better-sqlite3');
  console.log('✅ better-sqlite3 加载成功');
  console.log('Database 类型:', typeof Database);
  
  // 测试创建数据库
  const db = new Database(':memory:');
  console.log('✅ 内存数据库创建成功');
  
  db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
  console.log('✅ 表创建成功');
  
  db.close();
  console.log('✅ 数据库关闭成功');
  
  console.log('\n所有测试通过！');
} catch (err) {
  console.error('❌ 测试失败:');
  console.error('错误:', err.message);
  console.error('Stack:', err.stack);
}
