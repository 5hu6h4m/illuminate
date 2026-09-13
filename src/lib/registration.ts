export const COLLEGE_LOCKED = "MET Bhujbal Knowledge City";

export const BRANCHES = [
  "Computer Science & Design",
  "Computer Engineering",
  "Information Technology",
  "Electronics & Telecommunication",
  "Mechanical Engineering",
  "Civil Engineering",
  "Electrical Engineering",
  "Other",
] as const;

export const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Other"] as const;

export const INTERESTS = [
  "Entrepreneurship",
  "Startups",
  "Innovation",
  "Business",
  "Technology",
  "Networking",
  "Learning about startups",
  "Exploring entrepreneurship",
  "Other",
] as const;

export type Registration = {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  whatsapp: string;
  gender?: string;
  college: string;
  studentId: string;
  branch: string;
  year: string;
  division?: string;
  interests: string[];
  hasIdea: string;
  ideaText?: string;
  attendedStartupEvent: string;
  attendedEcell: string;
  campusVisit: string;
  willingToTravel: string;
  emergencyName: string;
  emergencyPhone: string;
  accessibility?: string;
  amountPaid: number;
  paymentStatus: "paid" | "pending" | "awaiting_verification";
  paymentId?: string;
  utr?: string;
  /** UPI payment screenshot — compressed JPEG data URL (max ~1.5MB). Admin verifies. */
  paymentScreenshot?: string;
  createdAt: string;
};

const DRAFT_KEY = "illuminate-draft-v1";
const LIST_KEY = "illuminate-registrations-v1";

export function generateRegId(seq?: number): string {
  const n =
    seq ?? Math.floor(10000 + Math.random() * 89999);
  return `ILL-MET-2026-${String(n).padStart(5, "0")}`;
}

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

export function isValidIndianMobile(v: string): boolean {
  const d = v.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(d);
}

export function loadDraft<T>(fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveDraft(v: unknown): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(v));
  } catch {
    /* storage full/blocked — ignore */
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function loadRegistrations(): Registration[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LIST_KEY);
    return raw ? (JSON.parse(raw) as Registration[]) : [];
  } catch {
    return [];
  }
}

export function saveRegistration(r: Registration): void {
  const list = loadRegistrations();
  list.unshift(r);
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function toCSV(rows: Registration[]): string {
  const header = [
    "Registration ID",
    "Name",
    "Email",
    "Mobile",
    "WhatsApp",
    "Gender",
    "College",
    "Student ID",
    "Branch",
    "Year",
    "Division",
    "Interests",
    "Has Idea",
    "Idea Text",
    "Attended Startup Event",
    "Attended Ecell",
    "Campus Visit Interest",
    "Travel Interest",
    "Emergency Name",
    "Emergency Phone",
    "Accessibility",
    "Amount Paid",
    "Payment Status",
    "Payment ID",
    "UTR",
    "Has Screenshot",
    "Registration Date",
  ];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.id,
      r.fullName,
      r.email,
      r.mobile,
      r.whatsapp,
      r.gender ?? "",
      r.college,
      r.studentId,
      r.branch,
      r.year,
      r.division ?? "",
      (r.interests ?? []).join(" | "),
      r.hasIdea,
      r.ideaText ?? "",
      r.attendedStartupEvent,
      r.attendedEcell,
      r.campusVisit,
      r.willingToTravel,
      r.emergencyName,
      r.emergencyPhone,
      r.accessibility ?? "",
      r.amountPaid,
      r.paymentStatus,
      r.paymentId ?? "",
      r.utr ?? "",
      r.paymentScreenshot ? "YES" : "NO",
      r.createdAt,
    ]
      .map(esc)
      .join(",")
  );
  return [header.map(esc).join(","), ...lines].join("\n");
}

export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
