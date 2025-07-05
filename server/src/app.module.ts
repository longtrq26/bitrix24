import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BitrixModule } from './bitrix/bitrix.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BitrixModule,
  ],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
