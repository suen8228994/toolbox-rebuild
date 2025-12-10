import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from '../services/email.service';
import { EmailBaseDto, GetEmailLatestDto, EmailListResponse } from '../dto/email.dto';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('all')
  async handleAll(@Body() body: EmailBaseDto): Promise<any> {
    return this.emailService.getAll(body);
  }

  @Post('latest')
  async handleLatest(@Body() body: GetEmailLatestDto): Promise<any> {
    return this.emailService.getLatest(body);
  }

  @Post('inbox/latest')
  async handleInboxLatest(@Body() body: EmailBaseDto): Promise<any> {
    return this.emailService.getInboxLatest(body);
  }

  @Post('inbox/all')
  async handleInboxAll(@Body() body: EmailBaseDto): Promise<any> {
    return this.emailService.getInboxAll(body);
  }

  @Post('trash/all')
  async handleTrashAll(@Body() body: EmailBaseDto): Promise<any> {
    return this.emailService.getJunkAll(body);
  }
}
