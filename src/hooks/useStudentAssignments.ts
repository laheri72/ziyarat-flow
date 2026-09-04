import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSession } from "@/lib/auth";
import { toast } from "sonner";

export interface Assignment {
  id: string;
  beneficiary_its_id: string;
  status: "pending" | "completed";
  completed_at: string | null;
  event_tag: string | null;
  beneficiary: {
    its_id: string;
    full_name: string;
    age: number | null;
    gender: string | null;
    jamaat: string | null;
    email: string | null;
    mobile: string | null;
  };
}

interface OfflineMutation {
  id: string;
  status: "pending" | "completed";
  completed_at: string | null;
  updated_at: string;
}

const getCacheKey = (tr: string) => `ziyarat_assignments_cache_${tr}`;
const getQueueKey = (tr: string) => `ziyarat_offline_queue_${tr}`;

function loadCachedAssignments(tr: string): Assignment[] {
  try {
    const raw = localStorage.getItem(getCacheKey(tr));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Failed to load cached assignments:", e);
    return [];
  }
}

function saveCachedAssignments(tr: string, assignments: Assignment[]) {
  try {
    localStorage.setItem(getCacheKey(tr), JSON.stringify(assignments));
  } catch (e) {
    console.warn("Failed to save assignments cache:", e);
  }
}

function loadSyncQueue(tr: string): OfflineMutation[] {
  try {
    const raw = localStorage.getItem(getQueueKey(tr));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Failed to load sync queue:", e);
    return [];
  }
}

function saveSyncQueue(tr: string, queue: OfflineMutation[]) {
  try {
    localStorage.setItem(getQueueKey(tr), JSON.stringify(queue));
  } catch (e) {
    console.warn("Failed to save sync queue:", e);
  }
}

export function useStudentAssignments() {
  const session = getSession();
  const trNumber = session?.tr_number || "";

  // 1. Synchronously hydrate from cache immediately (0ms wait time for student)
  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    return trNumber ? loadCachedAssignments(trNumber) : [];
  });
  
  const [loading, setLoading] = useState<boolean>(() => {
    // If we have cached assignments, we are not loading!
    if (!trNumber) return true;
    const cached = loadCachedAssignments(trNumber);
    return cached.length === 0;
  });

  const [error, setError] = useState<string | null>(null);
  const isSyncingRef = useRef(false);

  // Background queue flusher to sync any pending offline mutations
  const flushSyncQueue = useCallback(async () => {
    if (!trNumber || isSyncingRef.current || !navigator.onLine) return;

    const queue = loadSyncQueue(trNumber);
    if (queue.length === 0) return;

    isSyncingRef.current = true;

    try {
      const remainingQueue: OfflineMutation[] = [];

      for (const mutation of queue) {
        try {
          const { error: updateError } = await supabase
            .from("assignments")
            .update({
              status: mutation.status,
              completed_at: mutation.completed_at,
            })
            .eq("id", mutation.id);

          if (updateError) {
            console.warn(`Sync failed for assignment ${mutation.id}:`, updateError);
            remainingQueue.push(mutation);
          }
        } catch (itemErr) {
          console.warn(`Network error syncing ${mutation.id}:`, itemErr);
          remainingQueue.push(mutation);
        }
      }

      saveSyncQueue(trNumber, remainingQueue);
    } finally {
      isSyncingRef.current = false;
    }
  }, [trNumber]);

  // Fetch latest from server and merge with any unsynced offline mutations
  const fetchAssignments = useCallback(async () => {
    const s = getSession();
    if (!s) {
      setError("Not logged in");
      setLoading(false);
      return;
    }

    // If offline, flush will occur when back online; just ensure we render cached data
    if (!navigator.onLine) {
      const cached = loadCachedAssignments(s.tr_number);
      if (cached.length > 0) {
        setAssignments(cached);
      }
      setLoading(false);
      return;
    }

    try {
      // First flush any pending offline updates before fetching fresh state
      await flushSyncQueue();

      // Fetch with timeout resilience
      const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error("Fetch timeout")), 6000)
      );

      const fetchPromise = supabase
        .from("assignments")
        .select(`
          id,
          beneficiary_its_id,
          status,
          completed_at,
          event_tag,
          beneficiary:beneficiaries (
            its_id,
            full_name,
            age,
            gender,
            jamaat,
            email,
            mobile
          )
        `)
        .eq("student_tr_number", s.tr_number)
        .order("status", { ascending: true })
        .order("beneficiary_its_id", { ascending: true });

      const response = await Promise.race([fetchPromise, timeoutPromise]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchError } = response as { data: any[] | null; error: any };

      if (fetchError) throw fetchError;

      if (data) {
        // Load pending queue to ensure local un-flushed changes are not overwritten
        const currentQueue = loadSyncQueue(s.tr_number);
        const queueMap = new Map(currentQueue.map((q) => [q.id, q]));

        const typedData: Assignment[] = data.map((item) => {
          const pendingMutation = queueMap.get(item.id);
          const currentStatus = pendingMutation ? pendingMutation.status : (item.status as "pending" | "completed");
          const currentCompletedAt = pendingMutation ? pendingMutation.completed_at : item.completed_at;

          return {
            ...item,
            status: currentStatus,
            completed_at: currentCompletedAt,
            beneficiary: item.beneficiary as Assignment["beneficiary"],
          };
        });

        setAssignments(typedData);
        saveCachedAssignments(s.tr_number, typedData);
      }

      setError(null);
    } catch (err) {
      console.warn("Network fetch issue, using local cache:", err);
      // Fallback cleanly to local cache
      const cached = loadCachedAssignments(s.tr_number);
      if (cached.length > 0) {
        setAssignments(cached);
      }
    } finally {
      setLoading(false);
    }
  }, [flushSyncQueue]);

  // Initial load and periodic/event background sync
  useEffect(() => {
    fetchAssignments();

    // Auto-sync when coming back online
    const handleOnline = () => {
      flushSyncQueue();
      fetchAssignments();
    };

    // Auto-sync when user returns to app tab
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        flushSyncQueue();
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    // Periodic sync check every 20s
    const interval = setInterval(() => {
      if (navigator.onLine) {
        flushSyncQueue();
      }
    }, 20000);

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [fetchAssignments, flushSyncQueue]);

  // 2. Instant Local Ticking with Offline Queue Persistence
  const toggleStatus = useCallback(
    async (assignmentId: string, currentStatus: "pending" | "completed") => {
      const s = getSession();
      if (!s) return;

      const newStatus: "pending" | "completed" = currentStatus === "pending" ? "completed" : "pending";
      const completedAt = newStatus === "completed" ? new Date().toISOString() : null;

      // 1. Instant Optimistic State Update
      setAssignments((prev) => {
        const nextList = prev.map((a) =>
          a.id === assignmentId
            ? { ...a, status: newStatus, completed_at: completedAt }
            : a
        );
        // 2. Immediately persist to localStorage "Paper Sheet"
        saveCachedAssignments(s.tr_number, nextList);
        return nextList;
      });

      // 3. Append mutation to offline sync queue (with Last-Write-Wins coalescing)
      const existingQueue = loadSyncQueue(s.tr_number);
      const filteredQueue = existingQueue.filter((item) => item.id !== assignmentId);
      const updatedQueue: OfflineMutation[] = [
        ...filteredQueue,
        {
          id: assignmentId,
          status: newStatus,
          completed_at: completedAt,
          updated_at: new Date().toISOString(),
        },
      ];
      saveSyncQueue(s.tr_number, updatedQueue);

      toast.success(newStatus === "completed" ? "Marked as completed" : "Marked as pending");

      // 4. If online, flush immediately in background
      if (navigator.onLine) {
        flushSyncQueue();
      }
    },
    [flushSyncQueue]
  );

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

