import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { RegistrationMailer } from './registration-mailer';

@Global()
@Module({
    providers: [MailService, RegistrationMailer],
    exports: [MailService, RegistrationMailer],
})
export class MailModule {}
