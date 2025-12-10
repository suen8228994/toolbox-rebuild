import re

# Read the file
with open(r'C:\Users\sxh\toolbox-rebuild\backend\src\modules\task.gateway.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and remove the problematic duplicate "return { success: true }; }" at the end
# The correct structure should be:
# - End of handleFivesimBuyNumber with its closing }
# - Then closing } for the class

# Find the last occurrence of handleFivesimBuyNumber
pattern = r'(@SubscribeMessage\(\'request\.fivesim\.buyNumber\'\).*?)\s+return \{ success: true \};\s+\}\s*$'
match = re.search(pattern, content, re.DOTALL)

if match:
    # Keep everything except the duplicate return statement
    new_content = match.group(1) + '\n}\n'
    content = content[:match.start()] + new_content
    
    print("Fixed duplicate return statement")

# Now ensure the file ends properly with just one closing brace for the class
if not content.rstrip().endswith('}'):
    content = content.rstrip() + '\n}\n'
    print("Added class closing brace")

# Write back
with open(r'C:\Users\sxh\toolbox-rebuild\backend\src\modules\task.gateway.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("File structure fixed")
