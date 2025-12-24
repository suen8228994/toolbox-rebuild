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

    // 规范化字符串用于比较（去空格，小写）
    const normalize = str => (String(str || '')).trim().toLowerCase();

    // 先构建一个可搜索的映射（避免多次遍历）
    const folders = value || [];
    const normalizedMap = folders.map(f => ({
      id: f.id,
      name: f.displayName,
      norm: normalize(f.displayName),
      wellKnown: normalize(f.wellKnownName || ''),
      localized: normalize(f.displayNameLocalized || '')
    }));

    // 尝试多种匹配策略：完全匹配 -> 包含匹配 -> 反向包含（folder 包含目标或目标包含 folder）
    for (const name of folderNames) {
      const target = normalize(name);

      // 1) 完全匹配（displayName / localized / wellKnown）
      let found = normalizedMap.find(f => f.norm === target || f.localized === target || f.wellKnown === target);
      if (found) return found.id;

      // 2) 包含匹配（folder displayName 包含目标 或 localized 包含目标）
      found = normalizedMap.find(f => f.norm.includes(target) || f.localized.includes(target));
      if (found) return found.id;

      // 3) 反向包含（目标包含 folder displayName）或目标与 wellKnownName 部分匹配
      found = normalizedMap.find(f => target.includes(f.norm) || f.wellKnown && target.includes(f.wellKnown));
      if (found) return found.id;
    }

    // 如果没找到，记录可用的文件夹名供诊断
    try {
      console.warn('[EmailService] 无法找到匹配的邮箱文件夹:', folderName);
        console.warn('[EmailService] /me/mailFolders 返回的原始 folders:', value);
    } catch (e) {}

      // 后备：尝试使用 wellKnownName 过滤器直接查找 inbox（Graph 支持 wellKnownName）
      try {
        const filterRes = await client
          .api("/me/mailFolders?$filter=wellKnownName eq 'inbox'")
          .select('id,displayName,wellKnownName')
          .get();

        if (filterRes && Array.isArray(filterRes.value) && filterRes.value.length > 0) {
          console.warn('[EmailService] 通过 wellKnownName 找到 inbox:', filterRes.value[0]);
          return filterRes.value[0].id;
        }
      } catch (e) {
        try { console.warn('[EmailService] wellKnownName 过滤查询失败:', e && e.message ? e.message : e); } catch (_) {}
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
