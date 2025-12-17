// src/utils/authScriptGenerator.js
// Microsoft OAuth授权脚本生成器

/**
 * 生成PowerShell授权脚本
 * @param {Object} account - 账号信息
 * @param {string} clientId - Client ID
 * @returns {string} PowerShell脚本内容
 */
function generatePowerShellScript(account, clientId) {
  const script = `
# Microsoft OAuth Device Code Flow 授权脚本
# 账号: ${account.email}
# 生成时间: ${new Date().toLocaleString()}

$clientId = "${clientId}"
$email = "${account.email}"
$password = "${account.password}"
$scope = "https://outlook.office.com/.default offline_access"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Microsoft OAuth 授权脚本" -ForegroundColor Cyan
Write-Host "账号: $email" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 步骤1: 请求Device Code
Write-Host "[1/3] 正在请求Device Code..." -ForegroundColor Green
$deviceCodeUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/devicecode"
$deviceCodeBody = @{
    client_id = $clientId
    scope = $scope
}

try {
    $deviceCodeResponse = Invoke-RestMethod -Uri $deviceCodeUrl -Method Post -Body $deviceCodeBody -ContentType "application/x-www-form-urlencoded"
    
    Write-Host ""
    Write-Host "✓ Device Code获取成功!" -ForegroundColor Green
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Yellow
    Write-Host "请按照以下步骤操作:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. 浏览器将自动打开授权页面" -ForegroundColor White
    Write-Host "2. 在页面中输入以下代码:" -ForegroundColor White
    Write-Host ""
    Write-Host "   $($deviceCodeResponse.user_code)" -ForegroundColor Cyan -BackgroundColor Black
    Write-Host ""
    Write-Host "3. 登录账号: $email" -ForegroundColor White
    Write-Host "4. 完成授权后，脚本将自动获取Token" -ForegroundColor White
    Write-Host "================================================" -ForegroundColor Yellow
    Write-Host ""
    
    # 打开授权页面
    Start-Process $deviceCodeResponse.verification_uri
    
    Write-Host "按任意键继续..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    
    # 步骤2: 轮询获取Token
    Write-Host ""
    Write-Host "[2/3] 正在等待授权..." -ForegroundColor Green
    
    $tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    $interval = $deviceCodeResponse.interval
    $expiresIn = $deviceCodeResponse.expires_in
    $maxAttempts = [math]::Floor($expiresIn / $interval)
    
    $attempt = 0
    $tokenResponse = $null
    
    while ($attempt -lt $maxAttempts) {
        $attempt++
        Write-Host "  尝试 $attempt/$maxAttempts..." -ForegroundColor Gray
        
        $tokenBody = @{
            grant_type = "urn:ietf:params:oauth:grant-type:device_code"
            client_id = $clientId
            device_code = $deviceCodeResponse.device_code
        }
        
        try {
            $tokenResponse = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $tokenBody -ContentType "application/x-www-form-urlencoded" -ErrorAction Stop
            break
        } catch {
            $errorResponse = $_.Exception.Response
            if ($errorResponse) {
                $reader = New-Object System.IO.StreamReader($errorResponse.GetResponseStream())
                $errorBody = $reader.ReadToEnd() | ConvertFrom-Json
                
                if ($errorBody.error -eq "authorization_pending") {
                    # 继续等待
                    Start-Sleep -Seconds $interval
                } elseif ($errorBody.error -eq "slow_down") {
                    # 减慢轮询速度
                    Start-Sleep -Seconds ($interval + 5)
                } else {
                    throw "授权失败: $($errorBody.error_description)"
                }
            }
        }
    }
    
    if (-not $tokenResponse) {
        throw "授权超时，请重试"
    }
    
    # 步骤3: 保存Token
    Write-Host ""
    Write-Host "✓ 授权成功!" -ForegroundColor Green
    Write-Host ""
    Write-Host "[3/3] 保存Token..." -ForegroundColor Green
    
    # 保存到文件
    $outputFile = "token_$($email.Replace('@', '_')).txt"
    $tokenInfo = @"
邮箱账号: $email
密码: $password
Refresh Token: $($tokenResponse.refresh_token)
Access Token: $($tokenResponse.access_token)
Token类型: $($tokenResponse.token_type)
有效期: $($tokenResponse.expires_in) 秒
获取时间: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

完整Token信息:
$($tokenResponse | ConvertTo-Json -Depth 10)
"@
    
    $tokenInfo | Out-File -FilePath $outputFile -Encoding UTF8
    
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "✓ Token已保存到文件: $outputFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "Refresh Token:" -ForegroundColor Cyan
    Write-Host $tokenResponse.refresh_token -ForegroundColor White
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    
    # 复制到剪贴板
    $tokenResponse.refresh_token | Set-Clipboard
    Write-Host "✓ Refresh Token已复制到剪贴板" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "✗ 错误: $_" -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
`;

  return script.trim();
}

/**
 * 生成批量授权的批处理脚本
 * @param {Array} accounts - 账号列表
 * @param {string} clientId - Client ID
 * @param {number} concurrency - 并发数
 * @returns {string} 批处理脚本内容
 */
function generateBatchAuthScript(accounts, clientId, concurrency = 3) {
  const script = `
@echo off
chcp 65001 >nul
echo ================================================
echo Microsoft OAuth 批量授权脚本
echo 总账号数: ${accounts.length}
echo 并发数: ${concurrency}
echo ================================================
echo.

set TOTAL=${accounts.length}
set CURRENT=0
set SUCCESS=0
set FAILED=0

${accounts.map((account, index) => `
echo [%CURRENT%/%TOTAL%] 正在授权: ${account.email}
start /wait powershell.exe -ExecutionPolicy Bypass -File "auth_script_${index + 1}.ps1"
if %ERRORLEVEL% EQU 0 (
    set /a SUCCESS+=1
    echo ✓ 授权成功
) else (
    set /a FAILED+=1
    echo ✗ 授权失败
)
set /a CURRENT+=1
echo.
`).join('')}

echo ================================================
echo 批量授权完成!
echo 总数: %TOTAL%
echo 成功: %SUCCESS%
echo 失败: %FAILED%
echo ================================================
pause
`;

  return script.trim();
}

/**
 * 生成HTML授权页面（用于Electron窗口）
 * @param {Object} account - 账号信息
 * @param {string} clientId - Client ID
 * @returns {string} HTML内容
 */
function generateAuthHTML(account, clientId) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>授权 - ${account.email}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            padding: 40px;
            max-width: 600px;
            width: 100%;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 10px;
        }
        .account-info {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .account-info .label {
            color: #666;
            font-size: 14px;
            margin-bottom: 5px;
        }
        .account-info .value {
            color: #333;
            font-size: 16px;
            font-weight: bold;
            word-break: break-all;
        }
        .account-info .item {
            margin-bottom: 15px;
        }
        .account-info .item:last-child {
            margin-bottom: 0;
        }
        .steps {
            margin-bottom: 30px;
        }
        .step {
            display: flex;
            align-items: flex-start;
            margin-bottom: 20px;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .step-number {
            background: #667eea;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-right: 15px;
            flex-shrink: 0;
        }
        .step-content {
            flex: 1;
        }
        .step-title {
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }
        .step-desc {
            color: #666;
            font-size: 14px;
        }
        .device-code {
            background: #333;
            color: #00ff00;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            letter-spacing: 2px;
            margin: 20px 0;
            font-family: 'Courier New', monospace;
        }
        .button {
            width: 100%;
            padding: 15px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
        }
        .button-primary {
            background: #667eea;
            color: white;
            margin-bottom: 10px;
        }
        .button-primary:hover {
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .button-success {
            background: #4CAF50;
            color: white;
            margin-bottom: 10px;
        }
        .button-secondary {
            background: #f5f5f5;
            color: #333;
        }
        .button-secondary:hover {
            background: #e0e0e0;
        }
        .status {
            text-align: center;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            display: none;
        }
        .status.info {
            background: #e3f2fd;
            color: #1976D2;
        }
        .status.success {
            background: #e8f5e9;
            color: #388E3C;
        }
        .status.error {
            background: #ffebee;
            color: #D32F2F;
        }
        .token-result {
            display: none;
            margin-top: 20px;
        }
        .token-box {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            margin-top: 10px;
            word-break: break-all;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            max-height: 200px;
            overflow-y: auto;
        }
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Microsoft OAuth 授权</h1>
        </div>
        
        <div class="account-info">
            <div class="item">
                <div class="label">邮箱账号</div>
                <div class="value" id="account-email">${account.email}</div>
            </div>
            <div class="item">
                <div class="label">密码</div>
                <div class="value" id="account-password">${account.password}</div>
            </div>
        </div>
        
        <div class="steps">
            <div class="step">
                <div class="step-number">1</div>
                <div class="step-content">
                    <div class="step-title">获取Device Code</div>
                    <div class="step-desc">点击下方按钮获取授权代码</div>
                </div>
            </div>
            <div class="step">
                <div class="step-number">2</div>
                <div class="step-content">
                    <div class="step-title">打开授权页面</div>
                    <div class="step-desc">在浏览器中输入授权代码</div>
                </div>
            </div>
            <div class="step">
                <div class="step-number">3</div>
                <div class="step-content">
                    <div class="step-title">登录并授权</div>
                    <div class="step-desc">使用上述账号登录并完成授权</div>
                </div>
            </div>
        </div>
        
        <div id="device-code-section" style="display: none;">
            <div style="text-align: center; margin-bottom: 10px; color: #666;">
                请在浏览器中输入以下代码：
            </div>
            <div class="device-code" id="device-code-display"></div>
        </div>
        
        <button class="button button-primary" id="btn-start" onclick="startAuth()">
            🚀 开始授权
        </button>
        
        <button class="button button-success" id="btn-open-browser" onclick="openBrowser()" style="display: none;">
            🌐 打开授权页面
        </button>
        
        <button class="button button-primary" id="btn-check" onclick="checkAuth()" style="display: none;">
            🔄 检查授权状态
        </button>
        
        <button class="button button-secondary" id="btn-copy" onclick="copyToken()" style="display: none;">
            📋 复制Refresh Token
        </button>
        
        <button class="button button-secondary" id="btn-close" onclick="window.close()">
            ❌ 关闭窗口
        </button>
        
        <div class="status" id="status"></div>
        
        <div class="token-result" id="token-result">
            <h3 style="color: #4CAF50; margin-bottom: 10px;">✓ 授权成功！</h3>
            <div style="margin-bottom: 10px; color: #666;">Refresh Token:</div>
            <div class="token-box" id="token-display"></div>
        </div>
    </div>
    
    <script>
        const CLIENT_ID = '${clientId}';
        const SCOPE = 'https://outlook.office.com/.default offline_access';
        
        let deviceCodeData = null;
        let pollInterval = null;
        let refreshToken = null;
        
        function showStatus(message, type = 'info') {
            const statusEl = document.getElementById('status');
            statusEl.textContent = message;
            statusEl.className = 'status ' + type;
            statusEl.style.display = 'block';
        }
        
        async function startAuth() {
            const btnStart = document.getElementById('btn-start');
            btnStart.disabled = true;
            btnStart.innerHTML = '<span class="loading"></span> 获取中...';
            
            showStatus('正在请求Device Code...', 'info');
            
            try {
                const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/devicecode', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        client_id: CLIENT_ID,
                        scope: SCOPE
                    })
                });
                
                deviceCodeData = await response.json();
                
                if (deviceCodeData.error) {
                    throw new Error(deviceCodeData.error_description);
                }
                
                // 显示Device Code
                document.getElementById('device-code-display').textContent = deviceCodeData.user_code;
                document.getElementById('device-code-section').style.display = 'block';
                
                // 显示按钮
                document.getElementById('btn-open-browser').style.display = 'block';
                document.getElementById('btn-check').style.display = 'block';
                btnStart.style.display = 'none';
                
                showStatus('Device Code获取成功！请打开浏览器完成授权。', 'success');
                
                // 自动打开浏览器
                setTimeout(() => openBrowser(), 1000);
                
            } catch (error) {
                showStatus('错误: ' + error.message, 'error');
                btnStart.disabled = false;
                btnStart.innerHTML = '🚀 开始授权';
            }
        }
        
        function openBrowser() {
            if (deviceCodeData) {
                window.open(deviceCodeData.verification_uri, '_blank');
                showStatus('授权页面已打开，请完成授权后点击"检查授权状态"', 'info');
            }
        }
        
        async function checkAuth() {
            if (!deviceCodeData) return;
            
            const btnCheck = document.getElementById('btn-check');
            const originalText = btnCheck.innerHTML;
            btnCheck.disabled = true;
            btnCheck.innerHTML = '<span class="loading"></span> 检查中...';
            
            showStatus('正在检查授权状态...', 'info');
            
            try {
                const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                        client_id: CLIENT_ID,
                        device_code: deviceCodeData.device_code
                    })
                });
                
                const data = await response.json();
                
                if (data.error) {
                    if (data.error === 'authorization_pending') {
                        showStatus('等待授权中...请在浏览器中完成授权', 'info');
                        btnCheck.disabled = false;
                        btnCheck.innerHTML = originalText;
                    } else {
                        throw new Error(data.error_description || data.error);
                    }
                } else {
                    // 授权成功
                    refreshToken = data.refresh_token;
                    
                    document.getElementById('token-display').textContent = refreshToken;
                    document.getElementById('token-result').style.display = 'block';
                    document.getElementById('btn-copy').style.display = 'block';
                    document.getElementById('btn-check').style.display = 'none';
                    document.getElementById('btn-open-browser').style.display = 'none';
                    
                    showStatus('授权成功！', 'success');
                    
                    // 通知父窗口
                    if (window.authCallback) {
                        window.authCallback({
                            success: true,
                            email: document.getElementById('account-email').textContent,
                            refreshToken: refreshToken
                        });
                    }
                }
            } catch (error) {
                showStatus('错误: ' + error.message, 'error');
                btnCheck.disabled = false;
                btnCheck.innerHTML = originalText;
            }
        }
        
        function copyToken() {
            if (refreshToken) {
                navigator.clipboard.writeText(refreshToken).then(() => {
                    showStatus('Refresh Token已复制到剪贴板！', 'success');
                });
            }
        }
    </script>
</body>
</html>
`;
}

module.exports = {
  generatePowerShellScript,
  generateBatchAuthScript,
  generateAuthHTML
};
