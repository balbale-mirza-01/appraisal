export type Role =
  | "evaluator"
  | "region_supervisor"
  | "marketing_manager"
  | "admin";

export interface User {
  id: number;
  username: string;
  email: string;
  employee_number: string | null;
  mobile_number: string;
  first_name: string;
  last_name: string;
  display_name: string;
  role: Role;
}

export interface Region {
  id: number;
  code: string;
  name: string;
}

export interface Branch {
  id: number;
  code: string;
  name: string;
  manager_name: string;
  region: number;
  region_name: string;
}

export interface Criterion {
  id: number;
  text: string;
  order: number;
  weight: string;
  is_required: boolean;
}

export interface Section {
  id: number;
  title: string;
  icon: string;
  order: number;
  weight: string;
  criteria: Criterion[];
}

export interface EvaluationTemplate {
  id: number;
  name: string;
  version: number;
  status: string;
  effective_date: string;
  total_weight: string;
  sections: Section[];
}

export interface Cycle {
  id: number;
  title: string;
  template: number;
  template_name: string;
  start_date: string;
  end_date: string;
  status: string;
}

export interface Assignment {
  id: number;
  cycle: number;
  cycle_title: string;
  template_id: number;
  branch: number;
  branch_detail: Branch;
  evaluator: number;
  evaluator_detail: User;
  assigned_by_detail: User;
  due_date: string;
  status: string;
  evaluation_id: number | null;
  created_at: string;
}

export interface Answer {
  id?: number;
  criterion: number;
  score: number;
  weighted_score?: string;
  comment?: string;
}

export interface Opportunity {
  id?: number;
  organization_name: string;
  employee_count: number | null;
  opportunity_types: string[];
  responsible_person: string;
  status: string;
  target_date: string | null;
  notes: string;
}

export interface Evaluation {
  id: number;
  assignment: number;
  assignment_detail: Assignment;
  status: "draft" | "submitted" | "returned" | "approved";
  evaluation_date: string;
  strengths: string;
  improvements: string;
  market_opportunities: string;
  branch_needs: string;
  answers: Answer[];
  opportunities: Opportunity[];
  total_score: string;
  section_scores: Record<
    string,
    { title: string; score: number; weight: number; percentage: number }
  >;
  classification: string;
  review_comment: string;
  updated_at: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DashboardData {
  role: Role;
  assignment_counts: Record<string, number>;
  evaluation_counts: Record<string, number>;
  total_assignments: number;
  total_evaluations: number;
  average_score: string | null;
  due_soon: number;
  action_required?: Assignment[];
  waiting_for_review?: Evaluation[];
  regions?: Array<{
    assignment__branch__region_id: number;
    assignment__branch__region__name: string;
    evaluation_count: number;
    approved_count: number;
    average_score: number | null;
  }>;
  evaluator_summary?: {
    approved: number;
    returned: number;
    overdue: number;
    completion_rate: number;
  };
  supervisor_summary?: {
    regions: number;
    branches: number;
    active_evaluators: number;
    overdue: number;
  };
  evaluator_workload?: Array<{
    evaluator_id: number;
    evaluator__username: string;
    evaluator__first_name: string;
    evaluator__last_name: string;
    total: number;
    in_progress: number;
    waiting_review: number;
    approved: number;
    overdue: number;
  }>;
  manager_summary?: {
    regions: number;
    branches: number;
    evaluators: number;
    active_cycles: number;
  };
  active_cycles?: Array<{
    id: number;
    title: string;
    start_date: string;
    end_date: string;
    assignment_count: number;
    submitted_count: number;
    approved_count: number;
    average_score: number | null;
  }>;
  admin_summary?: {
    active_users: number;
    evaluators: number;
    supervisors: number;
    regions: number;
    branches: number;
    templates: number;
  };
}
