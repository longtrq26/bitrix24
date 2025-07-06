export interface Contact {
  ID: string;
  NAME: string;
  LAST_NAME: string;
  PHONE?: { VALUE: string; VALUE_TYPE: string }[];
  EMAIL?: { VALUE: string; VALUE_TYPE: string }[];
  WEB?: { VALUE: string; VALUE_TYPE: string }[];
  ADDRESS_1?: string;
  ADDRESS_CITY?: string;
  ADDRESS_REGION?: string;
  ADDRESS_PROVINCE?: string;
  requisite?: {
    NAME?: string;
    RQ_BANK_NAME?: string;
    RQ_ACC_NUM?: string;
  };
}

export interface GetContactsResponse {
  data: Contact[];
  total: number;
}

export type ApiUpdateContactData = {
  NAME?: string;
  LAST_NAME?: string;
  PHONE?: { VALUE: string }[] | [];
  EMAIL?: { VALUE: string }[] | [];
  WEB?: { VALUE: string }[] | [];
  ADDRESS_1?: string;
  ADDRESS_CITY?: string;
  ADDRESS_REGION?: string;
  ADDRESS_PROVINCE?: string;
  requisite?: {
    NAME?: string;
    RQ_BANK_NAME?: string;
    RQ_ACC_NUM?: string;
  } | null;
};
