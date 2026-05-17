import re

with open("src/pages/Admin.tsx", "r") as f:
    content = f.read()

content = content.replace("console.log(`👤 Total beneficiaries: ${allBeneficiaries.length}`);", "console.log(`👤 Total beneficiaries: ${totalBeneficiaries}`);")
content = content.replace("console.log(`📋 Already assigned: ${assignedSet.size}`);", "console.log(`📋 Already assigned: ${totalAssigned}`);")

with open("src/pages/Admin.tsx", "w") as f:
    f.write(content)
