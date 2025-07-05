import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BitrixController } from './bitrix.controller';
import { BitrixService } from './bitrix.service';

@Module({
  controllers: [BitrixController],
  providers: [BitrixService, PrismaService],
  exports: [BitrixService],
})
export class BitrixModule {}
