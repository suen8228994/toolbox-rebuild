/**
 * 邮件服务
 * 使用 Microsoft Graph API 获取和管理 Outlook 邮件
 */

const { Client } = require('@microsoft/microsoft-graph-client');

class EmailService {
  /**
   * 获取 Graph API 访问令牌
   * @private
   */
  async #getGraphAccessToken({ refresh_token, client_id }) {
    const response = await fetch(
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token,
          client_id,
          grant_type: 'refresh_token',
          scope: 'https://graph.microsoft.com/.default'
        }).toString()
      }
    );

    if (!response.ok) {
      throw new Error(`获取 access_token 失败: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('access_token 缺失');
    }

    return data.access_token;
  }

  /**
   * 创建 Graph 客户端
   * @private
   */
  #createGraphClient(accessToken) {
    return Client.init({
      authProvider: (done) => done(null, accessToken)
    });
  }

  /**
   * 获取文件夹 ID
   * @private
   * @param {string|string[]} folderName - 文件夹名称或名称数组（支持多语言备选）
   */
  async #getFolderId(client, folderName) {
    const { value } = await client
      .api('/me/mailFolders')
      .select('id,displayName')
      .get();

    // 支持传入数组，依次尝试匹配
    const folderNames = Array.isArray(folderName) ? folderName : [folderName];
    
    for (const name of folderNames) {
      const folder = value.find(
        (folder) => folder.displayName.toLowerCase() === name.toLowerCase()
      );
      if (folder) {
        return folder.id;
      }
    }
    
    return undefined;
  }

  /**
   * 规范化邮件对象
   * @private
   */
  #normalizeEmailMessage(message, folderName) {
    return {
      from: message.from?.emailAddress?.address ?? '未知发件人',
      subject: message.subject ?? '无主题',
      text: message.bodyPreview ?? '',
      html: message.body?.content ?? '',
      timestamp: new Date(message.createdDateTime).getTime(),
      isRead: message.isRead ?? false,
      hasAttachments: message.hasAttachments ?? false,
      folder: folderName
    };
  }

  /**
   * 获取文件夹中的邮件
   * @private
   */
  async #getFolderEmails(client, folderId, folderName, limit) {
    const emails = [];
    let remaining = limit ?? Infinity;
    let nextLink = `/me/mailFolders/${folderId}/messages?$top=${Math.min(remaining, 50)}&$orderby=createdDateTime DESC`;

    while (nextLink && remaining > 0) {
      const response = await client
        .api(nextLink)
        .select('id,from,subject,bodyPreview,body,createdDateTime,isRead,hasAttachments')
        .get();

      const items = response.value
        .map((msg) => this.#normalizeEmailMessage(msg, folderName))
        .slice(0, remaining);

      emails.push(...items);
      remaining -= items.length;
      nextLink = response['@odata.nextLink'];
    }

    return emails;
  }

  /**
   * 获取所有文件夹的邮件
   * @private
   */
  async #getAllEmails(client) {
    const { value: folders } = await client
      .api('/me/mailFolders')
      .select('id,displayName')
      .get();

    const results = await Promise.all(
      folders.map(async (folder) =>
        await this.#getFolderEmails(client, folder.id, folder.displayName)
      )
    );

    return results
      .flat()
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 获取所有邮件
   * @public
   */
  async getAll(credentials) {
    const token = await this.#getGraphAccessToken(credentials);
    const client = this.#createGraphClient(token);
    return this.#getAllEmails(client);
  }

  /**
   * 获取指定文件夹的所有邮件
   * @public
   */
  async getFolderAll({ refresh_token, client_id, folderName }) {
    const token = await this.#getGraphAccessToken({ refresh_token, client_id });
    const client = this.#createGraphClient(token);
    const folderId = await this.#getFolderId(client, folderName);

    if (!folderId) {
      return [];
    }

    return this.#getFolderEmails(client, folderId, folderName);
  }

  /**
   * 获取指定文件夹的最新邮件
   * @public
   */
  async getFolderLatest({ refresh_token, client_id, folderName }) {
    const token = await this.#getGraphAccessToken({ refresh_token, client_id });
    const client = this.#createGraphClient(token);
    const folderId = await this.#getFolderId(client, folderName);

    if (!folderId) {
      return [];
    }

    return this.#getFolderEmails(client, folderId, folderName, 1);
  }

  /**
   * 获取收件箱最新邮件
   * @public
   */
  async getInboxLatest(credentials) {
    return this.getFolderLatest({ ...credentials, folderName: ['Inbox', '收件箱'] });
  }

  /**
   * 获取垃圾邮件箱最新邮件
   * @public
   */
  async getJunkLatest(credentials) {
    return this.getFolderLatest({ ...credentials, folderName: ['Junk Email', '垃圾邮件'] });
  }

  /**
   * 获取收件箱所有邮件
   * @public
   */
  async getInboxAll(credentials) {
    return this.getFolderAll({ ...credentials, folderName: ['Inbox', '收件箱'] });
  }

  /**
   * 获取垃圾邮件箱所有邮件
   * @public
   */
  async getJunkAll(credentials) {
    return this.getFolderAll({ ...credentials, folderName: ['Junk Email', '垃圾邮件'] });
  }

  /**
   * 获取最新的 N 封邮件
   * @public
   */
  async getLatest({ refresh_token, client_id, count }) {
    const all = await this.getAll({ refresh_token, client_id });
    return all.slice(0, count);
  }

  /**
   * 按时间范围获取所有邮件
   * @public
   */
  async getAllByTime({ refresh_token, client_id, start, end }) {
    const all = await this.getAll({ refresh_token, client_id });
    return all.filter(email => 
      email.timestamp >= start && email.timestamp <= end
    );
  }

  /**
   * 按时间范围获取收件箱邮件
   * @public
   */
  async getInboxByTime({ refresh_token, client_id, start, end }) {
    const inbox = await this.getInboxAll({ refresh_token, client_id });
    return inbox.filter(email => 
      email.timestamp >= start && email.timestamp <= end
    );
  }

  /**
   * 按时间范围获取垃圾邮件
   * @public
   */
  async getJunkByTime({ refresh_token, client_id, start, end }) {
    const junk = await this.getJunkAll({ refresh_token, client_id });
    return junk.filter(email => 
      email.timestamp >= start && email.timestamp <= end
    );
  }
}

module.exports = EmailService;
