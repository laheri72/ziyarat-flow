import re

with open("src/pages/Admin.tsx", "r") as f:
    content = f.read()

# I will just revert my previous unassignedList attempts and rename unassignedList back to unassignedBeneficiaries globally in the block I messed up

content = content.replace("unassignedList.length", "unassignedBeneficiaries.length")
content = content.replace("unassignedList", "unassignedBeneficiaries")

# Also need to remove the "const unassignedBeneficiaries = unassignedBeneficiaries;" line if it exists
search_weird = """      // Need to reassign to let because manual assign applies a cap later.
      const unassignedBeneficiaries = unassignedBeneficiaries;"""
content = content.replace(search_weird, "")

with open("src/pages/Admin.tsx", "w") as f:
    f.write(content)
