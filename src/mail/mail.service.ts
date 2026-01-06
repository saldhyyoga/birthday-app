import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { MailSuccessResponseDto } from './mail.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MailService {
  private mailUrl = 'https://email-service.digitalenvision.com.au/send-email';
  private readonly logger = new Logger(MailService.name);
  constructor(private readonly httpService: HttpService) {}

  async sendBirthdayEmail(email: string, fullname: string): Promise<boolean> {
    const emailData = {
      email,
      message: `Hey, ${fullname} it's your birthday`,
    };

    try {
      const { data, status } = await firstValueFrom(
        this.httpService.post<MailSuccessResponseDto>(this.mailUrl, emailData),
      );

      if (data.status === 'sent' && status === 200) {
        this.logger.log(`Birthday email sent to ${email}`);
        return true;
      }

      // Handle case when status is not 'sent'
      this.logger.warn(`Email not sent to ${email}, status: ${data.status}`);
      return false;
    } catch (error) {
      this.logger.error(
        `Failed to send birthday email to ${email}: ${error.message}`,
      );
      return false;
    }
  }
}
