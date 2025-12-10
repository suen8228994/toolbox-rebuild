import { Module } from '@nestjs/common';
import { AddressController } from '../controllers/address.controller';
import { EmailController } from '../controllers/email.controller';
import { AddressService } from '../services/address.service';
import { EmailService } from '../services/email.service';
import { TaskSchedulerService } from '../services/task-scheduler.service';
import { TaskGateway } from './task.gateway';

@Module({
  imports: [],
  controllers: [AddressController, EmailController],
  providers: [AddressService, EmailService, TaskSchedulerService, TaskGateway],
})
export class AppModule {}
