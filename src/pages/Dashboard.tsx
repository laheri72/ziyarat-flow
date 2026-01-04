import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, logout, StudentSession } from "@/lib/auth";
import { useStudentAssignments, Assignment } from "@/hooks/useStudentAssignments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LogOut,
  Check,
  Copy,
  Download,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<StudentSession | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
  }, [navigate]);

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
          <Button variant="outline" size="icon" onClick={refresh} title="Refresh">
            <RefreshCw className="w-4 h-4" />
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
            <div className="space-y-2">
              {filteredAssignments.map((assignment) => (
                <AssignmentRow
                  key={assignment.id}
                  assignment={assignment}
                  onToggle={toggleStatus}
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
}: {
  assignment: Assignment;
  onToggle: (id: string, status: "pending" | "completed") => void;
}) {
  const isCompleted = assignment.status === "completed";

  return (
    <div
      className={`card-elevated p-4 flex items-center gap-4 transition-all duration-200 table-row-hover ${
        isCompleted ? "opacity-60" : ""
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(assignment.id, assignment.status)}
        className={`ziyarat-checkbox ${isCompleted ? "checked" : ""}`}
        aria-label={isCompleted ? "Mark as pending" : "Mark as completed"}
      >
        {isCompleted && <Check className="w-3.5 h-3.5 text-success-foreground" />}
      </button>

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
  );
}
