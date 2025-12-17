// 测试脚本 - 检查批量注册工具的脚本内容
const fs = require('fs');

const content = fs.readFileSync('src/renderer/js/tools.js', 'utf8');

// 找到 hotmail-batch-register 工具
const startIndex = content.indexOf("'hotmail-batch-register'");
const endIndex = content.indexOf("'ms-graph-oauth'");

if (startIndex === -1 || endIndex === -1) {
    console.error('❌ 找不到工具定义');
    process.exit(1);
}

const toolContent = content.substring(startIndex, endIndex);

// 提取 script 标签内容
const scriptMatch = toolContent.match(/<script>([\s\S]*?)<\/script>/);

if (!scriptMatch) {
    console.error('❌ 找不到 script 标签');
    process.exit(1);
}

const script = scriptMatch[1];

console.log('✅ 找到批量注册工具脚本');
console.log('脚本长度:', script.length, '字符');
console.log('脚本行数:', script.split('\n').length);
console.log('');

// 检查是否有未转义的换行符
console.log('检查换行符转义...');
const lines = script.split('\n');
let hasIssue = false;

lines.forEach((line, i) => {
    // 检查 split 中的换行符
    if (line.includes("split('") && line.includes("\\n')") && !line.includes("split('\\\\n')")) {
        console.log('⚠️  行', i + 1, '- split 中的换行符可能未正确转义');
        console.log('   ', line.trim());
        hasIssue = true;
    }
    
    // 检查 join 中的换行符
    if (line.includes("join('") && line.includes("\\n')") && !line.includes("join('\\\\n')")) {
        console.log('⚠️  行', i + 1, '- join 中的换行符可能未正确转义');
        console.log('   ', line.trim());
        hasIssue = true;
    }
});

if (!hasIssue) {
    console.log('✅ 没有发现转义问题');
}

console.log('');

// 尝试在 Node.js 中执行脚本（模拟浏览器环境）
console.log('尝试验证脚本语法...');
try {
    // 创建一个模拟的环境
    const wrappedScript = `
        const document = {
            getElementById: (id) => ({
                textContent: '',
                innerHTML: '',
                value: '',
                disabled: false,
                addEventListener: () => {},
                appendChild: () => {},
                scrollTop: 0,
                scrollHeight: 0
            }),
            createElement: () => ({
                innerHTML: '',
                style: {},
                appendChild: () => {}
            })
        };
        const window = { hotmailBatchAPI: {}, msGraphAPI: {} };
        const console = global.console;
        
        ${script}
    `;
    
    new Function(wrappedScript)();
    console.log('✅ 脚本语法验证通过');
} catch (err) {
    console.error('❌ 脚本语法错误:');
    console.error(err.message);
    console.error('');
    console.error('错误位置:', err.stack.split('\n')[1]);
}
