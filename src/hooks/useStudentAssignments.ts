import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSession } from "@/lib/auth";
import { toast } from "sonner";

export interface Assignment {
  id: string;
  beneficiary_its_id: string;
  status: "pending" | "completed";
  completed_at: string | null;
  beneficiary: {
    its_id: string;
    full_name: string;
    age: number | null;
    gender: string | null;
    jamaat: string | null;
  };
}

export function useStudentAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    const session = getSession();
    if (!session) {
      setError("Not logged in");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("assignments")
        .select(`
          id,
          beneficiary_its_id,
          status,
          completed_at,
          beneficiary:beneficiaries (
            its_id,
            full_name,
            age,
            gender,
            jamaat
          )
        `)
        .eq("student_tr_number", session.tr_number)
        .order("status", { ascending: true })
        .order("beneficiary_its_id", { ascending: true });

      if (error) throw error;

      // Type assertion for the nested beneficiary object
      const typedData = (data || []).map((item) => ({
        ...item,
        status: item.status as "pending" | "completed",
        beneficiary: item.beneficiary as Assignment["beneficiary"],
      }));

      setAssignments(typedData);
      setError(null);
    } catch (err) {
      console.error("Error fetching assignments:", err);
      setError("Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const toggleStatus = async (assignmentId: string, currentStatus: "pending" | "completed") => {
    const newStatus = currentStatus === "pending" ? "completed" : "pending";
    const completedAt = newStatus === "completed" ? new Date().toISOString() : null;

    // Optimistic update
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === assignmentId
          ? { ...a, status: newStatus, completed_at: completedAt }
          : a
      )
    );

    try {
      const { error } = await supabase
        .from("assignments")
        .update({ status: newStatus, completed_at: completedAt })
        .eq("id", assignmentId);

      if (error) throw error;
      
      toast.success(newStatus === "completed" ? "Marked as completed" : "Marked as pending");
    } catch (err) {
      console.error("Error updating status:", err);
      toast.error("Failed to update status");
      // Revert on error
      fetchAssignments();
    }
  };

  const completedCount = assignments.filter((a) => a.status === "completed").length;
  const totalCount = assignments.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    assignments,
    loading,
    error,
    toggleStatus,
    completedCount,
    totalCount,
    progress,
    refresh: fetchAssignments,
  };
}
