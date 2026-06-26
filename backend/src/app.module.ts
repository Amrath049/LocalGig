import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false, // report all invalid env vars at once
      },
    }),
    PrismaModule,
    // Feature modules (Auth, Users, Jobs, Applications, Search, Mail, Health)
    // will be added in later phases.
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
