import re

with open("src/pages/Admin.tsx", "r") as f:
    content = f.read()

# Fix 1: ReferenceError in handleAutoAssign.
# In handleAutoAssign, the replace converted unassignedBeneficiaries.length to unassignedList.length
search_auto_toast = 'toast.success(`Assigned ${newAssignments.length} new beneficiaries for "${eventTag}" (~${Math.ceil(unassignedList.length / students.length)} per student)`);'
replace_auto_toast = 'toast.success(`Assigned ${newAssignments.length} new beneficiaries for "${eventTag}" (~${Math.ceil(unassignedBeneficiaries.length / students.length)} per student)`);'
content = content.replace(search_auto_toast, replace_auto_toast)

# Fix 2: Reassigning const unassignedBeneficiaries in manual assign
search_manual_slice = """      if (cap < unassignedList.length) {
        unassignedBeneficiaries = unassignedBeneficiaries.slice(0, cap);
        console.log(`📊 Applied cap: assigning ${cap} beneficiaries`);
      }

      // Distribute unassigned beneficiaries evenly among SELECTED students
      const newAssignments = unassignedBeneficiaries.map((beneficiary, index) => ({"""

replace_manual_slice = """      let finalBeneficiaries = unassignedBeneficiaries;
      if (cap < unassignedBeneficiaries.length) {
        finalBeneficiaries = unassignedBeneficiaries.slice(0, cap);
        console.log(`📊 Applied cap: assigning ${cap} beneficiaries`);
      }

      // Distribute unassigned beneficiaries evenly among SELECTED students
      const newAssignments = finalBeneficiaries.map((beneficiary, index) => ({"""

content = content.replace(search_manual_slice, replace_manual_slice)

with open("src/pages/Admin.tsx", "w") as f:
    f.write(content)
