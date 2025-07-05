import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BitrixService {
  private readonly logger = new Logger(BitrixService.name);
  private readonly httpClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.httpClient = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  async handleInstallApp(
    domain: string,
    memberId: string,
    authId: string,
    refreshToken: string,
    expiresIn: number,
  ) {
    try {
      await this.prisma.bitrixToken.upsert({
        where: { memberId },
        update: {
          accessToken: authId,
          refreshToken,
          expiresIn,
          domain,
        },
        create: {
          accessToken: authId,
          refreshToken,
          expiresIn,
          domain,
          memberId,
        },
      });

      this.logger.log(`Saved tokens for memberId: ${memberId}`);
    } catch (error) {
      this.logger.error(`DB error while saving token: ${error.message}`);
      throw new InternalServerErrorException('Failed to save Bitrix tokens.');
    }
  }

  async getTokensFromAuthCode(code: string, domain: string) {
    const clientId = this.configService.get<string>('BITRIX24_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'BITRIX24_CLIENT_SECRET',
    );
    const redirectUri = this.configService.get<string>('BITRIX24_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      this.logger.error('Missing OAuth config values');
      throw new InternalServerErrorException('Missing Bitrix24 config.');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      scope: 'crm,user,entity',
    });

    try {
      const response = await this.httpClient.post(
        `https://${domain}/oauth/token/`,
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      const data = response.data;

      await this.handleInstallApp(
        domain,
        data.member_id,
        data.access_token,
        data.refresh_token,
        data.expires_in,
      );

      return data;
    } catch (error) {
      this.logger.error(`OAuth exchange failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to get access token.');
    }
  }

  async refreshAccessToken(memberId: string): Promise<string> {
    const tokenRecord = await this.getTokenRecord(memberId);

    if (!tokenRecord?.refreshToken) {
      throw new BadRequestException('No refresh token found.');
    }

    const clientId = this.configService.get<string>('BITRIX24_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'BITRIX24_CLIENT_SECRET',
    );

    if (!clientId || !clientSecret || !tokenRecord.domain) {
      throw new InternalServerErrorException('Missing Bitrix24 config.');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRecord.refreshToken,
    });

    try {
      const response = await this.httpClient.post(
        `https://${tokenRecord.domain}/oauth/token/`,
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      const data = response.data;

      await this.prisma.bitrixToken.update({
        where: { memberId },
        data: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
        },
      });

      this.logger.log(`Token refreshed for memberId: ${memberId}`);
      return data.access_token;
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to refresh token.');
    }
  }

  async getValidAccessToken(
    memberId: string,
  ): Promise<{ accessToken: string; domain: string }> {
    let token = await this.getTokenRecord(memberId);

    if (!token) {
      throw new BadRequestException('Token not found.');
    }

    const now = Date.now() / 1000;
    const issued = token.updatedAt.getTime() / 1000;

    if (now - issued > token.expiresIn - 300) {
      this.logger.warn(
        `Token expired or about to expire for ${memberId}, refreshing...`,
      );
      await this.refreshAccessToken(memberId);
      token = await this.getTokenRecord(memberId);
      if (!token)
        throw new InternalServerErrorException('Token missing after refresh.');
    }

    return {
      accessToken: token.accessToken,
      domain: token.domain,
    };
  }

  async callBitrixApi(
    memberId: string,
    method: string,
    payload: any = {},
  ): Promise<any> {
    const { accessToken, domain } = await this.getValidAccessToken(memberId);
    const apiUrl = `https://${domain}/rest/${method}`;

    this.logger.debug(`Attempting Bitrix API call to: ${apiUrl}`);
    this.logger.debug(`Payload: ${JSON.stringify(payload)}`);
    // IMPORTANT: Do NOT log accessToken in production, for debugging only
    this.logger.debug(
      `Access Token (first 5 chars): ${accessToken.substring(0, 5)}...`,
    );

    try {
      const response = await this.httpClient.post(apiUrl, payload, {
        params: { auth: accessToken },
      });
      return response.data;
    } catch (error) {
      const bitrixError = error.response?.data;
      this.logger.error(
        `Bitrix API error: ${bitrixError?.error || error.message}`,
      );

      if (
        bitrixError?.error === 'expired_token' ||
        bitrixError?.error_description === 'The access token has expired.'
      ) {
        try {
          const newToken = await this.refreshAccessToken(memberId);
          const retry = await this.httpClient.post(apiUrl, payload, {
            params: { auth: newToken },
          });
          return retry.data;
        } catch (retryError) {
          this.logger.error(
            `Retry after refresh failed: ${retryError.message}`,
          );
          throw new InternalServerErrorException(
            'Retry after token refresh failed.',
          );
        }
      }

      throw new InternalServerErrorException(
        `Bitrix API call failed: ${bitrixError?.error_description || error.message}`,
      );
    }
  }

  async getTokenRecord(memberId: string) {
    return this.prisma.bitrixToken.findUnique({
      where: { memberId },
    });
  }
}
