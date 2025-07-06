import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { MemberId } from 'src/lib/decorators/member-id.decorator';
import { BitrixService } from './bitrix.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { BitrixGuard } from './guard/bitrix.guard.ts';

@Controller('bitrix')
export class BitrixController {
  private readonly logger = new Logger(BitrixController.name);

  constructor(
    private readonly bitrixService: BitrixService,
    private readonly configService: ConfigService,
  ) {}

  @Get('install')
  async installAppGet(
    @Query('event') event: string,
    @Query('auth_id') authId: string,
    @Query('refresh_id') refreshId: string,
    @Query('domain') domain: string,
    @Query('member_id') memberId: string,
    @Query('expires_in') expiresIn: string,
    @Query('code') code: string,
    @Res() res: Response,
  ) {
    this.logger.log(
      `Install GET event received. Event: ${event}, Domain: ${domain}`,
    );

    try {
      if (code) {
        // Lấy access token từ code và lưu vào database
        await this.bitrixService.getTokensFromAuthCode(code, domain);
        this.logger.log(
          `Successfully obtained tokens via authorization code for domain: ${domain}`,
        );
      }

      // không có code nhưng là ONAPPINSTALL event
      else if (event === 'ONAPPINSTALL' && authId && refreshId && domain) {
        await this.bitrixService.handleInstallApp(
          domain,
          memberId,
          authId,
          refreshId,
          parseInt(expiresIn),
        );
        this.logger.log(
          `Successfully handled ONAPPINSTALL event for domain: ${domain}`,
        );
      }

      // Thiếu cả code và ONAPPINSTALL
      else {
        this.logger.warn('Missing required parameters for install GET');
        throw new Error('Invalid install request parameters (GET).');
      }

      res.status(HttpStatus.OK).send('App installed successfully!');
    } catch (error) {
      this.logger.error(`Install GET error: ${error.message}`, error.stack);
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(`Error installing app: ${error.message}`);
    }
  }

  @Post('install')
  async installAppPost(@Body() body: any, @Res() res: Response) {
    const { AUTH_ID, REFRESH_ID, AUTH_EXPIRES, member_id, client_endpoint } =
      body;

    this.logger.log(`Install POST event received. member_id: ${member_id}`);

    try {
      // Kiểm tra thông tin cơ bản
      if (!AUTH_ID || !REFRESH_ID || !member_id) {
        throw new Error('Missing core fields in POST body.');
      }

      // Xác định domain
      let domain: string | undefined;

      // Lấy domain từ client endpoint
      if (client_endpoint) {
        try {
          const url = new URL(client_endpoint);
          domain = url.hostname;
        } catch (e) {
          this.logger.warn(`Invalid client_endpoint URL: ${client_endpoint}`);
        }
      }

      // Nếu không có client endpoint, tra cứu trong datbase theo memberId
      if (!domain) {
        const token = await this.bitrixService.getTokenRecord(member_id);
        domain = token?.domain;
      }

      // Dùng fallback trong .env
      if (!domain) {
        domain = this.configService.get<string>('BITRIX24_DEFAULT_DOMAIN');
      }

      // Không tìm được domain thì báo lỗi
      if (!domain) {
        throw new Error('Could not determine Bitrix24 domain.');
      }

      // Lưu token
      await this.bitrixService.handleInstallApp(
        domain,
        member_id,
        AUTH_ID,
        REFRESH_ID,
        parseInt(AUTH_EXPIRES),
      );

      return res.status(200).send('App installed successfully! (POST)');
    } catch (error) {
      this.logger.error(`Install POST error: ${error.message}`, error.stack);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(`Error installing app: ${error.message}`);
    }
  }

  @UseGuards(BitrixGuard)
  @Get('contacts')
  async getContacts(
    @MemberId() memberId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 0,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @Query('search') search?: string,
  ) {
    this.logger.log(`Fetching contacts for memberId: ${memberId}`);
    return this.bitrixService.getContacts(memberId, page, limit, search);
  }

  @UseGuards(BitrixGuard)
  @Get('contacts/:id')
  async getContactDetails(
    @MemberId() memberId: string,
    @Param('id') contactId: string,
  ) {
    if (!contactId) throw new BadRequestException('Contact ID is required.');
    this.logger.log(`Fetching contact ID: ${contactId}`);
    return this.bitrixService.getContactDetails(memberId, contactId);
  }

  @UseGuards(BitrixGuard)
  @Post('contacts')
  async createContact(
    @MemberId() memberId: string,
    @Body() dto: CreateContactDto,
  ) {
    this.logger.log(`Creating contact for memberId: ${memberId}`);
    return this.bitrixService.createContact(memberId, dto);
  }

  @UseGuards(BitrixGuard)
  @Put('contacts/:id')
  async updateContact(
    @MemberId() memberId: string,
    @Param('id') contactId: string,
    @Body() dto: UpdateContactDto,
  ) {
    if (!contactId) throw new BadRequestException('Contact ID is required.');
    this.logger.log(`Updating contact ID: ${contactId}`);
    return this.bitrixService.updateContact(memberId, contactId, dto);
  }

  @UseGuards(BitrixGuard)
  @Delete('contacts/:id')
  async deleteContact(
    @MemberId() memberId: string,
    @Param('id') contactId: string,
  ) {
    if (!contactId) throw new BadRequestException('Contact ID is required.');
    this.logger.log(`Deleting contact ID: ${contactId}`);
    return this.bitrixService.deleteContact(memberId, contactId);
  }
}
