import { useEffect, useState } from "react";
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
  
  // Pull-to-refresh state
  const [pullToRefreshActive, setPullToRefreshActive] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);

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
  }, [navigate]);

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshing) {
      setTouchStartY(e.touches[0].clientY);
      setPullToRefreshActive(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pullToRefreshActive || isRefreshing) return;
    
    const touchY = e.touches[0].clientY;
    const distance = touchY - touchStartY;
    
    if (distance > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(distance, 120));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 80 && !isRefreshing) {
      setIsRefreshing(true);
      await handleRefresh();
    }
    setPullToRefreshActive(false);
    setPullDistance(0);
  };

  const handleRefresh = async () => {
    try {
      await Promise.all([
        refresh(),
        fetchAvailabilityStatus(session?.tr_number || ""),
        fetchCurrentEvent(),
      ]);
      toast.success("Refreshed!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to refresh");
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

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

  const fetchAvailabilityStatus = async (trNumber: string) => {
    const { data } = await supabase
      .from("students")
      .select("available_in_mumbai")
      .eq("tr_number", trNumber)
      .single();
    
    if (data) {
      setAvailableInMumbai(data.available_in_mumbai || false);
    }
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
      toast.success(
        newStatus
          ? "✅ Marked as available in Mumbai"
          : "❌ Marked as unavailable in Mumbai"
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

  const filteredAssignments = assignments.filter((a) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      a.beneficiary.full_name.toLowerCase().includes(query) ||
      a.beneficiary.its_id.toLowerCase().includes(query) ||
      (a.beneficiary.jamaat?.toLowerCase().includes(query) ?? false)
    );
  });

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

  if (!session || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-background flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-Refresh Indicator */}
      <div 
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-all duration-300 ease-out"
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 0 ? 1 : 0,
          pointerEvents: 'none',
        }}
      >
        <div 
          className="bg-primary/90 backdrop-blur-sm rounded-full p-3 shadow-lg transform transition-transform"
          style={{
            transform: `scale(${Math.min(pullDistance / 80, 1)}) rotate(${pullDistance * 3}deg)`,
          }}
        >
          <RefreshCw 
            className={`w-5 h-5 text-primary-foreground ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </div>
      </div>

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
              <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-950/20 border-2 border-green-300 dark:border-green-800 rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-full bg-green-500/20">
                    <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                      ✅ Available in Mumbai for
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
            ) : (
              /* Full Toggle Card - When Not Available */
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
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery
                ? "No matching records found"
                : "No assignments yet. Please contact admin."}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredAssignments.map((assignment) => (
                <AssignmentRow
                  key={assignment.id}
                  assignment={assignment}
                  onToggle={toggleStatus}
                  compactMode={compactMode}
                />
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
}: {
  assignment: Assignment;
  onToggle: (id: string, status: "pending" | "completed") => void;
  compactMode?: boolean;
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
    const message = encodeURIComponent(
      `Afzal Us Salam\n\nKem cho?\n\nHame ye Syedna Taher Saifuddin Aqa RA na Urus Mubarak na Ayyam ma aapna taraf si naam lai ne Rauzat Tahera ma bewe Moula ni zyarat kidi che.\n\nThis amal has been done as a part of khidmat from HadiAshar 1449 batch.\n\nKhuda sagla mumineen ne Rauzat Tahera ni zyarat naseeb kare.\n\nWasalaam`
    );
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
                <span className="text-xs">💬</span>
              </a>
            )}
            {hasEmail && (
              <a
                href={`mailto:${assignment.beneficiary.email}?subject=Ziyarat Khidmat - Rawdat Tahera&body=Afzal Us Salam%0D%0A%0D%0AKem cho?%0D%0A%0D%0AHame ye Syedna Taher Saifuddin Aqa RA na Urus Mubarak na Ayyam ma aapna taraf si naam lai ne Rauzat Tahera ma bewe Moula ni zyarat kidi che.%0D%0A%0D%0AThis amal has been done as a part of khidmat from HadiAshar 1449 batch.%0D%0A%0D%0AKhuda sagla mumineen ne Rauzat Tahera ni zyarat naseeb kare.%0D%0A%0D%0AWasalaam`}
                onClick={() => vibrate(50)}
                className="p-1 hover:bg-blue-500/20 rounded active:scale-95"
                title={assignment.beneficiary.email}
              >
                <span className="text-xs">✉️</span>
              </a>
            )}
          </div>
        )}

        {/* Status icon */}
        <span className={`text-xs ${isCompleted ? "text-success" : "text-orange-600"}`}>
          {isCompleted ? "✓" : "○"}
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
            📞 Contact to inform about Ziyarat:
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
                  <span className="text-base">💬</span>
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
                  href={`mailto:${assignment.beneficiary.email}?subject=Ziyarat Khidmat - Rawdat Tahera&body=Afzal Us Salam%0D%0A%0D%0AKem cho?%0D%0A%0D%0AHame ye Syedna Taher Saifuddin Aqa RA na Urus Mubarak na Ayyam ma aapna taraf si naam lai ne Rauzat Tahera ma bewe Moula ni zyarat kidi che.%0D%0A%0D%0AThis amal has been done as a part of khidmat from HadiAshar 1449 batch.%0D%0A%0D%0AKhuda sagla mumineen ne Rauzat Tahera ni zyarat naseeb kare.%0D%0A%0D%0AWasalaam`}
                  onClick={() => vibrate(50)}
                  className="flex-1 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-md text-sm transition-colors flex items-center gap-2 font-medium"
                >
                  <span className="text-base">✉️</span>
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
