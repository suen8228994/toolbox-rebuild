const { buyNumberAndBuildConfig } = require("../backend/fivesim");

window.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKey");
  const countrySelect = document.getElementById("country");
  const serviceInput = document.getElementById("service");
  const operatorSelect = document.getElementById("operator");
  const countInput = document.getElementById("count");
  const statusSpan = document.getElementById("status");
  const outputArea = document.getElementById("output");
  const btnGenerate = document.getElementById("btnGenerate");
  const btnCopy = document.getElementById("btnCopy");

  function setStatus(text, isError = false) {
    statusSpan.textContent = text || "";
    statusSpan.className = isError ? "status error" : "status";
  }

  btnGenerate.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();
    const country = countrySelect.value;
    const service = serviceInput.value.trim();
    const operator = operatorSelect.value;
    const count = Math.max(1, Math.min(20, parseInt(countInput.value || "1", 10)));

    if (!apiKey) {
      setStatus("请先填写 API1 协议的 api_key", true);
      return;
    }

    if (!service) {
      setStatus("请填写 service（产品代号），例如 amazon / other / ot", true);
      return;
    }

    outputArea.value = "";
    setStatus("正在向 5SIM 请求号码，请稍等...");

    const lines = [];
    for (let i = 0; i < count; i++) {
      try {
        const cfg = await buyNumberAndBuildConfig({
          apiKey,
          country,
          service,
          operator
        });
        lines.push(cfg.line);
        setStatus(`已成功生成 ${i + 1} 个号码`);
      } catch (err) {
        console.error(err);
        lines.push(`# 第 ${i + 1} 个失败: ${err.message || err}`);
        setStatus(`第 ${i + 1} 个号码失败: ${err.message || err}`, true);
        // 如果你想要失败就停掉，可以 break; 这里先继续尝试下一个
      }
    }

    outputArea.value = lines.join("\n");
  });

  btnCopy.addEventListener("click", async () => {
    const text = outputArea.value;
    if (!text.trim()) {
      setStatus("没有内容可以复制", true);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus("已复制到剪贴板");
    } catch (err) {
      console.error(err);
      setStatus("复制失败，可以手动 Ctrl+C", true);
    }
  });
});
