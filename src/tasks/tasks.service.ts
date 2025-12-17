import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronJob } from 'cron';
import { SchedulerRegistry } from '@nestjs/schedule';
import { UsersService } from '../users/users.service';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class TasksService implements OnModuleInit {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    const cronValue = process.env.TIMECRON_JOB_SEND_CREDENTIALS?.trim();

    // Caso 1: Variable vacía → no ejecutar nada
    if (!cronValue) {
      this.logger.log('Cron para envío de credenciales desactivado.');
      return;
    }

    // Caso 2: Ejecutar solo una vez 5 minutos después del arranque
    if (cronValue.toUpperCase() === 'ONCE') {
      this.logger.log('El envío se ejecutará una sola vez, 5 minutos después del arranque.');

      setTimeout(() => {
        this.sendCredentialsToAllUsers();
      }, 5 * 60 * 1000); // 5 minutos

      return;
    }

    // Caso 3: Es una expresión CRON válida → ejecutar normalmente
    try {
      const job = new CronJob(
        cronValue,
        () => this.sendCredentialsToAllUsers(),
        null,
        true,
        'America/Bogota',
      );

      this.schedulerRegistry.addCronJob('sendCredentialsCron', job);
      job.start();

      this.logger.log(`Cron de credenciales programado con: ${cronValue}`);
    } catch (error) {
      this.logger.error(`Expresión CRON inválida: ${cronValue}`);
    }
  }

  async sendCredentialsToAllUsers() {
    this.logger.log('Iniciando envío masivo de credenciales a usuarios');

    const users = await this.usersService.findAll();

    for (const user of users) {
      try {
        const plainPassword = 'password123!';

        await this.mailService.sendCredentialsEmail({
          to: user.email || 'luisalbertotaleromartinez@gmail.com',
          username: user.username,
          plainPassword,
          nameuser: `${user.nombre} ${user.apellido}` || "usuario",
        });

        this.logger.log(
          `Credenciales enviadas a usuario ${user.usuarioId} - ${user.email}`,
        );
      } catch (error) {
        this.logger.error(
          `Error enviando credenciales a usuario ${user.usuarioId} (${user.email}): ${(error as Error).message}`,
        );
      }
    }

    this.logger.log('Envío masivo de credenciales finalizado');
  }
}
