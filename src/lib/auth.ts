import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "ziyarat_session";

export interface StudentSession {
  tr_number: string;
  name: string;
  branch: string;
  session_id: string;
  expires_at: string;
}

export async function loginStudent(identifier: string): Promise<{ success: boolean; student?: StudentSession; error?: string }> {
  const trimmedId = identifier.trim();
  
  // Try to find student by TR Number or ITS ID
  const { data: student, error } = await supabase
    .from("students")
    .select("*")
    .or(`tr_number.eq.${trimmedId},its_id.eq.${trimmedId}`)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Login error:", error);
    return { success: false, error: "An error occurred. Please try again." };
  }

  if (!student) {
    return { success: false, error: "Access denied" };
  }

  // Create session
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: session, error: sessionError } = await supabase
    .from("student_sessions")
    .insert({
      student_tr_number: student.tr_number,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (sessionError) {
    console.error("Session error:", sessionError);
    return { success: false, error: "Failed to create session" };
  }

  const studentSession: StudentSession = {
    tr_number: student.tr_number,
    name: student.name,
    branch: student.branch || "",
    session_id: session.id,
    expires_at: expiresAt,
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(studentSession));
  return { success: true, student: studentSession };
}

export function getSession(): StudentSession | null {
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return null;

  try {
    const session = JSON.parse(stored) as StudentSession;
    if (new Date(session.expires_at) < new Date()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export async function logout(): Promise<void> {
  const session = getSession();
  if (session) {
    await supabase
      .from("student_sessions")
      .delete()
      .eq("id", session.session_id);
  }
  localStorage.removeItem(SESSION_KEY);
}

export function isLoggedIn(): boolean {
  return getSession() !== null;
}
