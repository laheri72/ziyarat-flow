import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  Users,
  BarChart3,
  Settings,
  Download,
  Play,
  Loader2,
  Search,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Stats {
  totalBeneficiaries: number;
  totalStudents: number;
  totalAssignments: number;
  completedAssignments: number;
}

interface StudentProgress {
  tr_number: string;
  name: string;
  branch: string;
  assigned: number;
  completed: number;
}

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [stats, setStats] = useState<Stats>({
    totalBeneficiaries: 0,
    totalStudents: 0,
    totalAssignments: 0,
    completedAssignments: 0,
  });
  const [studentProgress, setStudentProgress] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Simple password check (in production, use proper auth)
  const handleLogin = () => {
    if (password === "ziyafat1449") {
      setAuthenticated(true);
      toast.success("Access granted");
    } else {
      toast.error("Invalid password");
    }
  };

  useEffect(() => {
    if (authenticated) {
      fetchStats();
      fetchStudentProgress();
    }
  }, [authenticated]);

  const fetchStats = async () => {
    const [beneficiaries, students, assignments, completed] = await Promise.all([
      supabase.from("beneficiaries").select("its_id", { count: "exact", head: true }),
      supabase.from("students").select("tr_number", { count: "exact", head: true }),
      supabase.from("assignments").select("id", { count: "exact", head: true }),
      supabase
        .from("assignments")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
    ]);

    setStats({
      totalBeneficiaries: beneficiaries.count || 0,
      totalStudents: students.count || 0,
      totalAssignments: assignments.count || 0,
      completedAssignments: completed.count || 0,
    });
  };

  const fetchStudentProgress = async () => {
    const { data: students } = await supabase
      .from("students")
      .select("tr_number, name, branch")
      .eq("is_active", true)
      .order("name");

    if (!students) return;

    const progressPromises = students.map(async (student) => {
      const [assigned, completed] = await Promise.all([
        supabase
          .from("assignments")
          .select("id", { count: "exact", head: true })
          .eq("student_tr_number", student.tr_number),
        supabase
          .from("assignments")
          .select("id", { count: "exact", head: true })
          .eq("student_tr_number", student.tr_number)
          .eq("status", "completed"),
      ]);

      return {
        ...student,
        branch: student.branch || "",
        assigned: assigned.count || 0,
        completed: completed.count || 0,
      };
    });

    const progress = await Promise.all(progressPromises);
    setStudentProgress(progress);
  };

  const handleBeneficiaryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      // Skip header rows by starting from row 2 (0-indexed), look for the actual data
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: 1 });

      const beneficiaries = rows.map((row) => ({
        its_id: String(row["ITS ID"] || row["ITS_ID"] || row["ITS NUMBER"] || row["its_id"] || "").trim(),
        full_name: String(row["Full Name"] || row["Full_Name"] || row["NAME"] || row["full_name"] || row["Name"] || "").trim(),
        age: row["Age"] || row["age"] ? Number(row["Age"] || row["age"]) : null,
        gender: String(row["Gender"] || row["gender"] || "").trim() || null,
        jamaat: String(row["Jamaat"] || row["jamaat"] || row["JAMAAT"] || "").trim() || null,
        mobile: String(row["Mobile"] || row["mobile"] || row["MOBILE"] || "").trim() || null,
        email: String(row["Email"] || row["email"] || row["EMAIL"] || "").trim() || null,
      })).filter((b) => b.its_id && b.full_name);

      // Delete existing and insert new
      await supabase.from("beneficiaries").delete().neq("its_id", "");
      
      // Insert in batches
      const batchSize = 500;
      for (let i = 0; i < beneficiaries.length; i += batchSize) {
        const batch = beneficiaries.slice(i, i + batchSize);
        const { error } = await supabase.from("beneficiaries").insert(batch);
        if (error) throw error;
      }

      toast.success(`Imported ${beneficiaries.length} beneficiaries`);
      fetchStats();
    } catch (err) {
      console.error(err);
      toast.error("Failed to import beneficiaries");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleStudentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const students = rows.map((row) => ({
        tr_number: String(row["TR NUMBER"] || row["TR_Number"] || row["tr_number"] || "").trim(),
        its_id: String(row["ITS NUMBER"] || row["ITS_ID"] || row["its_id"] || "").trim(),
        name: String(row["NAME"] || row["Name"] || row["name"] || "").trim(),
        branch: String(row["BRANCH"] || row["Branch"] || row["branch"] || "").trim() || null,
        email: String(row["EMAIL"] || row["Email"] || row["email"] || "").trim() || null,
      })).filter((s) => s.tr_number && s.its_id && s.name);

      // Delete existing and insert new
      await supabase.from("students").delete().neq("tr_number", "");

      const { error } = await supabase.from("students").insert(students);
      if (error) throw error;

      toast.success(`Imported ${students.length} students`);
      fetchStats();
      fetchStudentProgress();
    } catch (err) {
      console.error(err);
      toast.error("Failed to import students");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const autoAssign = async () => {
    setLoading(true);
    try {
      // Clear existing assignments
      await supabase.from("assignments").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      // Fetch all active students and beneficiaries
      const [studentsRes, beneficiariesRes] = await Promise.all([
        supabase.from("students").select("tr_number").eq("is_active", true),
        supabase.from("beneficiaries").select("its_id"),
      ]);

      const students = studentsRes.data || [];
      const beneficiaries = beneficiariesRes.data || [];

      if (students.length === 0 || beneficiaries.length === 0) {
        toast.error("No students or beneficiaries to assign");
        return;
      }

      // Distribute beneficiaries among students
      const assignments = beneficiaries.map((beneficiary, index) => ({
        beneficiary_its_id: beneficiary.its_id,
        student_tr_number: students[index % students.length].tr_number,
      }));

      // Insert in batches
      const batchSize = 500;
      for (let i = 0; i < assignments.length; i += batchSize) {
        const batch = assignments.slice(i, i + batchSize);
        const { error } = await supabase.from("assignments").insert(batch);
        if (error) throw error;
      }

      toast.success(`Created ${assignments.length} assignments (~${Math.ceil(beneficiaries.length / students.length)} per student)`);
      fetchStats();
      fetchStudentProgress();
    } catch (err) {
      console.error(err);
      toast.error("Failed to auto-assign");
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    const headers = "TR Number,Name,Branch,Assigned,Completed,Pending,Progress %\n";
    const rows = studentProgress
      .map(
        (s) =>
          `${s.tr_number},${s.name},${s.branch},${s.assigned},${s.completed},${s.assigned - s.completed},${s.assigned > 0 ? Math.round((s.completed / s.assigned) * 100) : 0}`
      )
      .join("\n");
    const csv = headers + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ziyarat-report-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  const filteredProgress = studentProgress.filter((s) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(query) ||
      s.tr_number.toLowerCase().includes(query) ||
      s.branch.toLowerCase().includes(query)
    );
  });

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="card-elevated p-8 w-full max-w-sm">
          <h1 className="text-2xl font-serif mb-6 text-center">Admin Access</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-4"
          >
            <Input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-center"
            />
            <Button type="submit" className="w-full">
              Access Dashboard
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="app-header py-4 px-4">
        <div className="container max-w-6xl mx-auto">
          <h1 className="font-serif text-2xl">Admin Dashboard</h1>
          <p className="text-primary-foreground/70 text-sm">
            Rawdat Tahera Ziyarat Management
          </p>
        </div>
      </header>

      {/* Stats */}
      <div className="bg-card border-b border-border py-6 px-4">
        <div className="container max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Beneficiaries" value={stats.totalBeneficiaries} />
          <StatCard label="Students" value={stats.totalStudents} />
          <StatCard label="Assigned" value={stats.totalAssignments} />
          <StatCard
            label="Completed"
            value={stats.completedAssignments}
            highlight
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="container max-w-6xl mx-auto py-6 px-4">
        <Tabs defaultValue="data" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="data" className="gap-2">
              <Upload className="w-4 h-4" />
              Data
            </TabsTrigger>
            <TabsTrigger value="progress" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Progress
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-2">
              <Settings className="w-4 h-4" />
              Actions
            </TabsTrigger>
          </TabsList>

          {/* Data Tab */}
          <TabsContent value="data" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <UploadCard
                title="Beneficiaries (Karachi HOF)"
                description="Upload Excel file with ITS_ID, Full_Name, Age, Gender, Jamaat columns"
                onUpload={handleBeneficiaryUpload}
                loading={loading}
              />
              <UploadCard
                title="Students (Talabat)"
                description="Upload Excel file with ITS NUMBER, TR NUMBER, BRANCH, NAME, EMAIL columns"
                onUpload={handleStudentUpload}
                loading={loading}
              />
            </div>
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => { fetchStats(); fetchStudentProgress(); }}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={exportReport}>
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </div>

            <div className="card-elevated overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-3 px-4 font-medium">Student</th>
                      <th className="text-left py-3 px-4 font-medium">Branch</th>
                      <th className="text-center py-3 px-4 font-medium">Assigned</th>
                      <th className="text-center py-3 px-4 font-medium">Completed</th>
                      <th className="text-center py-3 px-4 font-medium">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProgress.map((student) => (
                      <tr key={student.tr_number} className="border-b border-border table-row-hover">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-foreground">{student.name}</p>
                            <p className="text-muted-foreground text-xs">{student.tr_number}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{student.branch}</td>
                        <td className="py-3 px-4 text-center">{student.assigned}</td>
                        <td className="py-3 px-4 text-center">{student.completed}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 progress-track">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${student.assigned > 0 ? (student.completed / student.assigned) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-10">
                              {student.assigned > 0
                                ? Math.round((student.completed / student.assigned) * 100)
                                : 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="card-elevated p-6">
                <h3 className="font-serif text-lg mb-2">Auto-Assign Beneficiaries</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Distribute all beneficiaries equally among active students.
                  This will clear existing assignments.
                </p>
                <Button onClick={autoAssign} disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Run Auto-Assign
                </Button>
              </div>

              <div className="card-elevated p-6">
                <h3 className="font-serif text-lg mb-2">Export Full Report</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Download a CSV report with all student progress data.
                </p>
                <Button variant="outline" onClick={exportReport}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Report
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="card-elevated p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-serif mt-1 ${highlight ? "text-success" : "text-foreground"}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function UploadCard({
  title,
  description,
  onUpload,
  loading,
}: {
  title: string;
  description: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
}) {
  return (
    <div className="card-elevated p-6">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-secondary">
          <Users className="w-6 h-6 text-secondary-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="font-serif text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">{description}</p>
          <label className="inline-flex">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onUpload}
              className="hidden"
              disabled={loading}
            />
            <Button variant="outline" asChild>
              <span>
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Upload File
              </span>
            </Button>
          </label>
        </div>
      </div>
    </div>
  );
}
