import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Logger,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { BitrixService } from './bitrix.service';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

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
    @Query('client_endpoint') clientEndpoint: string,
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
        await this.bitrixService.getTokensFromAuthCode(code, domain);
        this.logger.log(
          `Successfully obtained tokens via authorization code for domain: ${domain}`,
        );
      } else if (event === 'ONAPPINSTALL' && authId && refreshId && domain) {
        // Ensure 'domain' is present in GET for ONAPPINSTALL as well
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
      } else {
        this.logger.warn(
          'Received install request without necessary parameters (GET).',
        );
        throw new Error('Invalid install request parameters (GET).');
      }

      res
        .status(HttpStatus.OK)
        .send('App installed successfully! You can close this window.');
    } catch (error) {
      this.logger.error(
        `Error during GET /bitrix/install: ${error.message}`,
        error.stack,
      );
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(`Error installing app: ${error.message}`);
    }
  }

  @Post('install')
  async installAppPost(@Body() body: any, @Res() res: Response) {
    this.logger.log(
      `Install POST event received. Body: ${JSON.stringify(body)}`,
    );

    const { AUTH_ID, REFRESH_ID, AUTH_EXPIRES, member_id, client_endpoint } =
      body;

    try {
      if (AUTH_ID && REFRESH_ID && member_id) {
        let domain: string | undefined;

        // 1. Try to get domain from client_endpoint if available
        if (client_endpoint) {
          try {
            const url = new URL(client_endpoint);
            domain = url.hostname;
            this.logger.log(`Domain extracted from client_endpoint: ${domain}`);
          } catch (urlError) {
            this.logger.warn(
              `Failed to parse client_endpoint URL: ${client_endpoint}. Error: ${urlError.message}`,
            );
          }
        }

        // 2. If domain not found from client_endpoint, try to retrieve from DB
        if (!domain) {
          const existingToken =
            await this.bitrixService.getTokenRecord(member_id);
          if (existingToken?.domain) {
            domain = existingToken.domain;
            this.logger.log(
              `Domain found in DB for member_id: ${member_id} -> ${domain}`,
            );
          } else {
            // 3. Fallback to default domain if nothing else works (e.g., first install where GET flow wasn't used)
            domain = this.configService.get<string>('BITRIX24_DEFAULT_DOMAIN');
            if (domain) {
              this.logger.warn(
                `Domain not found in body or DB for member_id: ${member_id}. Falling back to default domain: ${domain}`,
              );
            } else {
              this.logger.error(
                'BITRIX24_DEFAULT_DOMAIN is not configured and domain could not be determined.',
              );
              throw new Error(
                'Bitrix24 domain could not be determined for POST install event.',
              );
            }
          }
        }

        if (!domain) {
          // This case should ideally be caught by the previous checks, but as a safeguard
          throw new Error('Bitrix24 domain could not be determined.');
        }

        await this.bitrixService.handleInstallApp(
          domain, // Pass the determined domain
          member_id,
          AUTH_ID,
          REFRESH_ID,
          parseInt(AUTH_EXPIRES),
        );

        this.logger.log(
          `Successfully handled ONAPPINSTALL (POST) for domain: ${domain}`,
        );
        return res.status(200).send('App installed successfully! (POST)');
      }

      this.logger.warn(
        'Invalid POST install request parameters (missing core fields).',
      );
      throw new Error(
        'Invalid POST install request parameters (missing core fields).',
      );
    } catch (error) {
      this.logger.error(
        `Error during POST /bitrix/install: ${error.message}`,
        error.stack,
      );
      return res.status(500).send(`Error installing app: ${error.message}`);
    }
  }

  // ... (rest of your BitrixController code, including test-api and contact management routes) ...
  @Get('test-api')
  async testBitrixApi(@Query('memberId') memberId: string) {
    if (!memberId) {
      throw new BadRequestException('memberId is required.');
    }
    this.logger.log(`Testing Bitrix API for memberId: ${memberId}`);
    try {
      // Ví dụ: Lấy 10 contact đầu tiên
      const contacts = await this.bitrixService.callBitrixApi(
        memberId,
        'crm.contact.list',
        {
          order: { ID: 'DESC' },
          select: ['ID', 'NAME', 'EMAIL', 'PHONE'],
          start: 0,
        },
      );
      return { message: 'Bitrix API call successful!', data: contacts };
    } catch (error) {
      this.logger.error(
        `Failed to call Bitrix API: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
