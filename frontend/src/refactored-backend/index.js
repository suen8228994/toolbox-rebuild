/**
 * Refactored Backend - 主入口文件
 * 方便统一导入所有服务和工具
 */

// 服务
const AddressService = require('./services/address/AddressService');
const EmailService = require('./services/email/EmailService');
const TaskPublicService = require('./services/task/TaskPublicService');

// 工具
const toolUtils = require('./utils/toolUtils');
const usStateData = require('./utils/usStateData');
const eventEmitter = require('./utils/eventEmitter');

// 统一导出
module.exports = {
  // 服务类
  Services: {
    AddressService,
    EmailService,
    TaskPublicService
  },

  // 工具函数
  Utils: {
    ...toolUtils,
    ...usStateData,
    eventEmitter
  },

  // 单独导出（向后兼容）
  AddressService,
  EmailService,
  TaskPublicService,
  eventEmitter
};
