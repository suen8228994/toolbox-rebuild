import { Injectable } from '@nestjs/common';
import { Client } from '@microsoft/microsoft-graph-client';

interface EmailAuthProps {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

interface EmailMessage {
  from: string;
  subject: string;
  text: string;
  html: string;
  timestamp: number;
  isRead: boolean;
  hasAttachments: boolean;
  folder: string;
}

@Injectable()
export class EmailService {
  private async getGraphToken(props: EmailAuthProps): Promise<string> {
    const res = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        ...props,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/.default',
      }).toString(),
    });

    if (!res.ok) throw new Error(`获取 access_token 失败: ${res.statusText}`);
    const data = await res.json();
    if (!data.access_token) throw new Error('access_token 缺失');
    return data.access_token;
  }

  private createGraphClient(token: string) {
    return Client.init({
      authProvider: (done) => done(null, token),
    });
  }

  private async getFolderId(client: any, name: string): Promise<string | undefined> {
    const { value } = await client.api('/me/mailFolders').select('id,displayName').get();
    return value.find((f: any) => f.displayName.toLowerCase() === name.toLowerCase())?.id;
  }

  private normalizeMessage(msg: any, folderName: string): EmailMessage {
    return {
      from: msg.from?.emailAddress?.address ?? '未知发件人',
      subject: msg.subject ?? '无主题',
      text: msg.bodyPreview ?? '',
      html: msg.body?.content ?? '',
      timestamp: new Date(msg.createdDateTime).getTime(),
      isRead: msg.isRead ?? false,
      hasAttachments: msg.hasAttachments ?? false,
      folder: folderName,
    };
  }

  private async getFolderEmails(
    client: any,
    folderId: string,
    folderName: string,
    limit?: number
  ): Promise<EmailMessage[]> {
    const emails: EmailMessage[] = [];
    let remaining = limit ?? Infinity;
    let nextLink = `/me/mailFolders/${folderId}/messages?$top=${Math.min(
      remaining,
      50
    )}&$orderby=createdDateTime DESC`;

    while (nextLink && remaining > 0) {
      const res = await client
        .api(nextLink)
        .select('id,from,subject,bodyPreview,body,createdDateTime,isRead,hasAttachments')
        .get();

      const items = res.value
        .map((msg: any) => this.normalizeMessage(msg, folderName))
        .slice(0, remaining);

      emails.push(...items);
      remaining -= items.length;
      nextLink = res['@odata.nextLink'];
    }

    return emails;
  }

  private async getAllEmails(client: any): Promise<EmailMessage[]> {
    const { value } = await client.api('/me/mailFolders').select('id,displayName').get();
    const results = await Promise.all(
      value.map(async (f: any) => await this.getFolderEmails(client, f.id, f.displayName))
    );
    return results.flat().sort((a, b) => b.timestamp - a.timestamp);
  }

  async getAll(props: EmailAuthProps): Promise<EmailMessage[]> {
    const token = await this.getGraphToken(props);
    const client = this.createGraphClient(token);
    return this.getAllEmails(client);
  }

  async getFolderAll(props: EmailAuthProps & { folderName: string }): Promise<EmailMessage[]> {
    const token = await this.getGraphToken(props);
    const client = this.createGraphClient(token);
    const folderId = await this.getFolderId(client, props.folderName);
    if (!folderId) return [];
    return this.getFolderEmails(client, folderId, props.folderName);
  }

  async getFolderLatest(props: EmailAuthProps & { folderName: string }): Promise<EmailMessage[]> {
    const token = await this.getGraphToken(props);
    const client = this.createGraphClient(token);
    const folderId = await this.getFolderId(client, props.folderName);
    if (!folderId) return [];
    return this.getFolderEmails(client, folderId, props.folderName, 1);
  }

  async getInboxLatest(props: EmailAuthProps): Promise<EmailMessage[]> {
    return this.getFolderLatest({ ...props, folderName: 'Inbox' });
  }

  async getJunkLatest(props: EmailAuthProps): Promise<EmailMessage[]> {
    return this.getFolderLatest({ ...props, folderName: 'Junk Email' });
  }

  async getInboxAll(props: EmailAuthProps): Promise<EmailMessage[]> {
    return this.getFolderAll({ ...props, folderName: 'Inbox' });
  }

  async getJunkAll(props: EmailAuthProps): Promise<EmailMessage[]> {
    return this.getFolderAll({ ...props, folderName: 'Junk Email' });
  }

  async getLatest(props: EmailAuthProps & { count: number }): Promise<EmailMessage[]> {
    const all = await this.getAll(props);
    return all.slice(0, props.count);
  }

  async getAllByTime(
    props: EmailAuthProps & { start: number; end: number }
  ): Promise<EmailMessage[]> {
    const all = await this.getAll(props);
    return all.filter((e) => e.timestamp >= props.start && e.timestamp <= props.end);
  }

  async getInboxByTime(
    props: EmailAuthProps & { start: number; end: number }
  ): Promise<EmailMessage[]> {
    const inbox = await this.getInboxAll(props);
    return inbox.filter((e) => e.timestamp >= props.start && e.timestamp <= props.end);
  }

  async getJunkByTime(
    props: EmailAuthProps & { start: number; end: number }
  ): Promise<EmailMessage[]> {
    const junk = await this.getJunkAll(props);
    return junk.filter((e) => e.timestamp >= props.start && e.timestamp <= props.end);
  }
}
