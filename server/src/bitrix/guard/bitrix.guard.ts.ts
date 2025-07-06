import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { BitrixService } from '../bitrix.service';

@Injectable()
export class BitrixGuard implements CanActivate {
  private readonly logger = new Logger(BitrixGuard.name);

  constructor(private readonly bitrixService: BitrixService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const memberId = request.query['memberId'] as string;

    if (!memberId) {
      this.logger.warn('memberId is missing in query.');
      throw new BadRequestException('memberId is required in query.');
    }

    const token = await this.bitrixService.getTokenRecord(memberId);
    if (!token) {
      this.logger.warn(`No token found for memberId: ${memberId}`);
      throw new NotFoundException(
        `Bitrix token not found for memberId: ${memberId}`,
      );
    }

    request['memberId'] = memberId;

    return true;
  }
}
