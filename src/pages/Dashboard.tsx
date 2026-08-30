import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, logout, StudentSession } from "@/lib/auth";
import { useStudentAssignments, Assignment } from "@/hooks/useStudentAssignments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  LogOut,
  Check,
  Copy,
  Download,
  RefreshCw,
  Search,
  X,
  MapPin,
  Pencil,
  List,
  AlignJustify,
  Users,
  Mail,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<StudentSession | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableInMumbai, setAvailableInMumbai] = useState(false);
  const [currentEvent, setCurrentEvent] = useState("");
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [needsAvailabilitySelection, setNeedsAvailabilitySelection] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [whatsappTemplate, setWhatsappTemplate] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [requestingUnassignment, setRequestingUnassignment] = useState(false);
  const [hasActiveRequest, setHasActiveRequest] = useState(false);
  const [requestingAssignment, setRequestingAssignment] = useState(false);
  const [hasActiveAssignmentRequest, setHasActiveAssignmentRequest] = useState(false);
  const [showAvailabilityBanner, setShowAvailabilityBanner] = useState(false);
  

  const {
    assignments,
    loading,
    toggleStatus,
    completedCount,
    totalCount,
    progress,
    refresh,
  } = useStudentAssignments();

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate("/");
      return;
    }
    setSession(s);
    fetchAvailabilityStatus(s.tr_number);
    fetchCurrentEvent();
    fetchMessageTemplates();
    checkActiveUnassignmentRequest(s.tr_number);
  }, [navigate]);

  const currentEventAssignments = currentEvent
    ? assignments.filter((a) => a.event_tag === currentEvent)
    : [];
  const currentEventTotal = currentEventAssignments.length;
  const currentEventCompleted = currentEventAssignments.filter(
    (a) => a.status === "completed"
  ).length;
  const currentEventPending = currentEventTotal - currentEventCompleted;
  const isCurrentEventFullyCompleted = currentEventTotal > 0 && currentEventPending === 0;
  const canRequestMoreForCurrentEvent =
    !!currentEvent && availableInMumbai && (currentEventTotal === 0 || isCurrentEventFullyCompleted);

  useEffect(() => {
    if (!session?.tr_number || !currentEvent) return;
    checkActiveAssignmentRequest(session.tr_number);
  }, [session?.tr_number, currentEvent]);

  useEffect(() => {
    // Only show this tip on first-time / zero-assignments state (per session+event).
    if (!session || !currentEvent || !availableInMumbai || currentEventTotal > 0) {
      setShowAvailabilityBanner(false);
      return;
    }

    const bannerKey = `availabilityBannerDismissed:${session.tr_number}:${currentEvent}`;
    const hasDismissed = sessionStorage.getItem(bannerKey) === "true";
    if (hasDismissed) {
      setShowAvailabilityBanner(false);
      return;
    }

    setShowAvailabilityBanner(true);
    const timeoutId = window.setTimeout(() => {
      sessionStorage.setItem(bannerKey, "true");
      setShowAvailabilityBanner(false);
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [session, currentEvent, availableInMumbai, currentEventTotal]);


  const fetchCurrentEvent = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "current_event_for_availability")
      .single();
    
    if (data) {
      setCurrentEvent(data.setting_value || "");
    }
  };

  const fetchMessageTemplates = async () => {
    const [whatsapp, emailSubj, emailBod] = await Promise.all([
      supabase.from("app_settings").select("setting_value").eq("setting_key", "whatsapp_message_template").single(),
      supabase.from("app_settings").select("setting_value").eq("setting_key", "email_message_subject").single(),
      supabase.from("app_settings").select("setting_value").eq("setting_key", "email_message_body").single(),
    ]);

    setWhatsappTemplate(whatsapp.data?.setting_value || "Afzal Us Salam\n\nKem cho?\n\nHame Darajah 11 1449H batch che from Al Jamea tus Saifiyah.\n\nSyedna Taher Saifuddin Aqa RA na Urus Mubarak na Ayyam ma hame ye aapna taraf si naam lai ne Rauzat Tahera ma bewe Moula ni zyarat kidi che.\n\nThis amal has been done as a part of khidmat from HadiAshar 1449 batch.\n\nKhuda sagla mumineen ne Rauzat Tahera ni zyarat naseeb kare.\n\nWasalaam");
    setEmailSubject(emailSubj.data?.setting_value || "Ziyarat Khidmat - Rawdat Tahera");
    setEmailBody(emailBod.data?.setting_value || "Afzal Us Salam\n\nKem cho?\n\nHame ye Syedna Taher Saifuddin Aqa RA na Urus Mubarak na Ayyam ma aapna taraf si naam lai ne Rauzat Tahera ma bewe Moula ni zyarat kidi che.\n\nThis amal has been done as a part of khidmat from HadiAshar 1449 batch.\n\nKhuda sagla mumineen ne Rauzat Tahera ni zyarat naseeb kare.\n\nWasalaam");
  };

  const checkActiveUnassignmentRequest = async (trNumber: string) => {
    const { data } = await supabase
      .from("unassignment_requests")
      .select("id")
      .eq("student_tr_number", trNumber)
      .eq("status", "pending")
      .single();
    
    setHasActiveRequest(!!data);
  };
  const requestUnassignment = async () => {
    if (!session || !currentEvent) return;

    if (!confirm(`Request to unassign your pending work for "${currentEvent}"?\n\nThis will:\n- Notify admin to remove your pending assignments\n- Keep your completed work\n- Free up beneficiaries for reassignment\n\nContinue?`)) {
      return;
    }

    setRequestingUnassignment(true);
    try {
      const { data, error } = await supabase.functions.invoke("notify-admin-request", {
        body: {
          kind: "unassignment",
          tr_number: session.tr_number,
          session_id: session.session_id,
          event_tag: currentEvent,
          reason: "Not available in Mumbai",
        },
      });

      if (error) throw error;

      setHasActiveRequest(true);
      if (data?.already_pending) {
        toast.success("Request already submitted. Admin will process it soon.");
      } else if (data?.emailed === false) {
        toast.success("Request submitted. (Email notification may have failed)");
      } else {
        toast.success("Request submitted! Admin will process it soon.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit request");
    } finally {
      setRequestingUnassignment(false);
    }
  };

  const checkActiveAssignmentRequest = async (trNumber: string) => {
    if (!currentEvent) return;
    
    // Check for active request (pending OR rejected within 24h) for the CURRENT event only
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    
    const { data } = await supabase
      .from("assignment_requests")
      .select("id, status, created_at")
      .eq("student_tr_number", trNumber)
      .eq("event_tag", currentEvent)
      .in("status", ["pending", "rejected"])
      .gte("created_at", yesterday.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // If there's a pending or recent rejected request for THIS event, show cancel option
    setHasActiveAssignmentRequest(!!data);
  };
  const requestAssignment = async () => {
    if (!session || !currentEvent) return;

    if (!availableInMumbai) {
      toast.error("Please mark yourself as available in Mumbai first.");
      return;
    }

    const pendingForCurrentEvent = assignments.filter(
      (a) => a.event_tag === currentEvent && a.status === "pending"
    ).length;
    if (pendingForCurrentEvent > 0) {
      toast.error(
        `You still have ${pendingForCurrentEvent} pending name(s) for "${currentEvent}". Complete them first.`
      );
      return;
    }

    if (!confirm(`Assign 10 new beneficiaries for "${currentEvent}" now?\n\nThis will:\n- Auto-assign up to 10 unassigned beneficiaries to you\n- Use the current event tag\n\nContinue?`)) {
      return;
    }

    setRequestingAssignment(true);
    try {
      // Remove any old assignment requests for this event to avoid manual workflow
      const { error: cleanupError } = await supabase
        .from("assignment_requests")
        .delete()
        .eq("student_tr_number", session.tr_number)
        .eq("event_tag", currentEvent);
      if (cleanupError) {
        console.warn("Failed to cleanup old assignment requests:", cleanupError);
      }

      const assignedSet = new Set<string>();
      const fetchBatchSize = 1000;
      let offset = 0;

      // Fetch ALL assignments to build assigned set
      while (true) {
        const { data, error } = await supabase
          .from("assignments")
          .select("beneficiary_its_id")
          .order("beneficiary_its_id")
          .range(offset, offset + fetchBatchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        data.forEach((a) => assignedSet.add(a.beneficiary_its_id));
        offset += fetchBatchSize;
      }

      // Fetch beneficiaries in pages and collect up to 10 unassigned
      const unassigned: Array<{ its_id: string }> = [];
      offset = 0;
      while (unassigned.length < 10) {
        const { data, error } = await supabase
          .from("beneficiaries")
          .select("its_id")
          .order("its_id")
          .range(offset, offset + fetchBatchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        for (const b of data) {
          if (!assignedSet.has(b.its_id)) {
            unassigned.push(b);
            if (unassigned.length >= 10) break;
          }
        }

        offset += fetchBatchSize;
      }

      if (unassigned.length === 0) {
        toast.success("All beneficiaries are already assigned.");
        return;
      }

      const newAssignments = unassigned.map((beneficiary) => ({
        beneficiary_its_id: beneficiary.its_id,
        student_tr_number: session.tr_number,
        event_tag: currentEvent,
      }));

      const { error } = await supabase.from("assignments").insert(newAssignments);
      if (error) throw error;

      setHasActiveAssignmentRequest(false);
      toast.success(`Assigned ${newAssignments.length} beneficiaries for "${currentEvent}".`);
      refresh();
    } catch (err) {
      console.error(err);
      toast.error("Failed to auto-assign beneficiaries");
    } finally {
      setRequestingAssignment(false);
    }
  };

  const cancelAssignmentRequest = async () => {
    if (!session || !currentEvent) return;
    
    if (!confirm(`Cancel your assignment request for "${currentEvent}"?\n\nThis will remove your pending request and allow you to submit a new one.`)) {
      return;
    }

    setRequestingAssignment(true);
    try {
      console.log("Cancelling all requests for:", { tr: session.tr_number, event: currentEvent });
      
      const { data, error } = await supabase
        .from("assignment_requests")
        .delete()
        .eq("student_tr_number", session.tr_number)
        .eq("event_tag", currentEvent)
        .select();

      if (error) throw error;

      console.log("Deleted requests:", data?.length || 0, data);
      
      setHasActiveAssignmentRequest(false);
      toast.success(`Request cancelled. ${data?.length || 0} request(s) removed.`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel request");
    } finally {
      setRequestingAssignment(false);
    }
  };

  const fetchAvailabilityStatus = async (trNumber: string) => {
    const { data } = await supabase
      .from("students")
      .select("available_in_mumbai, availability_updated_at")
      .eq("tr_number", trNumber)
      .single();
    
    if (data) {
      const isAvailable = data.available_in_mumbai === true;
      setAvailableInMumbai(isAvailable);
      // Show modal for anyone who is NOT available (including first-time users)
      setNeedsAvailabilitySelection(!isAvailable);
    }
    setIsInitialLoad(false);
  };

  const toggleAvailability = async () => {
    if (!session) return;
    
    vibrate([50, 50, 100]); // Haptic feedback
    setLoadingAvailability(true);
    try {
      const newStatus = !availableInMumbai;
      const { error } = await supabase
        .from("students")
        .update({
          available_in_mumbai: newStatus,
          availability_updated_at: new Date().toISOString(),
        })
        .eq("tr_number", session.tr_number);

      if (error) throw error;

      setAvailableInMumbai(newStatus);
      setNeedsAvailabilitySelection(false);
      toast.success(
        newStatus
          ? "Marked as available in Mumbai"
          : "Marked as unavailable in Mumbai"
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update availability");
    } finally {
      setLoadingAvailability(false);
    }
  };

  // Haptic feedback helper
  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const { filteredAssignments, groupedAssignments, groupedEventTags } = useMemo(() => {
    const query = searchQuery ? searchQuery.toLowerCase() : "";

    const filtered = assignments.filter((a) => {
      if (!query) return true;
      return (
        a.beneficiary.full_name.toLowerCase().includes(query) ||
        a.beneficiary.its_id.toLowerCase().includes(query) ||
        (a.beneficiary.jamaat?.toLowerCase().includes(query) ?? false)
      );
    });

    const grouped = filtered.reduce((acc, assignment) => {
      const tag = assignment.event_tag || "Untagged";
      if (!acc[tag]) acc[tag] = [];
      acc[tag].push(assignment);
      return acc;
    }, {} as Record<string, Assignment[]>);

    const tags = Object.keys(grouped).sort((a, b) =>
      a.localeCompare(b)
    );

    return { filteredAssignments: filtered, groupedAssignments: grouped, groupedEventTags: tags };
  }, [assignments, searchQuery]);

  const assignmentCardTitle = isCurrentEventFullyCompleted
    ? "All done for now!"
    : "Ready for Ziyarat?";
  const assignmentCardSubtitle =
    currentEventTotal === 0
      ? `Auto-assign 10 names for ${currentEvent}`
      : `You completed ${currentEventCompleted}/${currentEventTotal} for ${currentEvent}. Get 10 more?`;

  const assignmentRequestCard = currentEvent ? (
    <div className="card-elevated p-6 bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-900 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-lg bg-blue-500/20">
          <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-blue-900 dark:text-blue-100">
            {assignmentCardTitle}
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">
            {assignmentCardSubtitle}
          </p>
        </div>
      </div>
      {hasActiveAssignmentRequest ? (
        <div className="space-y-2">
          <div className="bg-white dark:bg-blue-950/50 rounded-md p-3 border border-blue-300 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-200 font-medium">
              Request Already Submitted
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
              Admin will process your request soon.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={requestAssignment}
              disabled={requestingAssignment}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              {requestingAssignment ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Users className="w-4 h-4 mr-2" />
              )}
              Assign 10 Now
            </Button>
            <Button
              onClick={cancelAssignmentRequest}
              disabled={requestingAssignment}
              variant="outline"
              className="border-blue-500 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-950"
              size="sm"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={requestAssignment}
          disabled={requestingAssignment}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {requestingAssignment ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Users className="w-4 h-4 mr-2" />
          )}
          Assign 10 Names Now
        </Button>
      )}
    </div>
  ) : null;

  const copyToClipboard = () => {
    const text = assignments
      .map(
        (a) =>
          `${a.beneficiary.full_name} | ${a.beneficiary.jamaat || "-"} | ${a.status}`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    toast.success("List copied to clipboard");
  };

  const downloadCSV = () => {
    const headers = "ITS ID,Name,Age,Gender,Jamaat,Status\n";
    const rows = assignments
      .map(
        (a) =>
          `${a.beneficiary.its_id},${a.beneficiary.full_name},${a.beneficiary.age || ""},${a.beneficiary.gender || ""},${a.beneficiary.jamaat || ""},${a.status}`
      )
      .join("\n");
    const csv = headers + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ziyarat-assignments-${session?.tr_number}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded CSV");
  };

  if (!session || loading || isInitialLoad) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Force availability selection modal
  if (needsAvailabilitySelection && currentEvent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card-elevated p-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-serif text-2xl text-foreground">Welcome, {session.name}!</h2>
              <p className="text-sm text-muted-foreground">
                Before you begin, please let us know your availability
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Event: <span className="text-primary">{currentEvent}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                This helps us assign beneficiaries to students who are available in Mumbai
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={async () => {
                  vibrate([50, 50, 100]);
                  setLoadingAvailability(true);
                  try {
                    const { error } = await supabase
                      .from("students")
                      .update({
                        available_in_mumbai: true,
                        availability_updated_at: new Date().toISOString(),
                      })
                      .eq("tr_number", session.tr_number);

                    if (error) throw error;

                    setAvailableInMumbai(true);
                    setNeedsAvailabilitySelection(false);
                    toast.success("Marked as available in Mumbai");
                  } catch (err) {
                    console.error(err);
                    toast.error("Failed to update availability");
                  } finally {
                    setLoadingAvailability(false);
                  }
                }}
                disabled={loadingAvailability}
                className="w-full h-14 text-base bg-green-500 hover:bg-green-600 text-white"
              >
                {loadingAvailability ? (
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <MapPin className="w-5 h-5 mr-2" />
                    I am available in Mumbai
                  </>
                )}
              </Button>

              <Button
                onClick={async () => {
                  vibrate(50);
                  setLoadingAvailability(true);
                  try {
                    const { error } = await supabase
                      .from("students")
                      .update({
                        available_in_mumbai: false,
                        availability_updated_at: new Date().toISOString(),
                      })
                      .eq("tr_number", session.tr_number);

                    if (error) throw error;

                    setAvailableInMumbai(false);
                    setNeedsAvailabilitySelection(false);
                    toast.success("Marked as not available in Mumbai");
                  } catch (err) {
                    console.error(err);
                    toast.error("Failed to update availability");
                  } finally {
                    setLoadingAvailability(false);
                  }
                }}
                disabled={loadingAvailability}
                variant="outline"
                className="w-full h-14 text-base border-2"
              >
                {loadingAvailability ? (
                  <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                ) : (
                  <>
                    <X className="w-5 h-5 mr-2" />
                    Not available in Mumbai
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              You can change this later from your dashboard
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <header className="app-header py-4 px-4 sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl md:text-2xl">Ziyarat Dashboard</h1>
            <p className="text-primary-foreground/70 text-sm">
              {session.name}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-card border-b border-border py-4 px-4">
        <div className="container max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              Progress: {completedCount} / {totalCount}
            </span>
            <span className="text-sm font-medium text-primary">{progress}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Availability Status Card */}
      {currentEvent && (
        <div className="bg-background border-b border-border py-4 px-4">
          <div className="container max-w-4xl mx-auto">
            {availableInMumbai ? (
              /* Compact Green Card - When Available */
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-950/20 border-2 border-green-300 dark:border-green-800 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-full bg-green-500/20">
                      <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                        Available in Mumbai for
                      </p>
                      <p className="font-bold text-sm text-green-900 dark:text-green-300">
                        {currentEvent}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={toggleAvailability}
                    disabled={loadingAvailability}
                    className="p-2 rounded-full hover:bg-green-200/50 dark:hover:bg-green-900/30 transition-colors"
                    title="Edit availability"
                  >
                    <Pencil className="w-3.5 h-3.5 text-green-700 dark:text-green-400" />
                  </button>
                </div>

                {canRequestMoreForCurrentEvent && (
                  <>
                    {showAvailabilityBanner && currentEventTotal === 0 && (
                      <div className="card-elevated p-3 bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-900">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-emerald-500/20">
                            <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm text-emerald-900 dark:text-emerald-100">
                              You are marked available in Mumbai for {currentEvent}.
                            </p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                              Wait for Admin to Assign or use "Assign 10 Names Now" button below to get started immediately.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (session && currentEvent) {
                                sessionStorage.setItem(
                                  `availabilityBannerDismissed:${session.tr_number}:${currentEvent}`,
                                  "true"
                                );
                              }
                              setShowAvailabilityBanner(false);
                            }}
                            className="p-1 rounded-md text-emerald-700 hover:bg-emerald-100/70 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                            aria-label="Dismiss notification"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                    {assignmentRequestCard}
                  </>
                )}
              </div>
            ) : (
              /* Full Toggle Card - When Not Available */
              <div className="space-y-3">
                <div className="card-elevated p-4 transition-all">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-muted">
                        <MapPin className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-foreground">
                          Are you available in Mumbai?
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          For: <span className="font-medium">{currentEvent}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        Not Available
                      </span>
                      <Switch
                        checked={availableInMumbai}
                        onCheckedChange={toggleAvailability}
                        disabled={loadingAvailability}
                      />
                    </div>
                  </div>
                </div>

                {/* Unassignment Request Card */}
                {totalCount > completedCount && (
                  <div className="card-elevated p-4 bg-orange-50 dark:bg-orange-950/20 border-2 border-orange-200 dark:border-orange-900">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-orange-500/20">
                        <RefreshCw className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-orange-900 dark:text-orange-100">
                          Unable to complete assignments?
                        </p>
                        <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                          {totalCount - completedCount} pending assignments for {currentEvent}
                        </p>
                      </div>
                    </div>
                    {hasActiveRequest ? (
                      <div className="bg-white dark:bg-orange-950/50 rounded-md p-3 border border-orange-300 dark:border-orange-800">
                        <p className="text-sm text-orange-900 dark:text-orange-200 font-medium">
                          Request Submitted
                        </p>
                        <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                          Admin will process your unassignment request soon.
                        </p>
                      </div>
                    ) : (
                      <Button
                        onClick={requestUnassignment}
                        disabled={requestingUnassignment}
                        variant="outline"
                        className="w-full border-orange-500 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-950"
                        size="sm"
                      >
                        {requestingUnassignment ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <X className="w-4 h-4 mr-2" />
                        )}
                        Request to Unassign Pending Work
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="bg-background border-b border-border py-3 px-4 sticky top-[76px] z-10">
        <div className="container max-w-4xl mx-auto flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ITS, or jamaat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => {
              vibrate(50);
              setCompactMode(!compactMode);
            }} 
            title={compactMode ? "Normal view" : "Compact view"}
          >
            {compactMode ? <AlignJustify className="w-4 h-4" /> : <List className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={copyToClipboard} title="Copy list">
            <Copy className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={downloadCSV} title="Download CSV">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Assignments List */}
      <main className="flex-1 py-4 px-4">
        <div className="container max-w-4xl mx-auto">
          {filteredAssignments.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery
                  ? "No matching records found"
                  : "No assignments yet"}
              </div>
              {/* Assignment Request Card - shown when 0 assignments and no search */}
              {!searchQuery && canRequestMoreForCurrentEvent && assignmentRequestCard}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedEventTags.map((tag) => (
                <details key={tag} className="card-elevated p-3">
                  <summary className="list-none cursor-pointer -mx-3 px-3 py-2 rounded-t-lg flex items-center justify-between gap-3 hover:bg-muted/40">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {tag}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {groupedAssignments[tag].filter((a) => a.status === "completed").length}/
                        {groupedAssignments[tag].length} completed
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {groupedAssignments[tag].length} total
                    </span>
                  </summary>
                  <div className="space-y-1.5 pt-3">
                    {groupedAssignments[tag].map((assignment) => (
                      <AssignmentRow
                        key={assignment.id}
                        assignment={assignment}
                        onToggle={toggleStatus}
                        compactMode={compactMode}
                        whatsappTemplate={whatsappTemplate}
                        emailSubject={emailSubject}
                        emailBody={emailBody}
                      />
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function AssignmentRow({
  assignment,
  onToggle,
  compactMode = false,
  whatsappTemplate = "",
  emailSubject = "",
  emailBody = "",
}: {
  assignment: Assignment;
  onToggle: (id: string, status: "pending" | "completed") => void;
  compactMode?: boolean;
  whatsappTemplate?: string;
  emailSubject?: string;
  emailBody?: string;
}) {
  const isCompleted = assignment.status === "completed";
  const hasEmail = assignment.beneficiary.email;
  const hasMobile = assignment.beneficiary.mobile;
  const hasContact = isCompleted && (hasEmail || hasMobile);

  // Haptic feedback
  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const handleCardClick = () => {
    vibrate(isCompleted ? 50 : [50, 50, 100]);
    onToggle(assignment.id, assignment.status);
  };

  const copyContact = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied!`);
  };

  // Format mobile number for WhatsApp (remove + and spaces)
  const getWhatsAppLink = (mobile: string) => {
    const cleanNumber = mobile.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(whatsappTemplate || "Afzal Us Salam\n\nKem cho?\n\nHame Darajah 11 1449H batch che from Al Jamea tus Saifiyah.\n\nSyedna Taher Saifuddin Aqa RA na Urus Mubarak na Ayyam ma hame ye aapna taraf si naam lai ne Rauzat Tahera ma bewe Moula ni zyarat kidi che.\n\nThis amal has been done as a part of khidmat from HadiAshar 1449 batch.\n\nKhuda sagla mumineen ne Rauzat Tahera ni zyarat naseeb kare.\n\nWasalaam");
    return `https://wa.me/${cleanNumber}?text=${message}`;
  };

  // Compact Mode View
  if (compactMode) {
    return (
      <div 
        className="flex items-center gap-2 py-2 px-3 rounded-lg border border-border bg-card cursor-pointer select-none active:scale-[0.98] transition-all hover:bg-muted/50"
        onClick={handleCardClick}
      >
        {/* Checkbox */}
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
          isCompleted 
            ? "bg-success border-success" 
            : "border-muted-foreground/30"
        }`}>
          {isCompleted && <Check className="w-3 h-3 text-success-foreground" />}
        </div>

        {/* Name - Single line */}
        <p className={`flex-1 text-xs font-medium truncate ${
          isCompleted ? "line-through text-muted-foreground" : "text-foreground"
        }`}>
          {assignment.beneficiary.full_name}
        </p>

        {/* Jamaat badge - minimal */}
        {assignment.beneficiary.jamaat && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate max-w-[80px]">
            {assignment.beneficiary.jamaat}
          </span>
        )}

        {/* Contact icons inline (only when completed) - Always vibrant */}
        {hasContact && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {hasMobile && (
              <a
                href={getWhatsAppLink(assignment.beneficiary.mobile!)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => vibrate(50)}
                className="p-1 hover:bg-green-500/20 rounded active:scale-95"
                title={assignment.beneficiary.mobile}
              >
                <MessageCircle className="w-4 h-4 text-green-700 dark:text-green-300" />
              </a>
            )}
            {hasEmail && (
                <a
                href={`mailto:${assignment.beneficiary.email}?subject=${encodeURIComponent(emailSubject || "Ziyarat Khidmat - Rawdat Tahera")}&body=${encodeURIComponent(emailBody || "Afzal Us Salam\n\nKem cho?\n\nHame ye Syedna Taher Saifuddin Aqa RA na Urus Mubarak na Ayyam ma aapna taraf si naam lai ne Rauzat Tahera ma bewe Moula ni zyarat kidi che.\n\nThis amal has been done as a part of khidmat from HadiAshar 1449 batch.\n\nKhuda sagla mumineen ne Rauzat Tahera ni zyarat naseeb kare.\n\nWasalaam")}`}
                onClick={() => vibrate(50)}
                className="p-1 hover:bg-blue-500/20 rounded active:scale-95"
                title={assignment.beneficiary.email}
                >
                <Mail className="w-4 h-4 text-blue-700 dark:text-blue-300" />
                </a>
            )}
          </div>
        )}

        {/* Status icon */}
        <span className={`text-[10px] ${isCompleted ? "text-success" : "text-orange-600"}`}>
          {isCompleted ? "Done" : "Pending"}
        </span>
      </div>
    );
  }

  // Normal Mode View (Default - Original Style)
  return (
    <div className="card-elevated p-4 transition-all duration-200 cursor-pointer select-none active:scale-[0.98]" onClick={handleCardClick}>
      <div className={`flex items-center gap-4 ${isCompleted ? "opacity-60" : ""}`}>
        {/* Checkbox */}
        <div
          className={`ziyarat-checkbox ${isCompleted ? "checked" : ""}`}
          aria-label={isCompleted ? "Mark as pending" : "Mark as completed"}
        >
          {isCompleted && <Check className="w-3.5 h-3.5 text-success-foreground" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={`font-medium text-foreground break-words ${
              isCompleted ? "line-through text-muted-foreground" : ""
            }`}
          >
            {assignment.beneficiary.full_name}
          </p>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
            {assignment.event_tag && (
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {assignment.event_tag}
              </span>
            )}
            {assignment.beneficiary.age && (
              <span>{assignment.beneficiary.age} yrs</span>
            )}
            {assignment.beneficiary.gender && (
              <span>{assignment.beneficiary.gender}</span>
            )}
            {assignment.beneficiary.jamaat && (
              <span className="truncate">{assignment.beneficiary.jamaat}</span>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <span className={isCompleted ? "badge-completed" : "badge-pending"}>
          {isCompleted ? "Done" : "Pending"}
        </span>
      </div>

      {/* Contact Details - Show when completed (NOT greyed out) */}
      {hasContact && (
        <div className="mt-3 pt-3 border-t border-border space-y-2" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-medium text-foreground mb-2">
            Contact to inform about Ziyarat:
          </p>
          <div className="flex flex-col gap-2">
            {hasMobile && (
              <div className="flex items-center gap-2">
                <a
                  href={getWhatsAppLink(assignment.beneficiary.mobile!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => vibrate(50)}
                  className="flex-1 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-300 rounded-md text-sm transition-colors flex items-center gap-2 font-medium"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="flex-1 truncate">{assignment.beneficiary.mobile}</span>
                  <span className="text-xs opacity-70">WhatsApp</span>
                </a>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    vibrate(50);
                    copyContact(assignment.beneficiary.mobile!, "Mobile");
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            )}
            {hasEmail && (
              <div className="flex items-center gap-2">
                <a
                  href={`mailto:${assignment.beneficiary.email}?subject=${encodeURIComponent(emailSubject || "Ziyarat Khidmat - Rawdat Tahera")}&body=${encodeURIComponent(emailBody || "Afzal Us Salam\n\nKem cho?\n\nHame ye Syedna Taher Saifuddin Aqa RA na Urus Mubarak na Ayyam ma aapna taraf si naam lai ne Rauzat Tahera ma bewe Moula ni zyarat kidi che.\n\nThis amal has been done as a part of khidmat from HadiAshar 1449 batch.\n\nKhuda sagla mumineen ne Rauzat Tahera ni zyarat naseeb kare.\n\nWasalaam")}`}
                  onClick={() => vibrate(50)}
                  className="flex-1 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-md text-sm transition-colors flex items-center gap-2 font-medium"
                >
                  <Mail className="w-4 h-4" />
                  <span className="flex-1 truncate">{assignment.beneficiary.email}</span>
                  <span className="text-xs opacity-70">Email</span>
                </a>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    vibrate(50);
                    copyContact(assignment.beneficiary.email!, "Email");
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}




