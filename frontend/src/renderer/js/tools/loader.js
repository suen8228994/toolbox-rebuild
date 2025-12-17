// 工具定义汇总 - 模块化加载入口
// 按功能分类加载各个工具

// 导入各分类的工具
const amazonTools = require('./amazon');
const converterTools = require('./converters');
const microsoftTools = require('./microsoft');
const utilityTools = require('./utilities');

// 合并所有工具定义
const toolDefinitions = {
    ...amazonTools,
    ...converterTools,
    ...microsoftTools,
    ...utilityTools
};

// 导出工具内容获取函数
function getToolContent(toolName) {
    const tool = toolDefinitions[toolName];
    if (!tool) {
        return {
            title: '工具未找到',
            html: `<p>该工具暂未实现</p>`
        };
    }
    return tool;
}

// 浏览器环境导出
if (typeof window !== 'undefined') {
    window.getToolContent = getToolContent;
    window.toolDefinitions = toolDefinitions;
}

// Node.js环境导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getToolContent,
        toolDefinitions
    };
}
