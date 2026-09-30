import type { MetricInputs } from "@/lib/kpi-engine";

// --- Hierarchy: Designer -> EC -> Manager/ASM (brief §6.1) -------------------

export interface Manager {
  id: string;
  name: string;
  title: "ASM" | "EC Manager";
  initials: string;
}

export interface ExperienceCenter {
  id: string;
  name: string;
  city: string;
  code: string;
  managerId: string;
}

export interface Designer {
  id: string;
  name: string;
  initials: string;
  ecId: string;
  ecIds?: string[];
  /** Years with the company — used only to colour the roster, not the score. */
  tenure: number | null;
}

// --- Periods ----------------------------------------------------------------

export type Granularity = "week" | "month" | "quarter" | "year" | "all";

export interface Period {
  /** e.g. "2026-M07", "2026-W28", "2026-Q3", "2026" */
  id: string;
  granularity: Granularity;
  label: string;
  /** Sort key — larger is more recent. */
  order: number;
  /** Which month ids this period covers, for aggregation. */
  months: string[];
  /** Volume metrics scale by this. A week is ~0.23 of a month; else 1. */
  scale: number;
  /** Rate metrics wobble by this, so week-on-week views aren't flat; else 1. */
  wobble: number;
}

// --- Facts ------------------------------------------------------------------

/** One designer's target + actual for every sub-KPI in one month. */
export interface MonthlyFact {
  designerId: string;
  monthId: string;
  metrics: MetricInputs;
}

// --- Module 2: audit ticketing ---------------------------------------------

export const TICKET_STAGES = [
  "Created",
  "Scheduled",
  "Audited",
  "Closed",
] as const;
export type TicketStage = (typeof TICKET_STAGES)[number];

export type TicketOutcome = "Pass" | "Fail" | null;

/** Placeholder taxonomy — the brief leaves this to be finalised with the audit team. */
export const ERROR_TYPES = [
  "Measurement error",
  "Material mismatch",
  "Layout error",
  "Dimension mismatch",
  "Spec / BOM error",
  "Finish mismatch",
] as const;
export type ErrorType = (typeof ERROR_TYPES)[number];

export interface AuditTicket {
  id: string;
  designerId: string;
  ecId: string;
  projectName: string;
  monthId: string;
  /** ISO date the ticket was raised. */
  createdOn: string;
  /** ISO date-time of the booked audit slot. */
  scheduledFor: string;
  auditedOn: string | null;
  stage: TicketStage;
  outcome: TicketOutcome;
  errors: ErrorType[];
  auditor: string;
  /** Days from QL to Design Presentation for this design. */
  cycleDays: number;
  notes: string;
}

// --- Module 4: Modula Circle ------------------------------------------------

export interface CircleMember {
  id: string;
  name: string;
  segment: "Architect" | "Contractor" | "Interior Studio" | "Channel Partner";
  onboardedBy: string;
  ecId: string;
  onboardedOn: string;
  monthId: string;
  revenue: number;
  uniqueBookings: number;
  activeReferrals: number;
  status: "Active" | "Dormant";
}

// --- Roles (brief §6.1) -----------------------------------------------------

export type Role = "designer" | "manager" | "head";

export interface RoleDefinition {
  id: Role;
  label: string;
  scope: string;
}

export const ROLES: RoleDefinition[] = [
  { id: "designer", label: "Designer", scope: "Own data only" },
  {
    id: "manager",
    label: "EC Manager / ASM",
    scope: "Own ECs and their designers",
  },
  { id: "head", label: "Design Head", scope: "Everything" },
];

// --- Superadmin-entered data ------------------------------------------------

export interface AdminData {
  managers: Manager[];
  /** EC id → manager id. */
  ecManagers: Record<string, string>;
  auditTickets: AuditTicket[];
  circleMembers: CircleMember[];
}

export const EMPTY_ADMIN_DATA: AdminData = {
  managers: [],
  ecManagers: {},
  auditTickets: [],
  circleMembers: [],
};
