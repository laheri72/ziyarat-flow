import re

with open("src/pages/Admin.tsx", "r") as f:
    content = f.read()

content = content.replace("let unassignedList = unassignedBeneficiaries;", "const unassignedList = unassignedBeneficiaries;")

with open("src/pages/Admin.tsx", "w") as f:
    f.write(content)
