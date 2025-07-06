import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  BANK_REQUISITE_PRESET_ID,
  ENTITY_TYPE_CONTACT,
} from 'src/lib/constants';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { CreateRequisiteDto } from './dto/create-requisite.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

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

  // Lưu token khi install app từ Bitrix24
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

        // Nếu đã tồn tại token, cập nhật các fields
        update: {
          accessToken: authId,
          refreshToken,
          expiresIn,
          domain,
        },

        // Nếu chưa có, tạo record mới
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

  // Đổi authorization code thành tokens
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

    // Tạo form data
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      scope: 'crm, user, entity',
    });

    try {
      // Gửi request đến endpoint trao đổi token của Bitrix24
      const response = await this.httpClient.post(
        `https://${domain}/oauth/token/`,
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      const data = response.data;

      // Lưu token vào database
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

  // Refresh token
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

    // Request data để refresh token
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRecord.refreshToken,
    });

    try {
      // Gửi request làm mới token đến Bitrix24
      const response = await this.httpClient.post(
        `https://${tokenRecord.domain}/oauth/token/`,
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      const data = response.data;

      // Update tokens trong database
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

  // Kiểm tra token đã hết hạn chưa
  async getValidAccessToken(
    memberId: string,
  ): Promise<{ accessToken: string; domain: string }> {
    let token = await this.getTokenRecord(memberId);

    if (!token) {
      throw new BadRequestException('Token not found.');
    }

    const now = Date.now() / 1000;
    const issued = token.updatedAt.getTime() / 1000;

    // Nếu token đã hết hạn hoặc sắp hết hạn thì refresh (5p)
    if (now - issued > token.expiresIn - 300) {
      this.logger.warn(
        `Token expired or about to expire for ${memberId}, refreshing...`,
      );

      // Refresh token
      await this.refreshAccessToken(memberId);

      // Lấy lại token vừa refresh
      token = await this.getTokenRecord(memberId);

      if (!token) {
        throw new InternalServerErrorException('Token missing after refresh.');
      }
    }

    return {
      accessToken: token.accessToken,
      domain: token.domain,
    };
  }

  // Gọi API bất kỳ của Bitrix24
  async callBitrixApi(
    memberId: string,
    method: string,
    payload: any = {},
  ): Promise<any> {
    // Đảm bảo token còn hạn
    const { accessToken, domain } = await this.getValidAccessToken(memberId);
    const apiUrl = `https://${domain}/rest/${method}`;

    try {
      // Gửi request đến Bitrix24
      const response = await this.httpClient.post(apiUrl, payload, {
        params: { auth: accessToken },
      });

      return response.data;
    } catch (error) {
      const bitrixError = error.response?.data;
      this.logger.error(
        `Bitrix API error: ${bitrixError?.error || error.message}`,
      );

      // Nếu token hết hạn, tự động refresh và retry
      if (
        bitrixError?.error === 'expired_token' ||
        bitrixError?.error_description === 'The access token has expired.'
      ) {
        try {
          const newToken = await this.refreshAccessToken(memberId);

          // Retry lại với token mới
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

  // Helper lấy token từ database
  async getTokenRecord(memberId: string) {
    return this.prisma.bitrixToken.findUnique({
      where: { memberId },
    });
  }

  // Lấy danh sách contact
  async getContacts(
    memberId: string,
    page: number = 0,
    limit: number = 10,
    search?: string,
  ): Promise<any> {
    const payload: any = {
      order: { ID: 'DESC' },
      select: [
        'ID',
        'NAME',
        'LAST_NAME',
        'PHONE',
        'EMAIL',
        'WEB',
        'ADDRESS_1',
        'ADDRESS_CITY',
        'ADDRESS_REGION',
        'ADDRESS_PROVINCE',
      ],
      start: page * limit,
    };

    // Xử lý search
    if (search) {
      payload.filter = {
        LOGIC: 'OR',
        '%NAME': search,
        '%LAST_NAME': search,
        '%EMAIL': search,
        '%PHONE': search,
      };
    }

    try {
      // Call api
      const response = await this.callBitrixApi(
        memberId,
        'crm.contact.list',
        payload,
      );

      // Lấy 10 dòng cho đẹp
      return {
        data: response.result.slice(0, limit),
        total: response.total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to get contacts: ${error.message}`);
      throw error;
    }
  }

  // Lấy chi tiết một contact
  async getContactDetails(memberId: string, contactId: string): Promise<any> {
    try {
      // Lấy thông tin contact
      const contactResponse = await this.callBitrixApi(
        memberId,
        'crm.contact.get',
        { ID: contactId },
      );

      if (!contactResponse.result) {
        throw new NotFoundException(`Contact with ID ${contactId} not found.`);
      }

      const contact = contactResponse.result;

      // Lấy danh sách requisite
      const requisitesListResponse = await this.callBitrixApi(
        memberId,
        'crm.requisite.list',
        {
          order: { ID: 'DESC' },
          filter: {
            ENTITY_TYPE_ID: ENTITY_TYPE_CONTACT,
            ENTITY_ID: contactId,
          },
          select: ['ID', 'PRESET_ID', 'NAME'],
        },
      );

      let requisiteDetails: Partial<CreateRequisiteDto> | null = null;

      // Tìm requisite đúng preset
      if (Array.isArray(requisitesListResponse.result)) {
        const bankRequisiteSummary = requisitesListResponse.result.find(
          (req: any) => Number(req.PRESET_ID) === BANK_REQUISITE_PRESET_ID,
        );

        if (bankRequisiteSummary) {
          const fullRequisiteResponse = await this.callBitrixApi(
            memberId,
            'crm.requisite.get',
            { ID: bankRequisiteSummary.ID },
          );

          const result = fullRequisiteResponse.result;

          if (result) {
            requisiteDetails = {
              NAME: result.NAME,
              ...(result.RQ_BANK_NAME && { RQ_BANK_NAME: result.RQ_BANK_NAME }),
              ...(result.RQ_ACC_NUM && { RQ_ACC_NUM: result.RQ_ACC_NUM }),
            };
          }
        }
      }

      return {
        ...contact,
        requisite: requisiteDetails,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get contact details for ID ${contactId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Tạo mới contact
  async createContact(
    memberId: string,
    createContactDto: CreateContactDto,
  ): Promise<any> {
    const duplicates = await this.checkDuplicateContact(
      memberId,
      createContactDto,
    );

    if (duplicates.length > 0) {
      throw new BadRequestException(
        `Duplicate contact found with IDs: ${duplicates.join(', ')}`,
      );
    }

    const { requisite, PHONE, EMAIL, WEB, ...contactFields } = createContactDto;

    const fields: any = {
      OPENED: 'Y', // Cho phép mọi người thấy contact này
      ...contactFields,
    };

    // Xử lý các trường multi-field
    if (PHONE) {
      fields.PHONE = [{ VALUE: PHONE, VALUE_TYPE: 'WORK' }];
    }
    if (EMAIL) {
      fields.EMAIL = [{ VALUE: EMAIL, VALUE_TYPE: 'WORK' }];
    }
    if (WEB) {
      fields.WEB = [{ VALUE: WEB, VALUE_TYPE: 'WORK' }];
    }

    try {
      // Create contact
      const contactResponse = await this.callBitrixApi(
        memberId,
        'crm.contact.add',
        { fields },
      );

      // Kiểm tra ID trả về
      const contactId = contactResponse.result;

      if (!contactId) {
        throw new InternalServerErrorException(
          'Failed to create contact, no ID returned.',
        );
      }

      this.logger.log(`Created contact with ID: ${contactId}`);

      // Create thông tin bank
      if (requisite) {
        const requisiteFields = {
          ENTITY_TYPE_ID: ENTITY_TYPE_CONTACT,
          ENTITY_ID: contactId,
          PRESET_ID: BANK_REQUISITE_PRESET_ID,
          NAME: requisite.NAME || 'Bank Details',
        };

        if (requisite.RQ_BANK_NAME) {
          (requisiteFields as any).RQ_BANK_NAME = requisite.RQ_BANK_NAME;
        }
        if (requisite.RQ_ACC_NUM) {
          (requisiteFields as any).RQ_ACC_NUM = requisite.RQ_ACC_NUM;
        }

        // Gắn requisite vào contact
        const requisiteResponse = await this.callBitrixApi(
          memberId,
          'crm.requisite.add',
          { fields: requisiteFields },
        );

        if (!requisiteResponse.result) {
          this.logger.warn(
            `Contact created, but failed to create requisite for contact ID ${contactId}.`,
          );
        } else {
          this.logger.log(`Created requisite for contact ID: ${contactId}`);
        }
      }

      return { id: contactId, message: 'Contact created successfully.' };
    } catch (error) {
      this.logger.error(`Failed to create contact: ${error.message}`);
      throw error;
    }
  }

  // Cập nhật contact
  async updateContact(
    memberId: string,
    contactId: string,
    updateContactDto: UpdateContactDto,
  ): Promise<any> {
    const { requisite, PHONE, EMAIL, WEB, ...contactFields } = updateContactDto;

    const fields: any = {
      ID: contactId,
      ...contactFields,
    };

    // Xử lý multi-field
    if (PHONE !== undefined) {
      fields.PHONE = PHONE ? [{ VALUE: PHONE, VALUE_TYPE: 'WORK' }] : [];
    }
    if (EMAIL !== undefined) {
      fields.EMAIL = EMAIL ? [{ VALUE: EMAIL, VALUE_TYPE: 'WORK' }] : [];
    }
    if (WEB !== undefined) {
      fields.WEB = WEB ? [{ VALUE: WEB, VALUE_TYPE: 'WORK' }] : [];
    }

    try {
      // Update contact
      const contactResponse = await this.callBitrixApi(
        memberId,
        'crm.contact.update',
        { ID: contactId, fields },
      );

      if (!contactResponse.result) {
        throw new InternalServerErrorException(
          `Failed to update contact with ID ${contactId}.`,
        );
      }

      this.logger.log(`Updated contact with ID: ${contactId}`);

      // Xử lý update requisite
      if (requisite !== undefined) {
        const existingRequisitesResponse = await this.callBitrixApi(
          memberId,
          'crm.requisite.list',
          {
            filter: {
              ENTITY_TYPE_ID: ENTITY_TYPE_CONTACT,
              ENTITY_ID: contactId,
            },
            select: ['ID'],
          },
        );

        const existingRequisite =
          existingRequisitesResponse.result &&
          existingRequisitesResponse.result.length > 0
            ? existingRequisitesResponse.result[0]
            : null;

        if (
          existingRequisite &&
          (requisite.RQ_BANK_NAME || requisite.RQ_ACC_NUM)
        ) {
          // Có requisite và DTO có data, update
          await this.callBitrixApi(memberId, 'crm.requisite.update', {
            ID: existingRequisite.ID,
            fields: {
              PRESET_ID: BANK_REQUISITE_PRESET_ID,
              NAME: requisite.NAME || existingRequisite.NAME || 'Bank Details',
              ...requisite,
            },
          });
          this.logger.log(`Updated requisite for contact ID: ${contactId}`);
        } else if (
          !existingRequisite &&
          (requisite.RQ_BANK_NAME || requisite.RQ_ACC_NUM)
        ) {
          // Không có requisite nhưng DTO có data, create
          await this.callBitrixApi(memberId, 'crm.requisite.add', {
            fields: {
              ENTITY_TYPE_ID: ENTITY_TYPE_CONTACT,
              ENTITY_ID: contactId,
              PRESET_ID: BANK_REQUISITE_PRESET_ID,
              NAME: requisite.NAME || 'Bank Details',
              ...requisite,
            },
          });
          this.logger.log(`Created new requisite for contact ID: ${contactId}`);
        } else if (
          existingRequisite &&
          !requisite.RQ_BANK_NAME &&
          !requisite.RQ_ACC_NUM
        ) {
          // Có requisite nhưng DTO không có data, delete
          await this.callBitrixApi(memberId, 'crm.requisite.delete', {
            ID: existingRequisite.ID,
          });
          this.logger.log(`Deleted requisite for contact ID: ${contactId}`);
        }
      }

      return { id: contactId, message: 'Contact updated successfully.' };
    } catch (error) {
      this.logger.error(`Failed to update contact: ${error.message}`);
      throw error;
    }
  }

  // Xoá một contact
  async deleteContact(memberId: string, contactId: string): Promise<any> {
    try {
      // Tìm requisite liên quan trước khi xoá
      const { result: requisites = [] } = await this.callBitrixApi(
        memberId,
        'crm.requisite.list',
        {
          filter: { ENTITY_TYPE_ID: ENTITY_TYPE_CONTACT, ENTITY_ID: contactId },
          select: ['ID'],
        },
      );

      // Xoá tất cả requisite nếu có
      if (requisites.length > 0) {
        await Promise.all(
          requisites.map((req: any) =>
            this.callBitrixApi(memberId, 'crm.requisite.delete', {
              ID: req.ID,
            })
              .then(() =>
                this.logger.log(
                  `Deleted requisite ID ${req.ID} for contact ID: ${contactId}`,
                ),
              )
              .catch((err) =>
                this.logger.warn(
                  `Failed to delete requisite ID ${req.ID}: ${err.message}`,
                ),
              ),
          ),
        );
      }

      // Delete contact
      const response = await this.callBitrixApi(
        memberId,
        'crm.contact.delete',
        { ID: contactId },
      );

      if (!response.result) {
        throw new InternalServerErrorException(
          `Failed to delete contact with ID ${contactId}.`,
        );
      }

      this.logger.log(`Deleted contact with ID: ${contactId}`);

      return { message: 'Contact deleted successfully.' };
    } catch (error) {
      this.logger.error(`Failed to delete contact: ${error.message}`);
      throw error;
    }
  }

  // Helper kiểm tra contact trùng
  private async checkDuplicateContact(
    memberId: string,
    dto: CreateContactDto,
  ): Promise<string[]> {
    const { PHONE, EMAIL } = dto;
    const duplicates: Set<string> = new Set();

    const tasks: Promise<void>[] = [];

    // Phone trùng
    if (PHONE) {
      tasks.push(
        this.callBitrixApi(memberId, 'crm.duplicate.findbycomm', {
          type: 'PHONE',
          values: [PHONE],
          entity_type: 'CONTACT',
        }).then((res) => {
          res.result?.CONTACT?.forEach((id: string) => duplicates.add(id));
        }),
      );
    }

    // Email trùng
    if (EMAIL) {
      tasks.push(
        this.callBitrixApi(memberId, 'crm.duplicate.findbycomm', {
          type: 'EMAIL',
          values: [EMAIL],
          entity_type: 'CONTACT',
        }).then((res) => {
          res.result?.CONTACT?.forEach((id: string) => duplicates.add(id));
        }),
      );
    }

    await Promise.all(tasks);
    return [...duplicates];
  }
}
