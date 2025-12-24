// microsoftEmailExtract.js - 微软邮箱提取功能

function initMicrosoftEmailExtract() {
  const clientIdInput = document.getElementById("ms-extract-clientid");
  const refreshTokenInput = document.getElementById("ms-extract-refresh-token");
  const extractBtn = document.getElementById("btn-extract-emails");
  const logDiv = document.getElementById("extract-log");

  if (!extractBtn || !logDiv) {
    console.warn("微软邮箱提取: UI元素未找到");
    return;
  }

  function addLog(message, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === "error" ? "❌" : type === "success" ? "✅" : "ℹ️";
    const color =
      type === "error" ? "#f44336" : type === "success" ? "#4caf50" : "#2196f3";

    const logEntry = document.createElement("div");
    logEntry.style.color = color;
    logEntry.style.marginBottom = "5px";
    logEntry.textContent = `[${timestamp}] ${prefix} ${message}`;
    logDiv.appendChild(logEntry);
    logDiv.scrollTop = logDiv.scrollHeight;
  }

  async function getGraphAccessToken(client_id, refresh_token) {
    const tokenUrl =
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";

    const body = new URLSearchParams({
      client_id,
      refresh_token,
      grant_type: "refresh_token",
      scope: "https://graph.microsoft.com/.default",
    }).toString();

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      throw new Error(
        `换 token 失败：HTTP ${res.status}\n${JSON.stringify(data, null, 2)}`
      );
    }
    if (!data.access_token) {
      throw new Error(
        `换 token 成功但 access_token 缺失：\n${JSON.stringify(data, null, 2)}`
      );
    }
    return data.access_token;
  }

  async function graphGet(token, url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      throw new Error(
        `Graph 请求失败：HTTP ${res.status}\nURL: ${url}\n${JSON.stringify(
          data,
          null,
          2
        )}`
      );
    }
    return data;
  }

  extractBtn.addEventListener("click", async () => {
    const clientId = clientIdInput.value.trim();
    const refreshToken = refreshTokenInput.value.trim();

    if (!clientId || !refreshToken) {
      alert("请填写 Client ID 和 Refresh Token");
      return;
    }

    // 清空日志
    logDiv.innerHTML = "";
    extractBtn.disabled = true;
    extractBtn.textContent = "提取中...";

    try {
      addLog("开始获取 Access Token...");
      const token = await getGraphAccessToken(clientId, refreshToken);
      addLog("Access Token 获取成功", "success");

      addLog("正在获取邮箱文件夹列表...");
      const folders = await graphGet(
        token,
        "https://graph.microsoft.com/v1.0/me/mailFolders?$select=id,displayName"
      );
      addLog(`找到 ${folders.value?.length || 0} 个文件夹`);
      addLog("=== mailFolders ===");
      for (const f of folders.value || []) {
        addLog(`${f.displayName} => ${f.id}`);
      }

      function tryMatchInboxFromList(list) {
        const candidates = list || [];
        for (const f of candidates) {
          const dn = (f.displayName || "").trim().toLowerCase();
          const dnl = (f.displayNameLocalized || "").toString().trim().toLowerCase();
          const wkn = (f.wellKnownName || "").toString().trim().toLowerCase();

          if (dn === "inbox" || dnl === "inbox" || wkn === "inbox") return f;
          if (dn.includes("inbox") || dnl.includes("inbox") || wkn.includes("inbox")) return f;
          if (dn.includes("收件箱") || dnl.includes("收件箱")) return f;
        }
        return null;
      }

      let inbox = tryMatchInboxFromList(folders.value);
      if (!inbox) {
        // 尝试使用 wellKnownName 过滤查询作为后备
        addLog("未在 /me/mailFolders 列表中直接匹配到 Inbox，尝试使用 wellKnownName 过滤查询...", "info");
        try {
          const q = await graphGet(
            token,
            "https://graph.microsoft.com/v1.0/me/mailFolders?$filter=wellKnownName eq 'inbox'&$select=id,displayName,wellKnownName"
          );
          inbox = tryMatchInboxFromList(q.value);
          if (!inbox && q.value && q.value.length > 0) {
            inbox = q.value[0];
          }
        } catch (e) {
          console.warn('wellKnownName fallback query failed', e);
        }
      }

      if (!inbox) {
        throw new Error(
          "找不到 Inbox 文件夹（/me/mailFolders 返回里没有可识别的收件箱名称）"
        );
      }
      addLog(`Inbox 文件夹 ID: ${inbox.id}`, "success");

      addLog("正在获取收件箱最新邮件 (请求多条并在客户端选择最新)...");
      const latest = await graphGet(
        token,
        `https://graph.microsoft.com/v1.0/me/mailFolders/${inbox.id}/messages?$top=10&$select=subject,from,receivedDateTime,bodyPreview`
      );

      // 确保即使 Graph 返回未排序，也能取到最新的一封
      let m = null;
      if (latest.value && latest.value.length > 0) {
        latest.value.sort((a, b) => new Date(b.receivedDateTime) - new Date(a.receivedDateTime));
        m = latest.value[0];
      }
      if (!m) {
        addLog("Graph 调用成功，但收件箱暂无邮件", "success");
        return;
      }

      addLog("\n========== 最新邮件信息 ==========", "success");
      addLog(`主题: ${m.subject}`);
      addLog(`发件人: ${m.from?.emailAddress?.address || ""}`);
      addLog(`接收时间: ${m.receivedDateTime}`);
      addLog(`预览内容:\n${m.bodyPreview}`);
      addLog("=====================================\n", "success");
    } catch (error) {
      addLog(`执行失败: ${error.message}`, "error");
      console.error("微软邮箱提取错误:", error);
    } finally {
      extractBtn.disabled = false;
      extractBtn.textContent = "提取最新邮件";
    }
  });
}

// 导出到全局
if (typeof window !== "undefined") {
  window.initMicrosoftEmailExtract = initMicrosoftEmailExtract;
}
