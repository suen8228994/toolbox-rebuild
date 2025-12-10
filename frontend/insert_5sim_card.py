import re

# Read the HTML file
with open(r'C:\Users\sxh\toolbox-rebuild\frontend\src\renderer\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 5SIM tool card to insert
fivesim_card = """
                      <div class="tool-card" data-tool="5sim-sms-verification">
                          <div class="card-icon">📱</div>
                          <h3>5SIM短信验证</h3>
                          <p>虚拟手机号码接收SMS验证码</p>
                          <div class="card-status">
                              <span class="status-dot active"></span>
                              <span>可用</span>
                          </div>
                      </div>
"""

# Find the cookie-transformer card and insert after it
pattern = r'(<div class="tool-card" data-tool="cookie-transformer">.*?</div>\s*</div>)'
match = re.search(pattern, content, re.DOTALL)

if match:
    insert_pos = match.end()
    new_content = content[:insert_pos] + fivesim_card + content[insert_pos:]
    
    # Write back
    with open(r'C:\Users\sxh\toolbox-rebuild\frontend\src\renderer\index.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("Successfully added 5SIM tool card to index.html")
else:
    print("Could not find cookie-transformer card")
