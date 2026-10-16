import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getAppInfo(): { name: string; version: string; description: string } {
    return {
      name: 'Auth Automation',
      version: 'XFM 2.0.0',
      description:
        'Aplikacja do automatyzacji procesów uwierzytelniania użytkowników',
    };
  }

  getWelcomeMessage(): string {
    return 'Witaj w aplikacji automatyzacji uwierzytelniania!';
  }
}
