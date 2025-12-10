export class EmailBaseDto {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

export class GetEmailLatestDto extends EmailBaseDto {
  count: number;
}

export interface EmailMessage {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      address: string;
      name: string;
    };
  };
  receivedDateTime: string;
  bodyPreview: string;
  body?: {
    content: string;
    contentType: string;
  };
}

export interface EmailListResponse {
  messages: EmailMessage[];
  count: number;
}
