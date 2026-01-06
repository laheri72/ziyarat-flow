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
  Check,
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
  available_in_mumbai: boolean;
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
  const [selectedEventForUnassign, setSelectedEventForUnassign] = useState<string>("");
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
  const [existingEventTags, setExistingEventTags] = useState<string[]>([]);
  const [selectedEventTag, setSelectedEventTag] = useState("");
  const [beneficiaryCap, setBeneficiaryCap] = useState<string>("");
  const [selectedStudentForUnassign, setSelectedStudentForUnassign] = useState<string>("");
  const [whatsappTemplate, setWhatsappTemplate] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [unassignmentRequests, setUnassignmentRequests] = useState<Array<{
    id: string;
    student_tr_number: string;
    student_name: string;
    event_tag: string;
    reason: string;
    created_at: string;
    pending_count: number;
  }>>([]);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [assignmentRequests, setAssignmentRequests] = useState<Array<{
    id: string;
    student_tr_number: string;
    student_name: string;
    event_tag: string;
    reason: string;
    created_at: string;
    current_assignments: number;
  }>>([]);

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
      fetchMessageTemplates();
      fetchUnassignmentRequests();
      fetchAssignmentRequests();

      // Real-time subscription for assignment requests
      const assignmentRequestsChannel = supabase
        .channel("assignment_requests_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "assignment_requests",
          },
          (payload) => {
            console.log("🔔 Assignment request change detected:", payload);
            
            // Handle DELETE events immediately by removing from state
            if (payload.eventType === "DELETE" && payload.old?.id) {
              console.log("🗑️ Request deleted, removing from UI:", payload.old.id);
              setAssignmentRequests(prev => prev.filter(req => req.id !== payload.old.id));
              return;
            }
            
            // For INSERT and UPDATE, refresh the list
            console.log("🔄 Refreshing assignment requests...");
            fetchAssignmentRequests();
          }
        )
        .subscribe();

      // Real-time subscription for unassignment requests
      const unassignmentRequestsChannel = supabase
        .channel("unassignment_requests_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "unassignment_requests",
          },
          (payload) => {
            console.log("🔔 Unassignment request change detected:", payload);
            
            // Handle DELETE events immediately by removing from state
            if (payload.eventType === "DELETE" && payload.old?.id) {
              console.log("🗑️ Unassignment request deleted, removing from UI:", payload.old.id);
              setUnassignmentRequests(prev => prev.filter(req => req.id !== payload.old.id));
              return;
            }
            
            // For INSERT and UPDATE, refresh the list
            console.log("🔄 Refreshing unassignment requests...");
            fetchUnassignmentRequests();
          }
        )
        .subscribe();

      // Cleanup subscriptions on unmount
      return () => {
        supabase.removeChannel(assignmentRequestsChannel);
        supabase.removeChannel(unassignmentRequestsChannel);
      };
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
      .select("tr_number, name, branch, available_in_mumbai")
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
        available_in_mumbai: student.available_in_mumbai || false,
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

      // Fetch existing event tags from assignments
      const { data: eventTagsData, error: eventTagsError } = await supabase
        .from("assignments")
        .select("event_tag")
        .not("event_tag", "is", null);

      if (eventTagsError) throw eventTagsError;
      
      // Get unique event tags and sort them
      const uniqueTags = [...new Set(eventTagsData?.map(a => a.event_tag) || [])];
      setExistingEventTags(uniqueTags.sort());
      
      // Set default selection to current event if it exists in the list
      if (eventData?.setting_value && uniqueTags.includes(eventData.setting_value)) {
        setSelectedEventTag(eventData.setting_value);
      } else if (uniqueTags.length > 0) {
        setSelectedEventTag(uniqueTags[0]);
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

    // Use selected event tag from dropdown
    if (!selectedEventTag || !selectedEventTag.trim()) {
      toast.error("Please select an event tag");
      return;
    }
    const eventTag = selectedEventTag;

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
      let unassignedBeneficiaries = allBeneficiaries.filter(b => !assignedSet.has(b.its_id));
      
      console.log(`👤 Total beneficiaries: ${allBeneficiaries.length}`);
      console.log(`📋 Already assigned: ${assignedSet.size}`);
      console.log(`✅ Unassigned beneficiaries: ${unassignedBeneficiaries.length}`);

      if (unassignedBeneficiaries.length === 0) {
        toast.success("All beneficiaries are already assigned");
        setLoading(false);
        return;
      }

      // Apply beneficiary cap if specified
      const cap = beneficiaryCap.trim() ? parseInt(beneficiaryCap.trim()) : unassignedBeneficiaries.length;
      
      // Validate cap
      if (cap > unassignedBeneficiaries.length) {
        toast.error(`Cap (${cap}) exceeds available unassigned beneficiaries (${unassignedBeneficiaries.length})`);
        setLoading(false);
        return;
      }
      
      if (cap <= 0) {
        toast.error("Cap must be a positive number");
        setLoading(false);
        return;
      }
      
      if (cap < unassignedBeneficiaries.length) {
        unassignedBeneficiaries = unassignedBeneficiaries.slice(0, cap);
        console.log(`📊 Applied cap: assigning ${cap} beneficiaries`);
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

  const unassignPending = async () => {
    if (!selectedEventForUnassign) {
      toast.error("Please select an event");
      return;
    }

    const eventData = eventAnalytics.find(e => e.event_tag === selectedEventForUnassign);
    if (!eventData || eventData.pending === 0) {
      toast.error("No pending assignments found for this event");
      return;
    }

    if (!confirm(`⚠️ Unassign ${eventData.pending} PENDING assignments from "${selectedEventForUnassign}"?\n\nThis will:\n- Remove ${eventData.pending} incomplete assignments\n- Keep ${eventData.completed} completed assignments\n- Make these beneficiaries available for reassignment\n\nContinue?`)) {
      return;
    }

    setLoading(true);
    try {
      console.log(`🔄 Unassigning pending assignments for "${selectedEventForUnassign}"...`);

      // Delete only pending assignments for this event
      const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("event_tag", selectedEventForUnassign)
        .eq("status", "pending");

      if (error) throw error;

      toast.success(`Unassigned ${eventData.pending} pending assignments from "${selectedEventForUnassign}". These beneficiaries can now be reassigned using Manual Assignment.`);
      setSelectedEventForUnassign("");
      fetchStats();
      fetchStudentProgress();
      fetchEventAnalytics();
    } catch (err) {
      console.error("❌ Unassign error:", err);
      toast.error(`Failed to unassign: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const unassignByStudent = async () => {
    if (!selectedStudentForUnassign) {
      toast.error("Please select a student");
      return;
    }

    setLoading(true);
    try {
      // Get student's pending assignments count
      const { count: pendingCount, error: countError } = await supabase
        .from("assignments")
        .select("id", { count: "exact", head: true })
        .eq("student_tr_number", selectedStudentForUnassign)
        .eq("status", "pending");

      if (countError) throw countError;

      if (pendingCount === 0) {
        toast.error("This student has no pending assignments");
        setLoading(false);
        return;
      }

      const studentInfo = studentProgress.find(s => s.tr_number === selectedStudentForUnassign);
      const studentName = studentInfo?.name || selectedStudentForUnassign;

      if (!confirm(`⚠️ Unassign ${pendingCount} PENDING assignments from ${studentName}?\n\nTR: ${selectedStudentForUnassign}\n\nThis will:\n- Remove ${pendingCount} incomplete assignments\n- Keep completed assignments\n- Make these beneficiaries available for reassignment\n\nContinue?`)) {
        setLoading(false);
        return;
      }

      console.log(`🔄 Unassigning pending assignments for student ${selectedStudentForUnassign}...`);

      // Delete only pending assignments for this student
      const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("student_tr_number", selectedStudentForUnassign)
        .eq("status", "pending");

      if (error) throw error;

      toast.success(`Unassigned ${pendingCount} pending assignments from ${studentName}. These beneficiaries can now be reassigned.`);
      setSelectedStudentForUnassign("");
      fetchStats();
      fetchStudentProgress();
      fetchEventAnalytics();
    } catch (err) {
      console.error("❌ Unassign by student error:", err);
      toast.error(`Failed to unassign: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const saveMessageTemplates = async () => {
    setSavingTemplates(true);
    try {
      await Promise.all([
        supabase.from("app_settings").upsert({
          setting_key: "whatsapp_message_template",
          setting_value: whatsappTemplate,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'setting_key' }),
        supabase.from("app_settings").upsert({
          setting_key: "email_message_subject",
          setting_value: emailSubject,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'setting_key' }),
        supabase.from("app_settings").upsert({
          setting_key: "email_message_body",
          setting_value: emailBody,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'setting_key' }),
      ]);
      toast.success("Message templates updated successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save templates");
    } finally {
      setSavingTemplates(false);
    }
  };

  const fetchUnassignmentRequests = async () => {
    try {
      const { data: requests, error } = await supabase
        .from("unassignment_requests")
        .select("id, student_tr_number, event_tag, reason, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!requests || requests.length === 0) {
        setUnassignmentRequests([]);
        return;
      }

      // Fetch student names and pending counts
      const enrichedRequests = await Promise.all(
        requests.map(async (req) => {
          const [studentData, pendingCount] = await Promise.all([
            supabase.from("students").select("name").eq("tr_number", req.student_tr_number).single(),
            supabase.from("assignments").select("id", { count: "exact", head: true })
              .eq("student_tr_number", req.student_tr_number)
              .eq("status", "pending"),
          ]);

          return {
            ...req,
            student_name: studentData.data?.name || req.student_tr_number,
            pending_count: pendingCount.count || 0,
          };
        })
      );

      // Filter out requests with 0 pending assignments
      setUnassignmentRequests(enrichedRequests.filter(r => r.pending_count > 0));
    } catch (err) {
      console.error("Failed to fetch unassignment requests", err);
    }
  };

  const approveUnassignmentRequest = async (requestId: string, studentTr: string, eventTag: string) => {
    setProcessingRequest(requestId);
    try {
      // Delete pending assignments for this student
      const { error: deleteError } = await supabase
        .from("assignments")
        .delete()
        .eq("student_tr_number", studentTr)
        .eq("status", "pending");

      if (deleteError) throw deleteError;

      // Update request status
      const { error: updateError } = await supabase
        .from("unassignment_requests")
        .update({
          status: "approved",
          processed_at: new Date().toISOString(),
          processed_by: "admin",
        })
        .eq("id", requestId);

      if (updateError) throw updateError;

      toast.success("Request approved and assignments unassigned");
      fetchUnassignmentRequests();
      fetchStats();
      fetchStudentProgress();
      fetchEventAnalytics();
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve request");
    } finally {
      setProcessingRequest(null);
    }
  };

  const rejectUnassignmentRequest = async (requestId: string) => {
    setProcessingRequest(requestId);
    try {
      const { error } = await supabase
        .from("unassignment_requests")
        .update({
          status: "rejected",
          processed_at: new Date().toISOString(),
          processed_by: "admin",
        })
        .eq("id", requestId);

      if (error) throw error;

      // Immediately remove from state for instant UI update
      setUnassignmentRequests(prev => prev.filter(req => req.id !== requestId));
      toast.success("Request rejected");
    } catch (err) {
      console.error(err);
      toast.error("Failed to reject request");
      // Refetch on error to ensure consistency
      fetchUnassignmentRequests();
    } finally {
      setProcessingRequest(null);
    }
  };

  const fetchAssignmentRequests = async () => {
    try {
      console.log("📥 Fetching assignment requests from database...");
      
      const { data: requests, error } = await supabase
        .from("assignment_requests")
        .select("id, student_tr_number, event_tag, reason, created_at, status")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      console.log(`📊 Found ${requests?.length || 0} pending requests in database:`, requests);

      if (!requests || requests.length === 0) {
        setAssignmentRequests([]);
        return;
      }

      // Fetch student names and current assignment counts
      const enrichedRequests = await Promise.all(
        requests.map(async (req) => {
          const [studentData, assignmentCount] = await Promise.all([
            supabase.from("students").select("name").eq("tr_number", req.student_tr_number).single(),
            supabase.from("assignments").select("id", { count: "exact", head: true })
              .eq("student_tr_number", req.student_tr_number),
          ]);

          return {
            ...req,
            student_name: studentData.data?.name || req.student_tr_number,
            current_assignments: assignmentCount.count || 0,
          };
        })
      );

      console.log("📋 Enriched requests:", enrichedRequests);

      // Filter to only show requests from students with 0 assignments
      // If they have assignments now, it means request was fulfilled
      const activeRequests = enrichedRequests.filter(r => r.current_assignments === 0);
      
      console.log(`✅ Active requests (0 assignments): ${activeRequests.length}`, activeRequests);
      
      // Auto-approve fulfilled requests (students who now have assignments)
      const fulfilledRequests = enrichedRequests.filter(r => r.current_assignments > 0);
      if (fulfilledRequests.length > 0) {
        console.log(`🎯 Auto-approving ${fulfilledRequests.length} fulfilled requests`);
        await Promise.all(
          fulfilledRequests.map(req =>
            supabase
              .from("assignment_requests")
              .update({
                status: "approved",
                processed_at: new Date().toISOString(),
                processed_by: "auto",
              })
              .eq("id", req.id)
          )
        );
      }

      setAssignmentRequests(activeRequests);
    } catch (err) {
      console.error("Failed to fetch assignment requests", err);
    }
  };

  const revertAssignmentRequest = async (requestId: string) => {
    const requestToReject = assignmentRequests.find(r => r.id === requestId);
    
    if (!requestToReject) {
      toast.error("Request not found");
      return;
    }

    if (!confirm(`Delete assignment request from ${requestToReject.student_name}?\n\nThis will permanently remove the request.`)) {
      return;
    }

    setProcessingRequest(requestId);
    
    // Always remove from UI first (optimistic update)
    setAssignmentRequests(prev => prev.filter(req => req.id !== requestId));
    
    try {
      console.log("🗑️ Force deleting assignment request:", { requestId, student: requestToReject.student_name });
      
      // Attempt to delete from database
      const { data, error } = await supabase
        .from("assignment_requests")
        .delete()
        .eq("id", requestId)
        .select();

      console.log("✅ Delete result:", { data, error, deletedCount: data?.length });

      if (error) {
        console.error("❌ Delete failed:", error);
        // Don't throw - UI already cleared, just log it
      }

      if (!data || data.length === 0) {
        console.warn("⚠️ No rows deleted - request was already removed from database");
      }

      toast.success(`Request cleared from view`);
    } catch (err) {
      console.error("❌ Deletion error:", err);
      // UI already cleared, so don't add it back
      toast.success("Request removed from view");
    } finally {
      setProcessingRequest(null);
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
          <TabsList className="grid w-full max-w-3xl grid-cols-5">
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
            <TabsTrigger value="requests" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Requests
              {(unassignmentRequests.length + assignmentRequests.length) > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-destructive text-destructive-foreground">
                  {unassignmentRequests.length + assignmentRequests.length}
                </span>
              )}
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
                      <tr 
                        key={student.tr_number} 
                        className={`border-b border-border table-row-hover ${
                          student.available_in_mumbai 
                            ? 'bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30' 
                            : ''
                        }`}
                      >
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
                      Select students and event for assignment
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

                {/* Event Tag Selection */}
                <div className="mb-4 pb-4 border-b border-border">
                  <label className="text-sm font-medium mb-2 block">
                    Event Tag <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={selectedEventTag}
                    onChange={(e) => setSelectedEventTag(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                    disabled={loading}
                  >
                    <option value="">Select event tag...</option>
                    {existingEventTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select from existing event tags. Create new tags in "Set Current Event" section.
                  </p>
                </div>

                {/* Selection Controls */}
                <div className="flex flex-col gap-3 mb-4 pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
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
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium whitespace-nowrap">
                      Beneficiaries to assign:
                    </label>
                    <Input
                      type="number"
                      placeholder={`Max: ${stats.totalBeneficiaries - stats.totalAssignments} unassigned`}
                      value={beneficiaryCap}
                      onChange={(e) => setBeneficiaryCap(e.target.value)}
                      className="max-w-xs"
                      min="1"
                      max={stats.totalBeneficiaries - stats.totalAssignments}
                    />
                    <span className="text-xs text-muted-foreground">
                      Available: {stats.totalBeneficiaries - stats.totalAssignments} unassigned
                    </span>
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
                            className="flex items-center gap-3 p-3 rounded-lg border-2 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 cursor-pointer hover:bg-green-100 dark:hover:bg-green-950/40 transition-all shadow-lg shadow-green-500/30 dark:shadow-green-500/20"
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
                            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted transition-all shadow-md shadow-gray-400/20 dark:shadow-gray-600/10"
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

              <div className="card-elevated p-6 border-2 border-blue-500">
                <h3 className="font-serif text-lg mb-2 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Unassign by Student
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Remove all pending assignments from a specific student. More granular control than event-based unassignment.
                </p>
                <select
                  value={selectedStudentForUnassign}
                  onChange={(e) => setSelectedStudentForUnassign(e.target.value)}
                  className="w-full mb-3 px-3 py-2 border border-input rounded-md bg-background text-sm"
                  disabled={loading}
                >
                  <option value="">Select a student...</option>
                  {studentProgress
                    .filter(student => student.assigned > student.completed)
                    .map((student) => (
                      <option 
                        key={student.tr_number} 
                        value={student.tr_number}
                        className={student.available_in_mumbai ? 'bg-green-100 dark:bg-green-900' : ''}
                      >
                        {student.available_in_mumbai ? '🟢 ' : ''}{student.name} (TR: {student.tr_number}) - {student.assigned - student.completed} pending
                      </option>
                    ))}
                </select>
                {selectedStudentForUnassign && (() => {
                  const student = studentProgress.find(s => s.tr_number === selectedStudentForUnassign);
                  return student ? (
                    <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md text-sm">
                      <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                        {student.name}
                      </p>
                      <div className="text-blue-700 dark:text-blue-300 space-y-0.5">
                        <p>TR: {student.tr_number} • Branch: {student.branch}</p>
                        <p>Total Assigned: {student.assigned}</p>
                        <p>Completed: {student.completed} ✓</p>
                        <p className="font-semibold">Pending: {student.assigned - student.completed} (will be unassigned)</p>
                      </div>
                    </div>
                  ) : null;
                })()}
                <Button
                  variant="outline"
                  onClick={unassignByStudent}
                  disabled={loading || !selectedStudentForUnassign}
                  className="w-full border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Users className="w-4 h-4 mr-2" />
                  )}
                  Unassign Student's Pending Work
                </Button>
              </div>

              <div className="card-elevated p-6 border-2 border-orange-500">
                <h3 className="font-serif text-lg mb-2 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-orange-500" />
                  Unassign Pending by Event
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Remove all incomplete assignments for an entire event. Beneficiaries become available for reassignment.
                </p>
                <select
                  value={selectedEventForUnassign}
                  onChange={(e) => setSelectedEventForUnassign(e.target.value)}
                  className="w-full mb-3 px-3 py-2 border border-input rounded-md bg-background text-sm"
                  disabled={loading || eventAnalytics.length === 0}
                >
                  <option value="">Select an event...</option>
                  {eventAnalytics
                    .filter(event => event.pending > 0)
                    .map((event) => (
                      <option key={event.event_tag} value={event.event_tag}>
                        {event.event_tag} ({event.pending} pending, {event.completed} completed)
                      </option>
                    ))}
                </select>
                {selectedEventForUnassign && eventAnalytics.find(e => e.event_tag === selectedEventForUnassign) && (
                  <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-md text-sm">
                    <p className="font-medium text-orange-900 dark:text-orange-100 mb-1">
                      {eventAnalytics.find(e => e.event_tag === selectedEventForUnassign)?.event_tag}
                    </p>
                    <div className="text-orange-700 dark:text-orange-300 space-y-0.5">
                      <p>Total: {eventAnalytics.find(e => e.event_tag === selectedEventForUnassign)?.total}</p>
                      <p>Completed: {eventAnalytics.find(e => e.event_tag === selectedEventForUnassign)?.completed} ✓</p>
                      <p className="font-semibold">Pending: {eventAnalytics.find(e => e.event_tag === selectedEventForUnassign)?.pending} (will be unassigned)</p>
                    </div>
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={unassignPending}
                  disabled={loading || !selectedEventForUnassign}
                  className="w-full border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Unassign Pending Assignments
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

              {/* Message Templates Management */}
              <div className="card-elevated p-6 md:col-span-2 border-2 border-purple-500">
                <h3 className="font-serif text-xl mb-2 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-500" />
                  Contact Message Templates
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Edit the default messages sent via WhatsApp and Email when students contact beneficiaries.
                </p>

                <div className="space-y-6">
                  {/* WhatsApp Template */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      WhatsApp Message Template
                    </label>
                    <textarea
                      value={whatsappTemplate}
                      onChange={(e) => setWhatsappTemplate(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm font-mono"
                      placeholder="Enter WhatsApp message..."
                      disabled={savingTemplates}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Use \n for line breaks. This appears in WhatsApp links.
                    </p>
                  </div>

                  {/* Email Subject */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Email Subject
                    </label>
                    <Input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="e.g., Ziyarat Khidmat - Rawdat Tahera"
                      disabled={savingTemplates}
                    />
                  </div>

                  {/* Email Body */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Email Body Template
                    </label>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm font-mono"
                      placeholder="Enter email body..."
                      disabled={savingTemplates}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Use \n for line breaks. This appears in email clients.
                    </p>
                  </div>

                  <Button
                    onClick={saveMessageTemplates}
                    disabled={savingTemplates}
                    className="w-full"
                  >
                    {savingTemplates ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Settings className="w-4 h-4 mr-2" />
                    )}
                    Save Message Templates
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests" className="space-y-6">
            {/* Refresh All Button */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  fetchAssignmentRequests();
                  fetchUnassignmentRequests();
                }}
                disabled={loading}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh All
              </Button>
            </div>

            {/* Assignment Requests */}
            <div className="card-elevated p-6 border-2 border-blue-500">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-serif text-xl mb-1 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    Assignment Requests
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Students requesting new work. Click "Assign Beneficiaries" to assign via Manual Assignment.
                  </p>
                </div>
              </div>

              {assignmentRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p>No assignment requests</p>
                  <p className="text-xs mt-1">Students with 0 assignments can request new work</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assignmentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="border-2 border-blue-200 dark:border-blue-900 rounded-lg p-4 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-blue-500/20">
                              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {request.student_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                TR: {request.student_tr_number}
                              </p>
                            </div>
                          </div>

                          <div className="grid md:grid-cols-3 gap-3 mt-3 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">Event</p>
                              <p className="font-medium text-foreground mt-0.5">
                                {request.event_tag || "Any event"}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Current Assignments</p>
                              <p className="font-medium text-blue-600 mt-0.5">
                                {request.current_assignments}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Requested</p>
                              <p className="font-medium text-foreground mt-0.5">
                                {new Date(request.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          {request.reason && (
                            <div className="mt-3 p-3 bg-muted rounded-md">
                              <p className="text-xs text-muted-foreground mb-1">Note:</p>
                              <p className="text-sm text-foreground">{request.reason}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={async () => {
                              // First, fetch students and open Manual Assignment
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

                                // Fetch existing event tags from assignments
                                const { data: eventTagsData } = await supabase
                                  .from("assignments")
                                  .select("event_tag")
                                  .not("event_tag", "is", null);
                                
                                // Get unique event tags and sort them
                                const uniqueTags = [...new Set(eventTagsData?.map(a => a.event_tag) || [])];
                                setExistingEventTags(uniqueTags.sort());
                                
                                // Set default selection to current event if it exists
                                if (eventData?.setting_value && uniqueTags.includes(eventData.setting_value)) {
                                  setSelectedEventTag(eventData.setting_value);
                                } else if (uniqueTags.length > 0) {
                                  setSelectedEventTag(uniqueTags[0]);
                                }

                                // Fetch all active students
                                const { data: students } = await supabase
                                  .from("students")
                                  .select("tr_number, name, branch, available_in_mumbai")
                                  .eq("is_active", true)
                                  .order("available_in_mumbai", { ascending: false })
                                  .order("name");
                                
                                setAvailableStudents(students || []);
                                
                                // Pre-select ONLY the student who made the request
                                setSelectedStudents(new Set([request.student_tr_number]));
                                
                                // Switch to Actions tab
                                const actionsTab = document.querySelector('[value="actions"]') as HTMLElement;
                                if (actionsTab) {
                                  actionsTab.click();
                                }
                                
                                // Open Manual Assignment
                                setShowManualAssign(true);
                                
                                toast.success(`Manual Assignment opened for ${request.student_name}. Select event tag and assign beneficiaries.`);
                              } catch (err) {
                                console.error(err);
                                toast.error("Failed to open Manual Assignment");
                              } finally {
                                setLoading(false);
                              }
                            }}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Users className="w-4 h-4 mr-2" />
                            Assign Beneficiaries
                          </Button>
                          <Button
                            onClick={() => {
                              if (confirm(`Reject request from ${request.student_name}?\n\nStudent will be able to resubmit after 24 hours.`)) {
                                revertAssignmentRequest(request.id);
                              }
                            }}
                            disabled={processingRequest === request.id}
                            variant="outline"
                            size="sm"
                          >
                            {processingRequest === request.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <X className="w-4 h-4 mr-2" />
                            )}
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Unassignment Requests */}
            <div className="card-elevated p-6 border-2 border-orange-500">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-serif text-xl mb-1">Unassignment Requests</h3>
                  <p className="text-sm text-muted-foreground">
                    Students requesting to unassign their pending work
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchUnassignmentRequests}
                  disabled={loading}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>

              {unassignmentRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No pending requests</p>
                  <p className="text-xs mt-1">Students can request unassignment when they're not available in Mumbai</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {unassignmentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="border border-border rounded-lg p-4 bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-orange-500/10">
                              <Users className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {request.student_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                TR: {request.student_tr_number}
                              </p>
                            </div>
                          </div>

                          <div className="grid md:grid-cols-3 gap-3 mt-3 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">Event</p>
                              <p className="font-medium text-foreground mt-0.5">
                                {request.event_tag || "All events"}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Pending Assignments</p>
                              <p className="font-medium text-orange-600 mt-0.5">
                                {request.pending_count}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Requested</p>
                              <p className="font-medium text-foreground mt-0.5">
                                {new Date(request.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          {request.reason && (
                            <div className="mt-3 p-3 bg-muted rounded-md">
                              <p className="text-xs text-muted-foreground mb-1">Reason:</p>
                              <p className="text-sm text-foreground">{request.reason}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={() => {
                              if (confirm(`Approve request from ${request.student_name}?\n\nThis will unassign ${request.pending_count} pending assignments.\n\nContinue?`)) {
                                approveUnassignmentRequest(request.id, request.student_tr_number, request.event_tag);
                              }
                            }}
                            disabled={processingRequest === request.id}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {processingRequest === request.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4 mr-2" />
                            )}
                            Approve
                          </Button>
                          <Button
                            onClick={() => {
                              if (confirm(`Reject request from ${request.student_name}?`)) {
                                rejectUnassignmentRequest(request.id);
                              }
                            }}
                            disabled={processingRequest === request.id}
                            variant="destructive"
                            size="sm"
                          >
                            {processingRequest === request.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <X className="w-4 h-4 mr-2" />
                            )}
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
