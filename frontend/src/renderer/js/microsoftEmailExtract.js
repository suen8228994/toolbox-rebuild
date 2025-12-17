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
      const inbox = (folders.value || []).find(
        (f) => (f.displayName || "").toLowerCase() === "inbox"
      );
      if (!inbox) {
        throw new Error(
          "找不到 Inbox 文件夹（/me/mailFolders 返回里没有 Inbox）"
        );
      }
      addLog(`Inbox 文件夹 ID: ${inbox.id}`, "success");

      addLog("正在获取收件箱最新邮件...");
      const latest = await graphGet(
        token,
        `https://graph.microsoft.com/v1.0/me/mailFolders/${inbox.id}/messages?$top=1&$orderby=receivedDateTime desc&$select=subject,from,receivedDateTime,bodyPreview`
      );

      const m = latest.value && latest.value[0];
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
