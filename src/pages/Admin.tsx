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
  X,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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

interface EventAnalytics {
  event_tag: string;
  total: number;
  completed: number;
  pending: number;
  completion_rate: number;
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
  const [eventAnalytics, setEventAnalytics] = useState<EventAnalytics[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [sortBy, setSortBy] = useState<"name" | "branch" | "assigned" | "completed" | "progress">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [newStudent, setNewStudent] = useState({
    tr_number: "",
    its_id: "",
    name: "",
    branch: "",
    email: "",
  });
  const [showManualAssign, setShowManualAssign] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<Array<{ tr_number: string; name: string; branch: string; available_in_mumbai: boolean }>>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [currentEventForAssign, setCurrentEventForAssign] = useState("");

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
      fetchEventAnalytics();
      fetchCurrentEventSetting();
    }
  }, [authenticated]);

  const fetchCurrentEventSetting = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "current_event_for_availability")
      .single();
    
    if (data) {
      setCurrentEventForAssign(data.setting_value || "");
    }
  };

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

  const fetchEventAnalytics = async () => {
    try {
      // Fetch ALL assignments with pagination
      const allAssignments = [];
      let offset = 0;
      const batchSize = 1000;
      
      console.log("📊 Fetching all assignments for analytics...");
      while (true) {
        const { data, error } = await supabase
          .from("assignments")
          .select("event_tag, status")
          .order('id')
          .range(offset, offset + batchSize - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allAssignments.push(...data);
        offset += batchSize;
        console.log(`📊 Loaded ${allAssignments.length} assignments...`);
      }

      console.log(`📊 Total assignments loaded: ${allAssignments.length}`);

      if (allAssignments.length === 0) {
        setEventAnalytics([]);
        return;
      }

      // Group by event_tag
      const eventMap = new Map<string, { total: number; completed: number }>();
      
      allAssignments.forEach((a) => {
        const tag = a.event_tag || "Untagged";
        if (!eventMap.has(tag)) {
          eventMap.set(tag, { total: 0, completed: 0 });
        }
        const current = eventMap.get(tag)!;
        current.total++;
        if (a.status === "completed") current.completed++;
      });

      const analytics: EventAnalytics[] = Array.from(eventMap.entries()).map(([tag, data]) => ({
        event_tag: tag,
        total: data.total,
        completed: data.completed,
        pending: data.total - data.completed,
        completion_rate: Math.round((data.completed / data.total) * 100),
      }));

      console.log("📊 Event analytics:", analytics);
      setEventAnalytics(analytics);
    } catch (err) {
      console.error("Failed to fetch event analytics", err);
    }
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

      console.log("📄 Raw Excel rows:", rows);

      const beneficiaries = rows.map((row) => {
        const itsId = String(row["ITS ID"] || row["ITS_ID"] || row["ITS NUMBER"] || row["its_id"] || "").trim();
        const fullName = String(row["Full Name"] || row["Full_Name"] || row["NAME"] || row["full_name"] || row["Name"] || "").trim();
        console.log(`🔍 Row: ITS="${itsId}" (type: ${typeof itsId}), Name="${fullName}"`);
        return {
          its_id: itsId,
          full_name: fullName,
          age: row["Age"] || row["age"] ? Number(row["Age"] || row["age"]) : null,
          gender: String(row["Gender"] || row["gender"] || "").trim() || null,
          jamaat: String(row["Jamaat"] || row["jamaat"] || row["JAMAAT"] || "").trim() || null,
          mobile: String(row["Mobile"] || row["mobile"] || row["MOBILE"] || "").trim() || null,
          email: String(row["Email"] || row["email"] || row["EMAIL"] || "").trim() || null,
        };
      }).filter((b) => b.its_id && b.full_name)
      // Remove duplicates based on ITS ID
      .filter((b, index, arr) => arr.findIndex(b2 => b2.its_id === b.its_id) === index);

      console.log("✅ Parsed beneficiaries:", beneficiaries);

      // Fetch existing ITS IDs to avoid duplicates
      const { data: existing } = await supabase.from("beneficiaries").select("its_id");
      const existingIds = new Set(existing?.map(b => b.its_id) || []);

      console.log(`💾 Database has ${existingIds.size} existing ITS IDs`);
      console.log("Sample from DB:", Array.from(existingIds).slice(0, 5));

      // Filter out existing beneficiaries
      const newBeneficiaries = beneficiaries.filter(b => {
        const exists = existingIds.has(b.its_id);
        if (exists) {
          console.log(`❌ DUPLICATE: "${b.its_id}" already exists in database`);
        } else {
          console.log(`✅ NEW: "${b.its_id}" will be inserted`);
        }
        return !exists;
      });

      console.log(`📊 Summary: ${newBeneficiaries.length} new, ${beneficiaries.length - newBeneficiaries.length} duplicates`);

      if (newBeneficiaries.length === 0) {
        toast.error(`All ${beneficiaries.length} beneficiaries already exist in the database`);
        fetchStats();
        return;
      }

      // Insert only new beneficiaries
      const batchSize = 500;
      for (let i = 0; i < newBeneficiaries.length; i += batchSize) {
        const batch = newBeneficiaries.slice(i, i + batchSize);
        const { error } = await supabase.from("beneficiaries").insert(batch);
        if (error) throw error;
      }

      toast.success(`Added ${newBeneficiaries.length} new beneficiaries (${beneficiaries.length - newBeneficiaries.length} already existed)`);
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
      })).filter((s) => s.tr_number && s.its_id && s.name)
      // Remove duplicates based on TR Number
      .filter((s, index, arr) => arr.findIndex(s2 => s2.tr_number === s.tr_number) === index);

      // Fetch existing TR Numbers to avoid duplicates
      const { data: existing } = await supabase.from("students").select("tr_number");
      const existingTrs = new Set(existing?.map(s => s.tr_number) || []);

      // Filter out existing students
      const newStudents = students.filter(s => !existingTrs.has(s.tr_number));

      if (newStudents.length === 0) {
        toast.success("All students already exist in the database");
        fetchStats();
        fetchStudentProgress();
        return;
      }

      // Insert only new students
      const { error } = await supabase.from("students").insert(newStudents);
      if (error) throw error;

      toast.success(`Added ${newStudents.length} new students (${students.length - newStudents.length} already existed)`);
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

  const handleAddStudent = async () => {
    // Validate required fields
    if (!newStudent.tr_number.trim() || !newStudent.its_id.trim() || !newStudent.name.trim()) {
      toast.error("TR Number, ITS ID, and Name are required");
      return;
    }

    setLoading(true);
    try {
      // Check if TR number or ITS ID already exists
      const { data: existingByTr } = await supabase
        .from("students")
        .select("tr_number, name")
        .eq("tr_number", newStudent.tr_number.trim())
        .maybeSingle();

      const { data: existingByIts } = await supabase
        .from("students")
        .select("its_id, name")
        .eq("its_id", newStudent.its_id.trim())
        .maybeSingle();

      if (existingByTr) {
        toast.error(`TR Number ${newStudent.tr_number} already exists for student: ${existingByTr.name}`);
        setLoading(false);
        return;
      }

      if (existingByIts) {
        toast.error(`ITS ID ${newStudent.its_id} already exists for student: ${existingByIts.name}`);
        setLoading(false);
        return;
      }

      // Insert new student
      const { error } = await supabase.from("students").insert({
        tr_number: newStudent.tr_number.trim(),
        its_id: newStudent.its_id.trim(),
        name: newStudent.name.trim(),
        branch: newStudent.branch.trim() || null,
        email: newStudent.email.trim() || null,
      });

      if (error) throw error;

      toast.success(`Added student: ${newStudent.name}`);
      
      // Reset form
      setNewStudent({
        tr_number: "",
        its_id: "",
        name: "",
        branch: "",
        email: "",
      });

      fetchStats();
      fetchStudentProgress();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add student");
    } finally {
      setLoading(false);
    }
  };

  const autoAssign = async () => {
    // Prompt for event tag
    const eventTag = prompt("Enter event name/tag for this assignment batch (e.g., 'Zikra1447'):");
    if (!eventTag || !eventTag.trim()) {
      toast.error("Event tag is required");
      return;
    }

    setLoading(true);
    try {
      console.log("🚀 Starting auto-assign...");
      
      // Fetch all active students
      const { data: students, error: studError } = await supabase
        .from("students")
        .select("tr_number")
        .eq("is_active", true);
      
      if (studError) throw studError;

      if (!students || students.length === 0) {
        toast.error("No active students available");
        setLoading(false);
        return;
      }
      console.log(`👥 Found ${students.length} active students`);

      // Fetch ALL beneficiaries with pagination
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

      // Create a Set of assigned ITS IDs for fast lookup
      const assignedSet = new Set(allAssignments.map(a => a.beneficiary_its_id));
      
      // Filter to get only unassigned beneficiaries
      const unassignedBeneficiaries = allBeneficiaries.filter(b => !assignedSet.has(b.its_id));
      
      console.log(`👤 Total beneficiaries: ${allBeneficiaries.length}`);
      console.log(`📋 Already assigned: ${assignedSet.size}`);
      console.log(`✅ Unassigned beneficiaries: ${unassignedBeneficiaries.length}`);

      if (unassignedBeneficiaries.length === 0) {
        toast.success("All beneficiaries are already assigned");
        setLoading(false);
        return;
      }

      // Distribute unassigned beneficiaries evenly among students
      const newAssignments = unassignedBeneficiaries.map((beneficiary, index) => ({
        beneficiary_its_id: beneficiary.its_id,
        student_tr_number: students[index % students.length].tr_number,
        event_tag: eventTag.trim(),
      }));

      console.log(`📦 Inserting ${newAssignments.length} new assignments...`);

      // Insert in batches
      const insertBatchSize = 500;
      for (let i = 0; i < newAssignments.length; i += insertBatchSize) {
        const batch = newAssignments.slice(i, i + insertBatchSize);
        const { error } = await supabase.from("assignments").insert(batch);
        if (error) {
          console.error(`❌ Error at batch ${i}:`, error);
          throw error;
        }
        console.log(`✅ Inserted batch ${Math.floor(i / insertBatchSize) + 1}/${Math.ceil(newAssignments.length / insertBatchSize)}`);
      }

      console.log(`✅ Successfully assigned ${newAssignments.length} beneficiaries`);
      toast.success(`Assigned ${newAssignments.length} new beneficiaries for "${eventTag}" (~${Math.ceil(unassignedBeneficiaries.length / students.length)} per student)`);
      fetchStats();
      fetchStudentProgress();
      fetchEventAnalytics();
    } catch (err) {
      console.error("❌ Auto-assign error:", err);
      toast.error(`Failed to auto-assign: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsForManualAssign = async () => {
    setLoading(true);
    try {
      // Fetch current event setting
      const { data: eventData } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "current_event_for_availability")
        .single();
      
      if (eventData) {
        setCurrentEventForAssign(eventData.setting_value || "");
      }

      // Fetch all active students with availability status
      const { data: students, error } = await supabase
        .from("students")
        .select("tr_number, name, branch, available_in_mumbai")
        .eq("is_active", true)
        .order("available_in_mumbai", { ascending: false })
        .order("name");
      
      if (error) throw error;
      
      setAvailableStudents(students || []);
      setShowManualAssign(true);
      
      // Auto-select all available students
      const availableTrNumbers = students
        ?.filter(s => s.available_in_mumbai)
        .map(s => s.tr_number) || [];
      setSelectedStudents(new Set(availableTrNumbers));
      
    } catch (err) {
      console.error(err);
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const toggleStudentSelection = (trNumber: string) => {
    const newSelection = new Set(selectedStudents);
    if (newSelection.has(trNumber)) {
      newSelection.delete(trNumber);
    } else {
      newSelection.add(trNumber);
    }
    setSelectedStudents(newSelection);
  };

  const selectAllAvailable = () => {
    const availableTrNumbers = availableStudents
      .filter(s => s.available_in_mumbai)
      .map(s => s.tr_number);
    setSelectedStudents(new Set(availableTrNumbers));
  };

  const selectAll = () => {
    const allTrNumbers = availableStudents.map(s => s.tr_number);
    setSelectedStudents(new Set(allTrNumbers));
  };

  const deselectAll = () => {
    setSelectedStudents(new Set());
  };

  const manualAssign = async () => {
    if (selectedStudents.size === 0) {
      toast.error("Please select at least one student");
      return;
    }

    // Prompt for event tag
    const eventTag = prompt("Enter event name/tag for this assignment batch (e.g., 'Zikra1447'):", currentEventForAssign);
    if (!eventTag || !eventTag.trim()) {
      toast.error("Event tag is required");
      return;
    }

    setLoading(true);
    try {
      console.log("🚀 Starting manual assign...");
      console.log(`👥 Selected ${selectedStudents.size} students`);

      const selectedStudentsList = Array.from(selectedStudents);

      // Fetch ALL beneficiaries with pagination
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

      // Create a Set of assigned ITS IDs for fast lookup
      const assignedSet = new Set(allAssignments.map(a => a.beneficiary_its_id));
      
      // Filter to get only unassigned beneficiaries
      const unassignedBeneficiaries = allBeneficiaries.filter(b => !assignedSet.has(b.its_id));
      
      console.log(`👤 Total beneficiaries: ${allBeneficiaries.length}`);
      console.log(`📋 Already assigned: ${assignedSet.size}`);
      console.log(`✅ Unassigned beneficiaries: ${unassignedBeneficiaries.length}`);

      if (unassignedBeneficiaries.length === 0) {
        toast.success("All beneficiaries are already assigned");
        setLoading(false);
        return;
      }

      // Distribute unassigned beneficiaries evenly among SELECTED students
      const newAssignments = unassignedBeneficiaries.map((beneficiary, index) => ({
        beneficiary_its_id: beneficiary.its_id,
        student_tr_number: selectedStudentsList[index % selectedStudentsList.length],
        event_tag: eventTag.trim(),
      }));

      console.log(`📦 Inserting ${newAssignments.length} new assignments...`);

      // Insert in batches
      const insertBatchSize = 500;
      for (let i = 0; i < newAssignments.length; i += insertBatchSize) {
        const batch = newAssignments.slice(i, i + insertBatchSize);
        const { error } = await supabase.from("assignments").insert(batch);
        if (error) {
          console.error(`❌ Error at batch ${i}:`, error);
          throw error;
        }
        console.log(`✅ Inserted batch ${Math.floor(i / insertBatchSize) + 1}/${Math.ceil(newAssignments.length / insertBatchSize)}`);
      }

      console.log(`✅ Successfully assigned ${newAssignments.length} beneficiaries to ${selectedStudents.size} students`);
      toast.success(`Assigned ${newAssignments.length} new beneficiaries for "${eventTag}" to ${selectedStudents.size} students (~${Math.ceil(unassignedBeneficiaries.length / selectedStudents.size)} per student)`);
      
      setShowManualAssign(false);
      setSelectedStudents(new Set());
      fetchStats();
      fetchStudentProgress();
      fetchEventAnalytics();
    } catch (err) {
      console.error("❌ Manual-assign error:", err);
      toast.error(`Failed to manually assign: ${err instanceof Error ? err.message : 'Unknown error'}`);
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

  const handleSort = (column: "name" | "branch" | "assigned" | "completed" | "progress") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const filteredProgress = studentProgress
    .filter((s) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(query) ||
        s.tr_number.toLowerCase().includes(query) ||
        s.branch.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "branch":
          aValue = a.branch.toLowerCase();
          bValue = b.branch.toLowerCase();
          break;
        case "assigned":
          aValue = a.assigned;
          bValue = b.assigned;
          break;
        case "completed":
          aValue = a.completed;
          bValue = b.completed;
          break;
        case "progress":
          aValue = a.assigned > 0 ? (a.completed / a.assigned) * 100 : 0;
          bValue = b.assigned > 0 ? (b.completed / b.assigned) * 100 : 0;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
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
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="data" className="gap-2">
              <Upload className="w-4 h-4" />
              Data
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="progress" className="gap-2">
              <Users className="w-4 h-4" />
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

            {/* Manual Student Entry */}
            <div className="card-elevated p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-serif text-lg">Add Student Manually</h3>
                  <p className="text-sm text-muted-foreground">
                    Quick add individual students without Excel import
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    TR Number <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="e.g., 25687"
                    value={newStudent.tr_number}
                    onChange={(e) => setNewStudent({ ...newStudent, tr_number: e.target.value })}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    ITS Number <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="e.g., 40401849"
                    value={newStudent.its_id}
                    onChange={(e) => setNewStudent({ ...newStudent, its_id: e.target.value })}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="Full name"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    Branch
                  </label>
                  <select
                    value={newStudent.branch}
                    onChange={(e) => setNewStudent({ ...newStudent, branch: e.target.value })}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                  >
                    <option value="">Select branch...</option>
                    <option value="Marol">MAROL</option>
                    <option value="SURAT">SURAT</option>
                    <option value="NAIROBI">NAIROBI</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="25687@jameasaifiyah.edu"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <Button onClick={handleAddStudent} disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Users className="w-4 h-4 mr-2" />
                  )}
                  Add Student
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    setNewStudent({
                      tr_number: "",
                      its_id: "",
                      name: "",
                      branch: "",
                      email: "",
                    })
                  }
                  disabled={loading}
                >
                  Clear Form
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {eventAnalytics.length === 0 ? (
              <div className="card-elevated p-6">
                <h3 className="font-serif text-xl mb-4">Event-wise Progress</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  View completion statistics by event tags
                </p>
                <div className="text-center py-12 text-muted-foreground">
                  No assignment data available yet.
                  <br />
                  <span className="text-xs mt-2 block">
                    Upload beneficiaries and students, then use Auto-Assign to create assignments.
                  </span>
                </div>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid md:grid-cols-3 gap-4">
                  {eventAnalytics.map((event) => (
                    <div key={event.event_tag} className="card-elevated p-4">
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">{event.event_tag}</h4>
                      <p className="text-2xl font-serif text-foreground">{event.completion_rate}%</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {event.completed} / {event.total} completed
                      </p>
                    </div>
                  ))}
                </div>

                {/* Bar Chart */}
                <div className="card-elevated p-6">
                  <h3 className="font-serif text-lg mb-4">Completion Overview</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={eventAnalytics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="event_tag" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="completed" fill="#22c55e" name="Completed" />
                      <Bar dataKey="pending" fill="#ef4444" name="Pending" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Pie Chart */}
                <div className="card-elevated p-6">
                  <h3 className="font-serif text-lg mb-4">Distribution by Event</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={eventAnalytics}
                        dataKey="total"
                        nameKey="event_tag"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry.event_tag}: ${entry.total}`}
                      >
                        {eventAnalytics.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
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
                      <th 
                        className="text-left py-3 px-4 font-medium cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-2">
                          Student
                          {sortBy === "name" && (
                            <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="text-left py-3 px-4 font-medium cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => handleSort("branch")}
                      >
                        <div className="flex items-center gap-2">
                          Branch
                          {sortBy === "branch" && (
                            <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="text-center py-3 px-4 font-medium cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => handleSort("assigned")}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Assigned
                          {sortBy === "assigned" && (
                            <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="text-center py-3 px-4 font-medium cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => handleSort("completed")}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Completed
                          {sortBy === "completed" && (
                            <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="text-center py-3 px-4 font-medium cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => handleSort("progress")}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Progress
                          {sortBy === "progress" && (
                            <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
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
            {/* Manual Assignment Modal/Section */}
            {showManualAssign && (
              <div className="card-elevated p-6 border-2 border-primary">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-serif text-xl mb-1">Manual Student Selection</h3>
                    <p className="text-sm text-muted-foreground">
                      Select students for assignment • Event: <span className="font-medium">{currentEventForAssign}</span>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowManualAssign(false);
                      setSelectedStudents(new Set());
                    }}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {/* Selection Controls */}
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAllAvailable}
                    className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                  >
                    Select All Available ({availableStudents.filter(s => s.available_in_mumbai).length})
                  </Button>
                  <Button size="sm" variant="outline" onClick={selectAll}>
                    Select All ({availableStudents.length})
                  </Button>
                  <Button size="sm" variant="outline" onClick={deselectAll}>
                    Deselect All
                  </Button>
                  <div className="ml-auto text-sm font-medium">
                    Selected: {selectedStudents.size} students
                  </div>
                </div>

                {/* Students List */}
                <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                  {/* Available Students - Green Section */}
                  {availableStudents.filter(s => s.available_in_mumbai).length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <h4 className="font-medium text-sm text-green-600 dark:text-green-400">
                          Available in Mumbai ({availableStudents.filter(s => s.available_in_mumbai).length})
                        </h4>
                      </div>
                      {availableStudents
                        .filter(s => s.available_in_mumbai)
                        .map((student) => (
                          <label
                            key={student.tr_number}
                            className="flex items-center gap-3 p-3 rounded-lg border-2 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 cursor-pointer hover:bg-green-100 dark:hover:bg-green-950/40 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedStudents.has(student.tr_number)}
                              onChange={() => toggleStudentSelection(student.tr_number)}
                              className="w-5 h-5 rounded border-gray-300"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{student.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {student.tr_number} • {student.branch || "No branch"}
                              </p>
                            </div>
                            <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-700 dark:text-green-300 font-medium">
                              Available
                            </span>
                          </label>
                        ))}
                    </div>
                  )}

                  {/* Other Students */}
                  {availableStudents.filter(s => !s.available_in_mumbai).length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-2">
                        <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                        <h4 className="font-medium text-sm text-muted-foreground">
                          Other Students ({availableStudents.filter(s => !s.available_in_mumbai).length})
                        </h4>
                      </div>
                      {availableStudents
                        .filter(s => !s.available_in_mumbai)
                        .map((student) => (
                          <label
                            key={student.tr_number}
                            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedStudents.has(student.tr_number)}
                              onChange={() => toggleStudentSelection(student.tr_number)}
                              className="w-5 h-5 rounded border-gray-300"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{student.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {student.tr_number} • {student.branch || "No branch"}
                              </p>
                            </div>
                          </label>
                        ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  <Button
                    onClick={manualAssign}
                    disabled={loading || selectedStudents.size === 0}
                    className="flex-1"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    Assign to {selectedStudents.size} Selected Student{selectedStudents.size !== 1 ? 's' : ''}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowManualAssign(false);
                      setSelectedStudents(new Set());
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-6">
              {/* Manual Assign Card */}
              <div className="card-elevated p-6 border-2 border-primary">
                <h3 className="font-serif text-lg mb-2 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Manual Assignment
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Select specific students who are available in Mumbai for targeted assignment of unassigned beneficiaries.
                </p>
                <Button
                  onClick={fetchStudentsForManualAssign}
                  disabled={loading || stats.totalAssignments >= stats.totalBeneficiaries}
                  className="w-full"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Users className="w-4 h-4 mr-2" />
                  )}
                  Select Students
                </Button>
              </div>

              <div className="card-elevated p-6">
                <h3 className="font-serif text-lg mb-2">Auto-Assign Beneficiaries</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Assign unassigned beneficiaries equally among active students.
                  Button is disabled when all beneficiaries are already assigned.
                </p>
                <Button onClick={autoAssign} disabled={loading || stats.totalAssignments >= stats.totalBeneficiaries}>
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

              <div className="card-elevated p-6">
                <h3 className="font-serif text-lg mb-2">Delete Beneficiaries by Event</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Permanently delete beneficiaries and assignments for a specific event.
                </p>
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="w-full mb-3 px-3 py-2 border border-input rounded-md bg-background text-sm"
                  disabled={loading || eventAnalytics.length === 0}
                >
                  <option value="">Select an event...</option>
                  {eventAnalytics.map((event) => (
                    <option key={event.event_tag} value={event.event_tag}>
                      {event.event_tag} ({event.total} beneficiaries)
                    </option>
                  ))}
                </select>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    if (!selectedEvent) {
                      toast.error("Please select an event");
                      return;
                    }
                    if (confirm(`⚠️ PERMANENTLY DELETE all beneficiaries for "${selectedEvent}"?\n\nThis will delete:\n- ${eventAnalytics.find(e => e.event_tag === selectedEvent)?.total || 0} beneficiaries\n- All their assignments\n\nThis action CANNOT be undone!`)) {
                      setLoading(true);
                      try {
                        // First, get all beneficiary ITS IDs for this event
                        const { data: assignments, error: fetchError } = await supabase
                          .from("assignments")
                          .select("beneficiary_its_id")
                          .eq("event_tag", selectedEvent);
                        
                        if (fetchError) throw fetchError;
                        
                        const beneficiaryIds = assignments?.map(a => a.beneficiary_its_id) || [];
                        
                        if (beneficiaryIds.length === 0) {
                          toast.error("No beneficiaries found for this event");
                          setLoading(false);
                          return;
                        }

                        console.log(`🗑️ Deleting ${beneficiaryIds.length} beneficiaries for "${selectedEvent}"`);

                        // Delete assignments first (foreign key constraint)
                        const { error: assignError } = await supabase
                          .from("assignments")
                          .delete()
                          .eq("event_tag", selectedEvent);
                        
                        if (assignError) throw assignError;

                        // Then delete beneficiaries in batches
                        const batchSize = 500;
                        for (let i = 0; i < beneficiaryIds.length; i += batchSize) {
                          const batch = beneficiaryIds.slice(i, i + batchSize);
                          const { error } = await supabase
                            .from("beneficiaries")
                            .delete()
                            .in("its_id", batch);
                          if (error) throw error;
                        }

                        toast.success(`Deleted ${beneficiaryIds.length} beneficiaries for "${selectedEvent}"`);
                        setSelectedEvent("");
                        fetchStats();
                        fetchStudentProgress();
                        fetchEventAnalytics();
                      } catch (err) {
                        console.error(err);
                        toast.error("Failed to delete beneficiaries");
                      } finally {
                        setLoading(false);
                      }
                    }
                  }}
                  disabled={loading || !selectedEvent}
                >
                  Delete Beneficiaries & Assignments
                </Button>
              </div>

              {/* Update Current Event Setting */}
              <div className="card-elevated p-6">
                <h3 className="font-serif text-lg mb-2">Set Current Event</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Update the event name shown to students for availability check.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Urus Mubarak 1449"
                    value={currentEventForAssign}
                    onChange={(e) => setCurrentEventForAssign(e.target.value)}
                    disabled={loading}
                  />
                  <Button
                    onClick={async () => {
                      if (!currentEventForAssign.trim()) {
                        toast.error("Event name cannot be empty");
                        return;
                      }
                      setLoading(true);
                      try {
                        const { error } = await supabase
                          .from("app_settings")
                          .upsert({
                            setting_key: "current_event_for_availability",
                            setting_value: currentEventForAssign.trim(),
                            updated_at: new Date().toISOString(),
                          }, {
                            onConflict: 'setting_key'
                          });
                        if (error) throw error;
                        toast.success("Event name updated");
                      } catch (err) {
                        console.error(err);
                        toast.error("Failed to update event");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    Update
                  </Button>
                </div>
              </div>

              <div className="card-elevated p-6">
                <h3 className="font-serif text-lg mb-2">Refresh Stats</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Manually refresh the dashboard stats and clear cache.
                </p>
                <Button variant="outline" onClick={() => {
                  fetchStats();
                  fetchStudentProgress();
                  toast.success("Stats refreshed");
                }} disabled={loading}>
                  Refresh Now
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
