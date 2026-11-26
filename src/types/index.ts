export type RoleCode =
  | 'super_admin'
  | 'nvc_admin'
  | 'review_officer'
  | 'ministry_user'
  | 'office_user'
  | 'viewer_auditor';

export type GovtLevel = 'federal' | 'provincial' | 'local';

export type SubmissionStatus =
  | 'Not Started'
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Returned for Correction'
  | 'Resubmitted'
  | 'Reviewed'
  | 'Accepted'
  | 'Overdue';

export type IndicatorStatus = 'पूर्ण' | 'आंशिक' | 'छैन';

export interface Role {
  id: number;
  code: RoleCode;
  name_np: string;
  name_en: string;
  description: string;
}

export interface UserOfficeLink {
  office_id: number;
  office_name_np: string;
  office_name_en: string;
  office_code: string;
  is_head: boolean;
  can_submit: boolean;
  is_primary: boolean;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  full_name_np: string;
  full_name_en: string;
  designation_np: string;
  designation_en: string;
  phone: string;
  role: RoleCode;
  role_name_np: string;
  role_name_en: string;
  ministry_id: number | null;
  ministry_name_np?: string | null;
  province_id: number | null;
  is_active: boolean;
  offices: UserOfficeLink[];
}

export interface Province {
  id: number;
  code: string;
  name_np: string;
  name_en: string;
}

export interface District {
  id: number;
  province_id: number;
  geo_key: string;
  name_np: string;
  name_en: string;
}

export interface LocalLevel {
  id: number;
  district_id: number;
  type_np: string;
  name_np: string;
  name_en: string;
}

export interface Ministry {
  id: number;
  code: string;
  name_np: string;
  name_en: string;
  govt_level: GovtLevel;
}

export interface Department {
  id: number;
  ministry_id: number;
  name_np: string;
  name_en: string;
}

export interface GovernmentOffice {
  id: number;
  office_code: string;
  name_np: string;
  name_en: string;
  office_type_np: string;
  office_type_en: string;
  govt_level: GovtLevel;
  ministry_id: number | null;
  ministry_name_np?: string | null;
  ministry_name_en?: string | null;
  department_id: number | null;
  department_name_np?: string | null;
  province_id: number;
  province_name_np?: string;
  province_name_en?: string;
  district_id: number;
  district_name_np?: string;
  district_name_en?: string;
  district_geo_key?: string;
  local_level_id: number | null;
  local_level_name_np?: string | null;
  address_np: string;
  address_en: string;
  office_head_name: string;
  office_head_designation: string;
  contact_phone: string;
  email: string;
  website: string;
  is_active: boolean;
}

export interface FiscalYear {
  id: number;
  code: string; // e.g. '2083/84'
  name_np: string; // e.g. '२०८३/८४'
  is_active: boolean;
}

export interface ReportingPeriod {
  id: number;
  fiscal_year_id: number;
  fiscal_year_code: string;
  fiscal_year_np: string;
  quarter_number: 1 | 2 | 3 | 4;
  quarter_name_np: string;
  quarter_name_en: string;
  start_date_bs: string;
  end_date_bs: string;
  deadline_bs: string;
  deadline_ad: string;
  status: 'open' | 'closed';
}

export interface ImplementationIndicator {
  id: number;
  indicator_no: number;
  title_np: string;
  title_en: string;
  is_required: boolean;
}

export interface OfficeProgressSummary {
  office_name: string;
  address: string;
  contact_info: string;
  level_ministry: string;
  office_head: string;
  total_services: number;
  prepared_forms: number;
  approved_forms: number;
  in_use_forms: number;
  free_available_forms: number;
  digital_available_forms: number;
  major_achievements: string;
  exception_approved: boolean;
  exception_reason: string;
}

export interface IndicatorResponse {
  id?: number;
  indicator_id: number;
  indicator_no: number;
  status: IndicatorStatus | '';
  remarks: string;
  evidence_details: string;
  attachment_id?: number | null;
}

export interface ServiceDetail {
  id?: number;
  serial_no: number;
  service_name: string;
  is_prepared: boolean;
  is_approved: boolean;
  is_in_use: boolean;
  approval_date: string;
  is_free: boolean;
  is_notice_board: boolean;
  is_website: boolean;
  website_url: string;
  received_count: number;
  disposed_count: number;
  pending_count: number;
  returned_count: number;
  within_deadline_count: number;
  prescribed_timeline: string;
  remarks: string;
}

export interface MonitoringDetail {
  monitoring_date: string;
  monitoring_conclusion: string;
  previous_report_status: string;
  center_directive_status: string;
  improvements_made: string;
  evidence_approved_sample: boolean;
  evidence_website_notice: boolean;
  evidence_service_record: boolean;
  evidence_other: boolean;
  evidence_other_text: string;
  privacy_confirmed: boolean;
}

export interface CorrectiveAction {
  id?: number;
  main_problem: string;
  root_cause: string;
  corrective_step: string;
  responsible_person: string;
  responsible_unit: string;
  target_deadline: string;
  expected_facilitation: string;
  remarks: string;
}

export interface SubmissionAttachment {
  id: number;
  submission_id: number;
  indicator_no: number | null;
  category: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_by: number;
  uploaded_by_name?: string;
  uploaded_at: string;
}

export interface CertificationTier {
  id?: number;
  tier: 'preparer' | 'reviewer' | 'head';
  name_designation: string;
  signature_text: string;
  signed_date: string;
  office_stamp_confirmed: boolean;
  digital_pin_verified: boolean;
  signed_doc_attachment_id: number | null;
}

export interface FeedbackReply {
  id: number;
  feedback_id: number;
  user_id: number;
  user_name_np: string;
  user_role: string;
  message: string;
  attachment_id: number | null;
  created_at: string;
}

export interface FeedbackItem {
  id: number;
  submission_id: number;
  author_id: number;
  author_name_np: string;
  author_role: string;
  scope_type: 'overall' | 'section' | 'indicator' | 'service' | 'directive';
  scope_ref: string;
  message: string;
  is_directive: boolean;
  requires_evidence: boolean;
  created_at: string;
  replies: FeedbackReply[];
}

export interface StatusHistoryItem {
  id: number;
  submission_id: number;
  from_status: string | null;
  to_status: string;
  changed_by_name: string;
  note: string;
  created_at: string;
}

export interface SubmissionVersion {
  id: number;
  submission_id: number;
  version_no: number;
  submitted_by_name: string;
  submitted_at: string;
  summary_json: string;
}

export interface SubmissionFull {
  id: number;
  office_id: number;
  reporting_period_id: number;
  fiscal_year_id: number;
  fiscal_year_np: string;
  fiscal_year_code: string;
  quarter_number: 1 | 2 | 3 | 4;
  quarter_name_np: string;
  quarter_name_en: string;
  start_date_bs: string;
  end_date_bs: string;
  deadline_bs: string;
  deadline_ad: string;
  status: SubmissionStatus;
  version_no: number;
  is_timely: boolean;
  submitted_at: string | null;
  reviewed_at: string | null;
  implementation_score: number;
  updated_at: string;
  office: GovernmentOffice;
  summary: OfficeProgressSummary;
  indicators: IndicatorResponse[];
  services: ServiceDetail[];
  monitoring: MonitoringDetail;
  corrective_actions: CorrectiveAction[];
  attachments: SubmissionAttachment[];
  certifications: CertificationTier[];
  feedbacks: FeedbackItem[];
  status_history: StatusHistoryItem[];
  versions: SubmissionVersion[];
}

export interface SubmissionListItem {
  id: number;
  office_id: number;
  office_code: string;
  office_name_np: string;
  office_name_en: string;
  govt_level: GovtLevel;
  ministry_id: number | null;
  ministry_name_np: string | null;
  province_id: number;
  province_name_np: string;
  district_id: number;
  district_name_np: string;
  district_geo_key: string;
  reporting_period_id: number;
  fiscal_year_id: number;
  fiscal_year_np: string;
  quarter_number: number;
  quarter_name_np: string;
  deadline_bs: string;
  status: SubmissionStatus;
  version_no: number;
  is_timely: boolean;
  submitted_at: string | null;
  implementation_score: number;
  total_services: number;
  prepared_forms: number;
  approved_forms: number;
  in_use_forms: number;
  total_received: number;
  total_disposed: number;
  total_within_deadline: number;
  feedback_count: number;
}

export interface NotificationItem {
  id: number;
  user_id: number | null;
  office_id: number | null;
  title_np: string;
  title_en: string;
  message_np: string;
  message_en: string;
  type: string;
  link_submission_id: number | null;
  is_read: boolean;
  created_at: string;
}

export interface DashboardFilters {
  fiscalYearIds: number[];
  quarterNumbers: number[];
  dateFrom: string;
  dateTo: string;
  govtLevels: GovtLevel[];
  ministryIds: number[];
  departmentIds: number[];
  provinceIds: number[];
  districtIds: number[];
  localLevelIds: number[];
  officeTypes: string[];
  officeIds: number[];
  statuses: SubmissionStatus[];
  implState: '' | 'high' | 'medium' | 'low';
  indicatorNo: number | null;
}

export interface DashboardAnalytics {
  kpis: {
    totalOffices: number;
    requiredReportingOffices: number;
    submittedOffices: number;
    notSubmittedOffices: number;
    pendingReviewCount: number;
    reviewedCompletedCount: number;
    returnedForCorrectionCount: number;
    timelySubmittedCount: number;
    lateSubmittedCount: number;
    avgImplementationPct: number;
  };
  officeListsByKpi: {
    all: SubmissionListItem[];
    submitted: SubmissionListItem[];
    notSubmitted: SubmissionListItem[];
    pendingReview: SubmissionListItem[];
    reviewedCompleted: SubmissionListItem[];
    returned: SubmissionListItem[];
    timely: SubmissionListItem[];
    late: SubmissionListItem[];
  };
  provinceStats: Array<{
    province_id: number;
    province_name_np: string;
    province_name_en: string;
    total_offices: number;
    submitted_offices: number;
    not_submitted_offices: number;
    avg_impl_pct: number;
    total_services: number;
    total_received: number;
    total_disposed: number;
    timely_disposal_pct: number;
  }>;
  districtStats: Array<{
    district_id: number;
    geo_key: string;
    district_name_np: string;
    district_name_en: string;
    province_id: number;
    total_offices: number;
    submitted_offices: number;
    avg_impl_pct: number;
    total_received: number;
    total_disposed: number;
  }>;
  govtLevelStats: Array<{
    govt_level: GovtLevel;
    label_np: string;
    label_en: string;
    total_offices: number;
    submitted_offices: number;
    avg_impl_pct: number;
  }>;
  ministryStats: Array<{
    ministry_id: number;
    ministry_name_np: string;
    ministry_name_en: string;
    total_offices: number;
    submitted_offices: number;
    not_submitted_offices: number;
    avg_impl_pct: number;
    rank: number;
  }>;
  indicatorStats: Array<{
    indicator_no: number;
    title_np: string;
    title_en: string;
    full_count: number;
    partial_count: number;
    none_count: number;
    total_responses: number;
    compliance_pct: number;
  }>;
  serviceAnalytics: {
    total_services: number;
    prepared_forms: number;
    approved_forms: number;
    in_use_forms: number;
    free_available_forms: number;
    digital_available_forms: number;
    total_received: number;
    total_disposed: number;
    total_pending: number;
    total_returned: number;
    total_within_deadline: number;
    within_deadline_pct: number;
    top_services: Array<{
      service_name: string;
      office_count: number;
      received: number;
      disposed: number;
      pending: number;
      returned: number;
      within_deadline: number;
      within_deadline_pct: number;
    }>;
  };
  quarterlyTrends: Array<{
    period_label_np: string;
    period_label_en: string;
    fiscal_year_code: string;
    quarter_number: number;
    submitted_count: number;
    timely_count: number;
    avg_impl_pct: number;
    prepared_rate_pct: number;
    in_use_rate_pct: number;
    disposal_rate_pct: number;
  }>;
  submissions: SubmissionListItem[];
}
