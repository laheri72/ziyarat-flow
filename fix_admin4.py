import re

with open("src/pages/Admin.tsx", "r") as f:
    content = f.read()

# Fix unassignedBeneficiaries filter logic that got left behind in manual assign
search_manual_filter = """      // Create a Set of assigned ITS IDs for fast lookup
      const assignedSet = new Set(allAssignments.map(a => a.beneficiary_its_id));

      // Filter to get only unassigned beneficiaries
      let unassignedBeneficiaries = allBeneficiaries.filter(b => !assignedSet.has(b.its_id));"""

replace_manual_filter = """      // ⚡ Bolt: removed legacy array filtering; unassignedBeneficiaries is already populated correctly above.
      // Need to reassign to let because manual assign applies a cap later.
      let unassignedList = unassignedBeneficiaries;"""

content = content.replace(search_manual_filter, replace_manual_filter)
content = content.replace("unassignedBeneficiaries.length", "unassignedList.length")

# Change unassignedList back to unassignedBeneficiaries in a few places to match the cap logic
search_cap = """      const cap = beneficiaryCap.trim() ? parseInt(beneficiaryCap.trim()) : unassignedList.length;"""
replace_cap = """      const cap = beneficiaryCap.trim() ? parseInt(beneficiaryCap.trim()) : unassignedBeneficiaries.length;"""
content = content.replace(search_cap, replace_cap)

search_reassign = """      if (cap > 0 && cap < unassignedList.length) {
        unassignedList = unassignedList.slice(0, cap);
        console.log(`📏 Applied cap: limited to ${cap} beneficiaries`);
      }"""
replace_reassign = """      let unassignedListForCap = unassignedBeneficiaries;
      if (cap > 0 && cap < unassignedBeneficiaries.length) {
        unassignedListForCap = unassignedBeneficiaries.slice(0, cap);
        console.log(`📏 Applied cap: limited to ${cap} beneficiaries`);
      }"""
content = content.replace(search_reassign, replace_reassign)

# Now fix the distribution logic
search_distribute = """      // Distribute unassigned beneficiaries evenly among selected students
      const newAssignments = unassignedList.map((beneficiary, index) => ({"""
replace_distribute = """      // Distribute unassigned beneficiaries evenly among selected students
      const newAssignments = unassignedListForCap.map((beneficiary, index) => ({"""
content = content.replace(search_distribute, replace_distribute)

with open("src/pages/Admin.tsx", "w") as f:
    f.write(content)
