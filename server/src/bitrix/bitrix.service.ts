import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateRequisiteDto } from './dto/create-requisite.dto';

const BITRIX_BANK_REQUISITE_PRESET_ID = '5';

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

  // Contact Management
  async getContacts(
    memberId: string,
    page: number = 0,
    limit: number = 50,
    search?: string,
  ): Promise<any> {
    const payload: any = {
      order: { ID: 'DESC' },
      select: [
        'ID',
        'NAME',
        'LAST_NAME',
        'SECOND_NAME',
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

    if (search) {
      // Bitrix24 search is often done via filter
      payload.filter = {
        '%NAME': search, // Search by name (partial match)
      };
      // You might also want to search by EMAIL, PHONE, etc.
      // For example, if searching multiple fields:
      // payload.filter = {
      //   'LOGIC': 'OR',
      //   '%NAME': search,
      //   '%LAST_NAME': search,
      //   '%EMAIL': search,
      //   '%PHONE': search,
      // };
    }

    // Note: Bitrix24 `list` methods don't typically take a `limit` parameter directly
    // Instead, they have a default page size (usually 50) and a `start` parameter for pagination.
    // We handle `limit` by setting `start`. If you need more than 50, you'd need to loop or use batch.
    // For simplicity, we'll stick to a single page for now.

    try {
      const response = await this.callBitrixApi(
        memberId,
        'crm.contact.list',
        payload,
      );
      // Bitrix returns { result: [], total: N }
      return {
        data: response.result,
        total: response.total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to get contacts: ${error.message}`);
      throw error;
    }
  }

  async getContactDetails(memberId: string, contactId: string): Promise<any> {
    try {
      const contactResponse = await this.callBitrixApi(
        memberId,
        'crm.contact.get',
        { ID: contactId },
      );

      if (!contactResponse.result) {
        throw new NotFoundException(`Contact with ID ${contactId} not found.`);
      }

      const contact = contactResponse.result;

      // 1. Get a list of requisites for this contact (only ID and PRESET_ID)
      const requisitesListResponse = await this.callBitrixApi(
        memberId,
        'crm.requisite.list',
        {
          order: { ID: 'DESC' },
          filter: {
            ENTITY_TYPE_ID: 3, // 3 for Contact
            ENTITY_ID: contactId,
          },
          select: ['ID', 'PRESET_ID', 'NAME'], // Only select standard fields here
        },
      );

      let requisiteDetails: Partial<CreateRequisiteDto> | null = null;

      // If requisites are found, retrieve full details for the first one that matches our preset
      if (
        requisitesListResponse.result &&
        requisitesListResponse.result.length > 0
      ) {
        // Find the requisite that uses our specific bank details preset
        const bankRequisiteSummary = requisitesListResponse.result.find(
          (req: any) => req.PRESET_ID === BITRIX_BANK_REQUISITE_PRESET_ID,
        );

        if (bankRequisiteSummary) {
          // 2. Now call crm.requisite.get for the specific requisite ID
          // This method allows selecting all fields, including custom ones you defined (e.g., RQ_BANK_NAME)
          const fullRequisiteResponse = await this.callBitrixApi(
            memberId,
            'crm.requisite.get',
            { ID: bankRequisiteSummary.ID }, // Get by its specific ID
          );

          if (fullRequisiteResponse.result) {
            requisiteDetails = {
              NAME: fullRequisiteResponse.result.NAME, // General name of the requisite
              RQ_BANK_NAME: fullRequisiteResponse.result.RQ_BANK_NAME, // Your custom field
              RQ_ACC_NUM: fullRequisiteResponse.result.RQ_ACC_NUM, // Your custom field
              // You can add other fields from the requisite here if needed
            };
          }
        }
      }

      return { ...contact, requisite: requisiteDetails };
    } catch (error) {
      this.logger.error(
        `Failed to get contact details for ID ${contactId}: ${error.message}`,
      );
      throw error;
    }
  }

  async createContact(
    memberId: string,
    createContactDto: CreateContactDto,
  ): Promise<any> {
    const { requisite, PHONE, EMAIL, WEB, ...contactFields } = createContactDto;

    // Prepare contact fields for Bitrix24
    const fields: any = {
      // Default type to 'CLIENT' or 'CONTACT' (check your Bitrix24 settings)
      // It's often set automatically, but can be specified.
      // 'TYPE_ID': 'CLIENT',
      OPENED: 'Y', // Make it visible to everyone
      ...contactFields,
    };

    // Handle multi-field types like PHONE, EMAIL, WEB
    if (PHONE) {
      fields.PHONE = [{ VALUE: PHONE, VALUE_TYPE: 'WORK' }]; // Or 'MOBILE'
    }
    if (EMAIL) {
      fields.EMAIL = [{ VALUE: EMAIL, VALUE_TYPE: 'WORK' }]; // Or 'HOME'
    }
    if (WEB) {
      fields.WEB = [{ VALUE: WEB, VALUE_TYPE: 'WORK' }];
    }

    try {
      // 1. Create the contact
      const contactResponse = await this.callBitrixApi(
        memberId,
        'crm.contact.add',
        { fields },
      );

      const contactId = contactResponse.result;
      if (!contactId) {
        throw new InternalServerErrorException(
          'Failed to create contact, no ID returned.',
        );
      }
      this.logger.log(`Created contact with ID: ${contactId}`);

      // 2. If requisite data exists, create the requisite
      if (requisite) {
        const requisiteFields = {
          ENTITY_TYPE_ID: 3,
          ENTITY_ID: contactId,
          PRESET_ID: BITRIX_BANK_REQUISITE_PRESET_ID,
          NAME: requisite.NAME || 'Bank Details',
          // Mandatory fields for requisite might include NAME, XML_ID (if custom reqs)
          // For just banking, ensure RQ_BANK_NAME and RQ_ACC_NUM are supported fields.
          // You might need to retrieve the default REQUISITE_ID for bank details if Bitrix requires it.
          // In a real scenario, you'd likely map these to specific requisite preset fields.
          // For now, assuming direct field names work or you have a general preset.
          ...requisite, // Directly pass RQ_BANK_NAME, RQ_ACC_NUM
        };

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

    // Handle multi-field types like PHONE, EMAIL, WEB for update
    // For updates, you often need to fetch existing fields first if you want to merge,
    // or entirely replace them. Here we'll replace if provided.
    if (PHONE !== undefined) {
      fields.PHONE = PHONE ? [{ VALUE: PHONE, VALUE_TYPE: 'WORK' }] : []; // Clear if empty string
    }
    if (EMAIL !== undefined) {
      fields.EMAIL = EMAIL ? [{ VALUE: EMAIL, VALUE_TYPE: 'WORK' }] : [];
    }
    if (WEB !== undefined) {
      fields.WEB = WEB ? [{ VALUE: WEB, VALUE_TYPE: 'WORK' }] : [];
    }

    try {
      // 1. Update the contact
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

      // 2. Handle requisite update
      if (requisite !== undefined) {
        // First, try to find existing requisites for this contact
        const existingRequisitesResponse = await this.callBitrixApi(
          memberId,
          'crm.requisite.list',
          {
            filter: { ENTITY_TYPE_ID: 3, ENTITY_ID: contactId },
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
          // Update existing requisite
          await this.callBitrixApi(memberId, 'crm.requisite.update', {
            ID: existingRequisite.ID,
            fields: {
              PRESET_ID: BITRIX_BANK_REQUISITE_PRESET_ID,
              NAME: requisite.NAME || existingRequisite.NAME || 'Bank Details',
              ...requisite,
            },
          });
          this.logger.log(`Updated requisite for contact ID: ${contactId}`);
        } else if (
          !existingRequisite &&
          (requisite.RQ_BANK_NAME || requisite.RQ_ACC_NUM)
        ) {
          // No existing requisite, but new data provided -> create new
          const newRequisiteFields = {
            ENTITY_TYPE_ID: 3,
            ENTITY_ID: contactId,
            PRESET_ID: BITRIX_BANK_REQUISITE_PRESET_ID,
            NAME: requisite.NAME || 'Bank Details',
            ...requisite,
          };
          await this.callBitrixApi(memberId, 'crm.requisite.add', {
            fields: newRequisiteFields,
          });
          this.logger.log(`Created new requisite for contact ID: ${contactId}`);
        } else if (
          existingRequisite &&
          !requisite.RQ_BANK_NAME &&
          !requisite.RQ_ACC_NUM
        ) {
          // Requisite exists but DTO has empty/undefined requisite fields, consider deleting it
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

  async deleteContact(memberId: string, contactId: string): Promise<any> {
    try {
      // Before deleting the contact, it's good practice to delete associated requisites.
      // Bitrix24 might handle this automatically, but explicit deletion is safer.
      const existingRequisitesResponse = await this.callBitrixApi(
        memberId,
        'crm.requisite.list',
        {
          filter: { ENTITY_TYPE_ID: 3, ENTITY_ID: contactId },
          select: ['ID'],
        },
      );

      if (
        existingRequisitesResponse.result &&
        existingRequisitesResponse.result.length > 0
      ) {
        for (const req of existingRequisitesResponse.result) {
          await this.callBitrixApi(memberId, 'crm.requisite.delete', {
            ID: req.ID,
          });
          this.logger.log(
            `Deleted requisite ID ${req.ID} for contact ID: ${contactId}`,
          );
        }
      }

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

  async getRequisitePresets(memberId: string): Promise<any> {
    try {
      this.logger.log(`Fetching requisite presets for memberId: ${memberId}`);
      const response = await this.callBitrixApi(
        memberId,
        'crm.requisite.preset.list',
        {},
      );
      return response.result;
    } catch (error) {
      this.logger.error(`Failed to fetch requisite presets: ${error.message}`);
      throw error;
    }
  }
}
