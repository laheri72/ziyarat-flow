import re

with open("src/pages/Admin.tsx", "r") as f:
    content = f.read()

# I am going to replace the handleManualAssign body with the correct chunking logic.
search_manual = """      // Fetch ALL beneficiaries with pagination
      const allBeneficiaries = [];
      let offset = 0;
      const fetchBatchSize = 1000;

      console.log("📥 Fetching all beneficiaries...");
      while (true) {
        const { data, error } = await supabase
          .from("beneficiaries")
          .select("its_id")
          .order('its_id')
          .range(offset, offset + fetchBatchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allBeneficiaries.push(...data);
        offset += fetchBatchSize;
        console.log(`📥 Loaded ${allBeneficiaries.length} beneficiaries...`);
      }

      // Fetch ALL assignments with pagination
      const allAssignments = [];
      offset = 0;

      console.log("📥 Fetching all assignments...");
      while (true) {
        const { data, error } = await supabase
          .from("assignments")
          .select("beneficiary_its_id")
          .order('beneficiary_its_id')
          .range(offset, offset + fetchBatchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allAssignments.push(...data);
        offset += fetchBatchSize;
        console.log(`📥 Loaded ${allAssignments.length} assignments...`);
      }

      // ⚡ Bolt: removed legacy array filtering; unassignedBeneficiaries is already populated correctly above.


      console.log(`👤 Total beneficiaries: ${totalBeneficiaries}`);
      console.log(`📋 Already assigned: ${totalAssigned}`);"""

replace_manual = """      // ⚡ Bolt: Prevent N+1 query and memory bottleneck by batching assignment checks
      // Fetch beneficiaries with pagination and check assignments in batches
      const unassignedBeneficiaries = [];
      let offset = 0;
      const fetchBatchSize = 1000;
      let totalBeneficiaries = 0;
      let totalAssigned = 0;

      console.log("📥 Fetching beneficiaries and checking assignments...");
      while (true) {
        const { data: batchBeneficiaries, error } = await supabase
          .from("beneficiaries")
          .select("its_id")
          .order('its_id')
          .range(offset, offset + fetchBatchSize - 1);

        if (error) throw error;
        if (!batchBeneficiaries || batchBeneficiaries.length === 0) break;

        totalBeneficiaries += batchBeneficiaries.length;
        const batchItsIds = batchBeneficiaries.map(b => b.its_id);

        // ⚡ Bolt: Chunk assignment query by exact ITS IDs to avoid fetching full assignments table
        const assignedSet = new Set();
        const inChunkSize = 500;
        for (let i = 0; i < batchItsIds.length; i += inChunkSize) {
          const chunkIds = batchItsIds.slice(i, i + inChunkSize);
          const { data: assignments, error: assignError } = await supabase
            .from("assignments")
            .select("beneficiary_its_id")
            .in("beneficiary_its_id", chunkIds);

          if (assignError) throw assignError;
          if (assignments) {
             assignments.forEach(a => assignedSet.add(a.beneficiary_its_id));
          }
        }

        totalAssigned += assignedSet.size;

        const batchUnassigned = batchBeneficiaries.filter(b => !assignedSet.has(b.its_id));
        unassignedBeneficiaries.push(...batchUnassigned);

        offset += fetchBatchSize;
        console.log(`📥 Processed ${totalBeneficiaries} beneficiaries, found ${unassignedBeneficiaries.length} unassigned...`);
      }

      console.log(`👤 Total beneficiaries: ${totalBeneficiaries}`);
      console.log(`📋 Already assigned: ${totalAssigned}`);"""

content = content.replace(search_manual, replace_manual)

with open("src/pages/Admin.tsx", "w") as f:
    f.write(content)
