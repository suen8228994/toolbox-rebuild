import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import * as express from 'express';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  // Enable CORS
  app.enableCors();

  // Use Socket.IO adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Set global prefix
  app.setGlobalPrefix('api');

  // Start listening
  const port = 6791;
  await app.listen(port);

  console.log('='.repeat(60));
  console.log('🚀 Toolbox Backend Server Started Successfully!');
  console.log('='.repeat(60));
  console.log(`📡 HTTP Server: http://localhost:${port}`);
  console.log(`🔌 WebSocket Server: ws://localhost:${port}`);
  console.log(`📚 API Prefix: /api`);
  console.log('='.repeat(60));
  console.log('Available Endpoints:');
  console.log('  - POST /api/address/postal    (生成邮编地址)');
  console.log('  - GET  /api/address/random    (生成随机地址)');
  console.log('  - POST /api/email/all         (获取所有邮件)');
  console.log('  - POST /api/email/latest      (获取最新邮件)');
  console.log('  - POST /api/email/inbox/latest (获取收件箱最新邮件)');
  console.log('='.repeat(60));
  console.log('WebSocket Events:');
  console.log('  - task.start                  (启动任务)');
  console.log('  - task.stop                   (停止任务)');
  console.log('  - task.config                 (更新任务配置)');
  console.log('='.repeat(60));
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
