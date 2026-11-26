import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { db, DB_PATH } from './db.ts';
import {
  AuthRequest,
  canUserAccessOffice,
  getAuthUserById,
  hashPassword,
  requireAuth,
  requireRoles,
  signToken,
  verifyPassword,
  writeAuditLog,
} from './auth.ts';
import {
  DashboardAnalytics,
  IndicatorResponse,
  ServiceDetail,
  SubmissionFull,
  SubmissionListItem,
  SubmissionStatus,
} from '../src/types/index.ts';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const apiRouter = Router();

// Health check
apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========================
// AUTH ROUTES
// ========================
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { identifier, password } = req.body || {};
  if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim() || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required.' });
  }
  const cleanId = identifier.trim().toLowerCase();
  const row = db
    .prepare('SELECT id, password_hash, is_active FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1')
    .get(cleanId, cleanId) as { id: number; password_hash: string; is_active: number } | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: 'गलत प्रयोगकर्ता नाम/इमेल वा पासवर्ड। (Invalid credentials)' });
  }
  if (!row.is_active) {
    return res.status(403).json({ error: 'तपाईंको खाता निष्क्रिय गरिएको छ। कृपया प्रशासकसँग सम्पर्क गर्नुहोस्।' });
  }

  const user = getAuthUserById(row.id);
  if (!user) {
    return res.status(500).json({ error: 'User profile could not be loaded.' });
  }

  const token = signToken(user.id, user.role);
  writeAuditLog(user.id, 'LOGIN', 'user', user.id, { username: user.username }, req.ip || '');
  res.json({ token, user });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.authUser });
});

apiRouter.post('/auth/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body || {};
  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  const user = db
    .prepare('SELECT id, email, full_name_np FROM users WHERE LOWER(email) = ? LIMIT 1')
    .get(email.trim().toLowerCase()) as { id: number; email: string; full_name_np: string } | undefined;

  if (!user) {
    return res.json({
      message: 'यदि इमेल प्रणालीमा दर्ता छ भने पासवर्ड रिसेट कोड जारी गरिएको छ।',
    });
  }

  const rawCode = String(crypto.randomInt(100000, 999999));
  const tokenHash = crypto.createHash('sha256').update(rawCode).digest('hex');
  const expiresAt = Date.now() + 15 * 60 * 1000;
  db.prepare('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used) VALUES (?, ?, ?, 0)').run(
    user.id,
    tokenHash,
    expiresAt
  );
  writeAuditLog(user.id, 'PASSWORD_RESET_REQUESTED', 'user', user.id, { email: user.email }, req.ip || '');

  // Return verification code in preview mode so user can complete reset flow seamlessly without external SMTP
  res.json({
    message: 'पासवर्ड रिसेट प्रमाणीकरण कोड जारी गरिएको छ।',
    previewResetCode: rawCode,
  });
});

apiRouter.post('/auth/reset-password', (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body || {};
  if (typeof email !== 'string' || typeof code !== 'string' || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'Valid email, 6-digit code, and new password (min 6 chars) are required.' });
  }
  const user = db
    .prepare('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1')
    .get(email.trim().toLowerCase()) as { id: number } | undefined;
  if (!user) {
    return res.status(400).json({ error: 'Invalid reset request.' });
  }
  const tokenHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
  const tokenRow = db
    .prepare(
      `SELECT id, expires_at, used FROM password_reset_tokens
       WHERE user_id = ? AND token_hash = ?
       ORDER BY id DESC LIMIT 1`
    )
    .get(user.id, tokenHash) as { id: number; expires_at: number; used: number } | undefined;

  if (!tokenRow || tokenRow.used || Date.now() > tokenRow.expires_at) {
    return res.status(400).json({ error: 'प्रमाणीकरण कोड गलत वा म्याद समाप्त भएको छ।' });
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
  db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(tokenRow.id);
  writeAuditLog(user.id, 'PASSWORD_RESET_COMPLETED', 'user', user.id, {}, req.ip || '');
  res.json({ message: 'पासवर्ड सफलतापूर्वक परिवर्तन गरियो। कृपया नयाँ पासवर्डबाट लगइन गर्नुहोस्।' });
});

apiRouter.post('/auth/change-password', requireAuth, (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'Current password and valid new password (min 6 chars) are required.' });
  }
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.authUser!.id) as { password_hash: string };
  if (!verifyPassword(currentPassword, row.password_hash)) {
    return res.status(400).json({ error: 'हालको पासवर्ड मिलेन।' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), req.authUser!.id);
  writeAuditLog(req.authUser!.id, 'PASSWORD_CHANGED', 'user', req.authUser!.id, {}, req.ip || '');
  res.json({ message: 'पासवर्ड सफलतापूर्वक परिवर्तन गरियो।' });
});

// ========================
// MASTER DATA ROUTES
// ========================
apiRouter.get('/master/all', requireAuth, (_req: AuthRequest, res: Response) => {
  const provinces = db.prepare('SELECT * FROM provinces ORDER BY id').all();
  const districts = db.prepare('SELECT * FROM districts ORDER BY province_id, name_en').all();
  const local_levels = db.prepare('SELECT * FROM local_levels ORDER BY district_id, name_np').all();
  const ministries = db.prepare('SELECT * FROM ministries ORDER BY id').all();
  const departments = db.prepare('SELECT * FROM departments ORDER BY ministry_id, id').all();
  const fiscal_years = db.prepare('SELECT * FROM fiscal_years ORDER BY id DESC').all();
  const reporting_periods = db
    .prepare(
      `SELECT rp.*, fy.code AS fiscal_year_code, fy.name_np AS fiscal_year_np
       FROM reporting_periods rp
       JOIN fiscal_years fy ON fy.id = rp.fiscal_year_id
       ORDER BY rp.fiscal_year_id DESC, rp.quarter_number ASC`
    )
    .all();
  const indicators = db.prepare('SELECT * FROM implementation_indicators ORDER BY indicator_no').all();
  const roles = db.prepare('SELECT * FROM roles ORDER BY id').all();
  const offices = db
    .prepare(
      `SELECT go.*, m.name_np AS ministry_name_np, m.name_en AS ministry_name_en,
              d.name_np AS department_name_np, p.name_np AS province_name_np, p.name_en AS province_name_en,
              dist.name_np AS district_name_np, dist.name_en AS district_name_en, dist.geo_key AS district_geo_key,
              ll.name_np AS local_level_name_np
       FROM government_offices go
       LEFT JOIN ministries m ON m.id = go.ministry_id
       LEFT JOIN departments d ON d.id = go.department_id
       JOIN provinces p ON p.id = go.province_id
       JOIN districts dist ON dist.id = go.district_id
       LEFT JOIN local_levels ll ON ll.id = go.local_level_id
       ORDER BY go.id`
    )
    .all();

  res.json({
    provinces,
    districts,
    local_levels,
    ministries,
    departments,
    fiscal_years,
    reporting_periods,
    indicators,
    roles,
    offices,
  });
});

// ========================
// HELPER FUNCTIONS FOR SUBMISSIONS
// ========================
function computeImplementationScore(
  summary: { total_services: number; prepared_forms: number; approved_forms: number; in_use_forms: number },
  indicators: Array<{ status: string }>
): number {
  let indPoints = 0;
  for (const ind of indicators) {
    if (ind.status === 'पूर्ण') indPoints += 100;
    else if (ind.status === 'आंशिक') indPoints += 50;
  }
  const indAvg = indicators.length > 0 ? indPoints / 9 : 0;
  const totalSvc = Math.max(1, summary.total_services);
  const formRate = Math.min(100, ((summary.in_use_forms || summary.prepared_forms) / totalSvc) * 100);
  return Math.round((indAvg * 0.7 + formRate * 0.3) * 10) / 10;
}

function loadFullSubmission(submissionId: number): SubmissionFull | null {
  const sub = db
    .prepare(
      `SELECT s.*, rp.fiscal_year_id, fy.code AS fiscal_year_code, fy.name_np AS fiscal_year_np,
              rp.quarter_number, rp.quarter_name_np, rp.quarter_name_en,
              rp.start_date_bs, rp.end_date_bs, rp.deadline_bs, rp.deadline_ad
       FROM submissions s
       JOIN reporting_periods rp ON rp.id = s.reporting_period_id
       JOIN fiscal_years fy ON fy.id = rp.fiscal_year_id
       WHERE s.id = ?`
    )
    .get(submissionId) as Record<string, unknown> | undefined;

  if (!sub) return null;

  const office = db
    .prepare(
      `SELECT go.*, m.name_np AS ministry_name_np, m.name_en AS ministry_name_en,
              d.name_np AS department_name_np, p.name_np AS province_name_np, p.name_en AS province_name_en,
              dist.name_np AS district_name_np, dist.name_en AS district_name_en, dist.geo_key AS district_geo_key,
              ll.name_np AS local_level_name_np
       FROM government_offices go
       LEFT JOIN ministries m ON m.id = go.ministry_id
       LEFT JOIN departments d ON d.id = go.department_id
       JOIN provinces p ON p.id = go.province_id
       JOIN districts dist ON dist.id = go.district_id
       LEFT JOIN local_levels ll ON ll.id = go.local_level_id
       WHERE go.id = ?`
    )
    .get(Number(sub.office_id)) as Record<string, unknown>;

  const summary = db.prepare('SELECT * FROM office_progress_summary WHERE submission_id = ?').get(submissionId) as
    | Record<string, unknown>
    | undefined;

  const indicators = db
    .prepare('SELECT * FROM indicator_responses WHERE submission_id = ? ORDER BY indicator_no')
    .all(submissionId) as Array<Record<string, unknown>>;

  const services = db
    .prepare('SELECT * FROM service_details WHERE submission_id = ? ORDER BY serial_no')
    .all(submissionId) as Array<Record<string, unknown>>;

  const monitoring = db.prepare('SELECT * FROM monitoring_details WHERE submission_id = ?').get(submissionId) as
    | Record<string, unknown>
    | undefined;

  const correctiveActions = db
    .prepare('SELECT * FROM corrective_actions WHERE submission_id = ? ORDER BY id')
    .all(submissionId) as Array<Record<string, unknown>>;

  const attachments = db
    .prepare(
      `SELECT sa.id, sa.submission_id, sa.indicator_no, sa.category, sa.file_name, sa.mime_type, sa.file_size,
              sa.uploaded_by, u.full_name_np AS uploaded_by_name, sa.uploaded_at
       FROM submission_attachments sa
       LEFT JOIN users u ON u.id = sa.uploaded_by
       WHERE sa.submission_id = ?
       ORDER BY sa.uploaded_at DESC`
    )
    .all(submissionId) as Array<Record<string, unknown>>;

  const certifications = db
    .prepare('SELECT * FROM certifications WHERE submission_id = ?')
    .all(submissionId) as Array<Record<string, unknown>>;

  const rawFeedbacks = db
    .prepare(
      `SELECT f.*, u.full_name_np AS author_name_np, r.name_np AS author_role
       FROM feedbacks f
       JOIN users u ON u.id = f.author_id
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE f.submission_id = ?
       ORDER BY f.created_at DESC`
    )
    .all(submissionId) as Array<Record<string, unknown>>;

  const feedbacks = rawFeedbacks.map((fb) => {
    const replies = db
      .prepare(
        `SELECT fr.*, u.full_name_np AS user_name_np, r.name_np AS user_role
         FROM feedback_replies fr
         JOIN users u ON u.id = fr.user_id
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE fr.feedback_id = ?
         ORDER BY fr.created_at ASC`
      )
      .all(Number(fb.id)) as Array<Record<string, unknown>>;

    return {
      id: Number(fb.id),
      submission_id: Number(fb.submission_id),
      author_id: Number(fb.author_id),
      author_name_np: String(fb.author_name_np),
      author_role: String(fb.author_role),
      scope_type: fb.scope_type as 'overall' | 'section' | 'indicator' | 'service' | 'directive',
      scope_ref: String(fb.scope_ref || ''),
      message: String(fb.message),
      is_directive: Boolean(fb.is_directive),
      requires_evidence: Boolean(fb.requires_evidence),
      created_at: String(fb.created_at),
      replies: replies.map((rp) => ({
        id: Number(rp.id),
        feedback_id: Number(rp.feedback_id),
        user_id: Number(rp.user_id),
        user_name_np: String(rp.user_name_np),
        user_role: String(rp.user_role),
        message: String(rp.message),
        attachment_id: rp.attachment_id ? Number(rp.attachment_id) : null,
        created_at: String(rp.created_at),
      })),
    };
  });

  const status_history = db
    .prepare('SELECT * FROM submission_status_history WHERE submission_id = ? ORDER BY id DESC')
    .all(submissionId) as Array<Record<string, unknown>>;

  const versions = db
    .prepare('SELECT * FROM submission_versions WHERE submission_id = ? ORDER BY version_no DESC')
    .all(submissionId) as Array<Record<string, unknown>>;

  return {
    id: Number(sub.id),
    office_id: Number(sub.office_id),
    reporting_period_id: Number(sub.reporting_period_id),
    fiscal_year_id: Number(sub.fiscal_year_id),
    fiscal_year_np: String(sub.fiscal_year_np),
    fiscal_year_code: String(sub.fiscal_year_code),
    quarter_number: Number(sub.quarter_number) as 1 | 2 | 3 | 4,
    quarter_name_np: String(sub.quarter_name_np),
    quarter_name_en: String(sub.quarter_name_en),
    start_date_bs: String(sub.start_date_bs),
    end_date_bs: String(sub.end_date_bs),
    deadline_bs: String(sub.deadline_bs),
    deadline_ad: String(sub.deadline_ad),
    status: sub.status as SubmissionStatus,
    version_no: Number(sub.version_no),
    is_timely: Boolean(sub.is_timely),
    submitted_at: sub.submitted_at ? String(sub.submitted_at) : null,
    reviewed_at: sub.reviewed_at ? String(sub.reviewed_at) : null,
    implementation_score: Number(sub.implementation_score || 0),
    updated_at: String(sub.updated_at),
    office: {
      id: Number(office.id),
      office_code: String(office.office_code),
      name_np: String(office.name_np),
      name_en: String(office.name_en),
      office_type_np: String(office.office_type_np),
      office_type_en: String(office.office_type_en),
      govt_level: office.govt_level as 'federal' | 'provincial' | 'local',
      ministry_id: office.ministry_id ? Number(office.ministry_id) : null,
      ministry_name_np: office.ministry_name_np ? String(office.ministry_name_np) : null,
      ministry_name_en: office.ministry_name_en ? String(office.ministry_name_en) : null,
      department_id: office.department_id ? Number(office.department_id) : null,
      department_name_np: office.department_name_np ? String(office.department_name_np) : null,
      province_id: Number(office.province_id),
      province_name_np: String(office.province_name_np),
      province_name_en: String(office.province_name_en),
      district_id: Number(office.district_id),
      district_name_np: String(office.district_name_np),
      district_name_en: String(office.district_name_en),
      district_geo_key: String(office.district_geo_key),
      local_level_id: office.local_level_id ? Number(office.local_level_id) : null,
      local_level_name_np: office.local_level_name_np ? String(office.local_level_name_np) : null,
      address_np: String(office.address_np),
      address_en: String(office.address_en),
      office_head_name: String(office.office_head_name),
      office_head_designation: String(office.office_head_designation),
      contact_phone: String(office.contact_phone),
      email: String(office.email),
      website: String(office.website || ''),
      is_active: Boolean(office.is_active),
    },
    summary: summary
      ? {
          office_name: String(summary.office_name),
          address: String(summary.address),
          contact_info: String(summary.contact_info),
          level_ministry: String(summary.level_ministry),
          office_head: String(summary.office_head),
          total_services: Number(summary.total_services),
          prepared_forms: Number(summary.prepared_forms),
          approved_forms: Number(summary.approved_forms),
          in_use_forms: Number(summary.in_use_forms),
          free_available_forms: Number(summary.free_available_forms),
          digital_available_forms: Number(summary.digital_available_forms),
          major_achievements: String(summary.major_achievements || ''),
          exception_approved: Boolean(summary.exception_approved),
          exception_reason: String(summary.exception_reason || ''),
        }
      : {
          office_name: String(office.name_np),
          address: String(office.address_np),
          contact_info: `${office.contact_phone} / ${office.email}`,
          level_ministry: String(office.ministry_name_np || ''),
          office_head: String(office.office_head_name),
          total_services: 0,
          prepared_forms: 0,
          approved_forms: 0,
          in_use_forms: 0,
          free_available_forms: 0,
          digital_available_forms: 0,
          major_achievements: '',
          exception_approved: false,
          exception_reason: '',
        },
    indicators: indicators.map((i) => ({
      id: Number(i.id),
      indicator_id: Number(i.indicator_id),
      indicator_no: Number(i.indicator_no),
      status: (i.status || '') as IndicatorResponse['status'],
      remarks: String(i.remarks || ''),
      evidence_details: String(i.evidence_details || ''),
      attachment_id: i.attachment_id ? Number(i.attachment_id) : null,
    })),
    services: services.map((sv) => ({
      id: Number(sv.id),
      serial_no: Number(sv.serial_no),
      service_name: String(sv.service_name || ''),
      is_prepared: Boolean(sv.is_prepared),
      is_approved: Boolean(sv.is_approved),
      is_in_use: Boolean(sv.is_in_use),
      approval_date: String(sv.approval_date || ''),
      is_free: Boolean(sv.is_free),
      is_notice_board: Boolean(sv.is_notice_board),
      is_website: Boolean(sv.is_website),
      website_url: String(sv.website_url || ''),
      received_count: Number(sv.received_count || 0),
      disposed_count: Number(sv.disposed_count || 0),
      pending_count: Number(sv.pending_count || 0),
      returned_count: Number(sv.returned_count || 0),
      within_deadline_count: Number(sv.within_deadline_count || 0),
      prescribed_timeline: String(sv.prescribed_timeline || ''),
      remarks: String(sv.remarks || ''),
    })),
    monitoring: monitoring
      ? {
          monitoring_date: String(monitoring.monitoring_date || ''),
          monitoring_conclusion: String(monitoring.monitoring_conclusion || ''),
          previous_report_status: String(monitoring.previous_report_status || ''),
          center_directive_status: String(monitoring.center_directive_status || ''),
          improvements_made: String(monitoring.improvements_made || ''),
          evidence_approved_sample: Boolean(monitoring.evidence_approved_sample),
          evidence_website_notice: Boolean(monitoring.evidence_website_notice),
          evidence_service_record: Boolean(monitoring.evidence_service_record),
          evidence_other: Boolean(monitoring.evidence_other),
          evidence_other_text: String(monitoring.evidence_other_text || ''),
          privacy_confirmed: Boolean(monitoring.privacy_confirmed),
        }
      : {
          monitoring_date: '',
          monitoring_conclusion: '',
          previous_report_status: '',
          center_directive_status: '',
          improvements_made: '',
          evidence_approved_sample: false,
          evidence_website_notice: false,
          evidence_service_record: false,
          evidence_other: false,
          evidence_other_text: '',
          privacy_confirmed: false,
        },
    corrective_actions: correctiveActions.map((ca) => ({
      id: Number(ca.id),
      main_problem: String(ca.main_problem || ''),
      root_cause: String(ca.root_cause || ''),
      corrective_step: String(ca.corrective_step || ''),
      responsible_person: String(ca.responsible_person || ''),
      responsible_unit: String(ca.responsible_unit || ''),
      target_deadline: String(ca.target_deadline || ''),
      expected_facilitation: String(ca.expected_facilitation || ''),
      remarks: String(ca.remarks || ''),
    })),
    attachments: attachments.map((a) => ({
      id: Number(a.id),
      submission_id: Number(a.submission_id),
      indicator_no: a.indicator_no ? Number(a.indicator_no) : null,
      category: String(a.category),
      file_name: String(a.file_name),
      mime_type: String(a.mime_type),
      file_size: Number(a.file_size),
      uploaded_by: Number(a.uploaded_by),
      uploaded_by_name: a.uploaded_by_name ? String(a.uploaded_by_name) : '',
      uploaded_at: String(a.uploaded_at),
    })),
    certifications: certifications.map((c) => ({
      id: Number(c.id),
      tier: c.tier as 'preparer' | 'reviewer' | 'head',
      name_designation: String(c.name_designation || ''),
      signature_text: String(c.signature_text || ''),
      signed_date: String(c.signed_date || ''),
      office_stamp_confirmed: Boolean(c.office_stamp_confirmed),
      digital_pin_verified: Boolean(c.digital_pin_verified),
      signed_doc_attachment_id: c.signed_doc_attachment_id ? Number(c.signed_doc_attachment_id) : null,
    })),
    feedbacks,
    status_history: status_history.map((h) => ({
      id: Number(h.id),
      submission_id: Number(h.submission_id),
      from_status: h.from_status ? String(h.from_status) : null,
      to_status: String(h.to_status),
      changed_by_name: String(h.changed_by_name || ''),
      note: String(h.note || ''),
      created_at: String(h.created_at),
    })),
    versions: versions.map((v) => ({
      id: Number(v.id),
      submission_id: Number(v.submission_id),
      version_no: Number(v.version_no),
      submitted_by_name: String(v.submitted_by_name),
      submitted_at: String(v.submitted_at),
      summary_json: String(v.summary_json),
    })),
  };
}

// ========================
// SUBMISSIONS LIST & CRUD
// ========================
apiRouter.get('/submissions', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.authUser!;
  const officeIdFilter = req.query.officeId ? Number(req.query.officeId) : null;
  const periodIdFilter = req.query.periodId ? Number(req.query.periodId) : null;

  let where = 'WHERE 1=1';
  const params: Array<string | number> = [];

  if (user.role === 'office_user') {
    const ids = user.offices.map((o) => o.office_id);
    if (ids.length === 0) return res.json({ submissions: [] });
    where += ` AND s.office_id IN (${ids.map(() => '?').join(',')})`;
    params.push(...ids);
  } else if (user.role === 'ministry_user' && user.ministry_id) {
    where += ' AND go.ministry_id = ?';
    params.push(user.ministry_id);
  } else if (user.role === 'viewer_auditor') {
    if (user.province_id) {
      where += ' AND go.province_id = ?';
      params.push(user.province_id);
    }
    if (user.ministry_id) {
      where += ' AND go.ministry_id = ?';
      params.push(user.ministry_id);
    }
  }

  if (officeIdFilter) {
    where += ' AND s.office_id = ?';
    params.push(officeIdFilter);
  }
  if (periodIdFilter) {
    where += ' AND s.reporting_period_id = ?';
    params.push(periodIdFilter);
  }

  const rows = db
    .prepare(
      `SELECT s.id, s.office_id, go.office_code, go.name_np AS office_name_np, go.name_en AS office_name_en,
              go.govt_level, go.ministry_id, m.name_np AS ministry_name_np,
              go.province_id, p.name_np AS province_name_np, go.district_id, d.name_np AS district_name_np,
              d.geo_key AS district_geo_key, s.reporting_period_id, rp.fiscal_year_id,
              fy.name_np AS fiscal_year_np, rp.quarter_number, rp.quarter_name_np, rp.deadline_bs,
              s.status, s.version_no, s.is_timely, s.submitted_at, s.implementation_score,
              COALESCE(ops.total_services, 0) AS total_services,
              COALESCE(ops.prepared_forms, 0) AS prepared_forms,
              COALESCE(ops.approved_forms, 0) AS approved_forms,
              COALESCE(ops.in_use_forms, 0) AS in_use_forms,
              COALESCE((SELECT SUM(received_count) FROM service_details sd WHERE sd.submission_id = s.id), 0) AS total_received,
              COALESCE((SELECT SUM(disposed_count) FROM service_details sd WHERE sd.submission_id = s.id), 0) AS total_disposed,
              COALESCE((SELECT SUM(within_deadline_count) FROM service_details sd WHERE sd.submission_id = s.id), 0) AS total_within_deadline,
              (SELECT COUNT(*) FROM feedbacks fb WHERE fb.submission_id = s.id) AS feedback_count
       FROM submissions s
       JOIN government_offices go ON go.id = s.office_id
       LEFT JOIN ministries m ON m.id = go.ministry_id
       JOIN provinces p ON p.id = go.province_id
       JOIN districts d ON d.id = go.district_id
       JOIN reporting_periods rp ON rp.id = s.reporting_period_id
       JOIN fiscal_years fy ON fy.id = rp.fiscal_year_id
       LEFT JOIN office_progress_summary ops ON ops.submission_id = s.id
       ${where}
       ORDER BY rp.fiscal_year_id DESC, rp.quarter_number DESC, s.updated_at DESC`
    )
    .all(...params) as Array<Record<string, unknown>>;

  const submissions: SubmissionListItem[] = rows.map((r) => ({
    id: Number(r.id),
    office_id: Number(r.office_id),
    office_code: String(r.office_code),
    office_name_np: String(r.office_name_np),
    office_name_en: String(r.office_name_en),
    govt_level: r.govt_level as 'federal' | 'provincial' | 'local',
    ministry_id: r.ministry_id ? Number(r.ministry_id) : null,
    ministry_name_np: r.ministry_name_np ? String(r.ministry_name_np) : null,
    province_id: Number(r.province_id),
    province_name_np: String(r.province_name_np),
    district_id: Number(r.district_id),
    district_name_np: String(r.district_name_np),
    district_geo_key: String(r.district_geo_key),
    reporting_period_id: Number(r.reporting_period_id),
    fiscal_year_id: Number(r.fiscal_year_id),
    fiscal_year_np: String(r.fiscal_year_np),
    quarter_number: Number(r.quarter_number),
    quarter_name_np: String(r.quarter_name_np),
    deadline_bs: String(r.deadline_bs),
    status: r.status as SubmissionStatus,
    version_no: Number(r.version_no),
    is_timely: Boolean(r.is_timely),
    submitted_at: r.submitted_at ? String(r.submitted_at) : null,
    implementation_score: Number(r.implementation_score || 0),
    total_services: Number(r.total_services || 0),
    prepared_forms: Number(r.prepared_forms || 0),
    approved_forms: Number(r.approved_forms || 0),
    in_use_forms: Number(r.in_use_forms || 0),
    total_received: Number(r.total_received || 0),
    total_disposed: Number(r.total_disposed || 0),
    total_within_deadline: Number(r.total_within_deadline || 0),
    feedback_count: Number(r.feedback_count || 0),
  }));

  res.json({ submissions });
});

// Initialize or fetch draft for (office_id, reporting_period_id)
apiRouter.post('/submissions/init', requireAuth, requireRoles('office_user', 'super_admin', 'nvc_admin'), (req: AuthRequest, res: Response) => {
  const { office_id, reporting_period_id } = req.body || {};
  const offId = Number(office_id);
  const perId = Number(reporting_period_id);
  if (!offId || !perId) {
    return res.status(400).json({ error: 'office_id and reporting_period_id are required.' });
  }

  const office = db
    .prepare(
      `SELECT go.*, m.name_np AS ministry_name_np FROM government_offices go
       LEFT JOIN ministries m ON m.id = go.ministry_id
       WHERE go.id = ?`
    )
    .get(offId) as Record<string, unknown> | undefined;
  if (!office) return res.status(404).json({ error: 'Office not found.' });

  if (!canUserAccessOffice(req.authUser!, offId, office.ministry_id ? Number(office.ministry_id) : null, Number(office.province_id))) {
    return res.status(403).json({ error: 'Forbidden: No access to this office.' });
  }

  const period = db.prepare('SELECT * FROM reporting_periods WHERE id = ?').get(perId) as Record<string, unknown> | undefined;
  if (!period) return res.status(404).json({ error: 'Reporting period not found.' });

  const existing = db
    .prepare('SELECT id FROM submissions WHERE office_id = ? AND reporting_period_id = ?')
    .get(offId, perId) as { id: number } | undefined;

  if (existing) {
    const full = loadFullSubmission(existing.id);
    return res.json({ submission: full });
  }

  if (period.status === 'closed' && req.authUser!.role === 'office_user') {
    return res.status(400).json({ error: 'यो त्रैमासिक प्रतिवेदन अवधि बन्द गरिएको छ।' });
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    const subRes = db
      .prepare("INSERT INTO submissions (office_id, reporting_period_id, status, version_no, is_timely) VALUES (?, ?, 'Draft', 1, 1)")
      .run(offId, perId);
    const subId = Number(subRes.lastInsertRowid);

    const lvlLabel = office.govt_level === 'federal' ? 'संघ' : office.govt_level === 'provincial' ? 'प्रदेश' : 'स्थानीय';
    db.prepare(
      `INSERT INTO office_progress_summary (submission_id, office_name, address, contact_info, level_ministry, office_head)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      subId,
      String(office.name_np),
      String(office.address_np),
      `${office.contact_phone} / ${office.email}`,
      `${lvlLabel} / ${office.ministry_name_np || ''}`,
      String(office.office_head_name)
    );

    const insInd = db.prepare('INSERT INTO indicator_responses (submission_id, indicator_id, indicator_no, status, remarks, evidence_details) VALUES (?, ?, ?, ?, ?, ?)');
    for (let k = 1; k <= 9; k++) {
      insInd.run(subId, k, k, '', '', '');
    }

    const insSvc = db.prepare('INSERT INTO service_details (submission_id, serial_no) VALUES (?, ?)');
    for (let s = 1; s <= 6; s++) {
      insSvc.run(subId, s);
    }

    db.prepare('INSERT INTO monitoring_details (submission_id) VALUES (?)').run(subId);
    db.prepare('INSERT INTO corrective_actions (submission_id) VALUES (?)').run(subId);

    const insCert = db.prepare('INSERT INTO certifications (submission_id, tier) VALUES (?, ?)');
    insCert.run(subId, 'preparer');
    insCert.run(subId, 'reviewer');
    insCert.run(subId, 'head');

    db.prepare(
      'INSERT INTO submission_status_history (submission_id, from_status, to_status, changed_by, changed_by_name, note) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(subId, null, 'Draft', req.authUser!.id, req.authUser!.full_name_np, 'प्रारम्भिक मस्यौदा सिर्जना गरियो।');

    db.exec('COMMIT;');
    const full = loadFullSubmission(subId);
    res.status(201).json({ submission: full });
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Init submission error:', err);
    res.status(500).json({ error: 'Failed to initialize submission.' });
  }
});

apiRouter.get('/submissions/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const subId = Number(req.params.id);
  const full = loadFullSubmission(subId);
  if (!full) return res.status(404).json({ error: 'Submission not found.' });

  if (!canUserAccessOffice(req.authUser!, full.office_id, full.office.ministry_id, full.office.province_id)) {
    return res.status(403).json({ error: 'Forbidden: No access to this submission.' });
  }

  // Also fetch previous quarter submission summary for comparison if available
  const prevRow = db
    .prepare(
      `SELECT s.id, fy.name_np AS fiscal_year_np, rp.quarter_name_np, s.implementation_score,
              ops.total_services, ops.prepared_forms, ops.approved_forms, ops.in_use_forms
       FROM submissions s
       JOIN reporting_periods rp ON rp.id = s.reporting_period_id
       JOIN fiscal_years fy ON fy.id = rp.fiscal_year_id
       LEFT JOIN office_progress_summary ops ON ops.submission_id = s.id
       WHERE s.office_id = ? AND s.reporting_period_id < ? AND s.status NOT IN ('Not Started', 'Overdue')
       ORDER BY s.reporting_period_id DESC
       LIMIT 1`
    )
    .get(full.office_id, full.reporting_period_id) as Record<string, unknown> | undefined;

  res.json({ submission: full, previousQuarter: prevRow || null });
});

function saveSubmissionPayload(subId: number, body: Record<string, unknown>) {
  const summary = (body.summary || {}) as Record<string, unknown>;
  const indicators = Array.isArray(body.indicators) ? (body.indicators as IndicatorResponse[]) : [];
  const services = Array.isArray(body.services) ? (body.services as ServiceDetail[]) : [];
  const monitoring = (body.monitoring || {}) as Record<string, unknown>;
  const correctiveActions = Array.isArray(body.corrective_actions)
    ? (body.corrective_actions as Array<Record<string, unknown>>)
    : [];
  const certifications = Array.isArray(body.certifications)
    ? (body.certifications as Array<Record<string, unknown>>)
    : [];

  const totalSvc = Math.max(0, Math.floor(Number(summary.total_services) || 0));
  const prep = Math.max(0, Math.floor(Number(summary.prepared_forms) || 0));
  const appr = Math.max(0, Math.floor(Number(summary.approved_forms) || 0));
  const inUse = Math.max(0, Math.floor(Number(summary.in_use_forms) || 0));
  const freeAv = Math.max(0, Math.floor(Number(summary.free_available_forms) || 0));
  const digAv = Math.max(0, Math.floor(Number(summary.digital_available_forms) || 0));

  db.prepare(
    `UPDATE office_progress_summary
     SET office_name = ?, address = ?, contact_info = ?, level_ministry = ?, office_head = ?,
         total_services = ?, prepared_forms = ?, approved_forms = ?, in_use_forms = ?,
         free_available_forms = ?, digital_available_forms = ?, major_achievements = ?
     WHERE submission_id = ?`
  ).run(
    String(summary.office_name || ''),
    String(summary.address || ''),
    String(summary.contact_info || ''),
    String(summary.level_ministry || ''),
    String(summary.office_head || ''),
    totalSvc,
    prep,
    appr,
    inUse,
    freeAv,
    digAv,
    String(summary.major_achievements || ''),
    subId
  );

  const updInd = db.prepare(
    `UPDATE indicator_responses SET status = ?, remarks = ?, evidence_details = ? WHERE submission_id = ? AND indicator_no = ?`
  );
  for (const ind of indicators) {
    updInd.run(
      String(ind.status || ''),
      String(ind.remarks || ''),
      String(ind.evidence_details || ''),
      subId,
      Number(ind.indicator_no)
    );
  }

  db.prepare('DELETE FROM service_details WHERE submission_id = ?').run(subId);
  const insSvc = db.prepare(
    `INSERT INTO service_details (submission_id, serial_no, service_name, is_prepared, is_approved, is_in_use, approval_date, is_free, is_notice_board, is_website, website_url, received_count, disposed_count, pending_count, returned_count, within_deadline_count, prescribed_timeline, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  services.forEach((sv, idx) => {
    insSvc.run(
      subId,
      idx + 1,
      String(sv.service_name || ''),
      sv.is_prepared ? 1 : 0,
      sv.is_approved ? 1 : 0,
      sv.is_in_use ? 1 : 0,
      String(sv.approval_date || ''),
      sv.is_free ? 1 : 0,
      sv.is_notice_board ? 1 : 0,
      sv.is_website ? 1 : 0,
      String(sv.website_url || ''),
      Math.max(0, Math.floor(Number(sv.received_count) || 0)),
      Math.max(0, Math.floor(Number(sv.disposed_count) || 0)),
      Math.max(0, Math.floor(Number(sv.pending_count) || 0)),
      Math.max(0, Math.floor(Number(sv.returned_count) || 0)),
      Math.max(0, Math.floor(Number(sv.within_deadline_count) || 0)),
      String(sv.prescribed_timeline || ''),
      String(sv.remarks || '')
    );
  });

  db.prepare(
    `UPDATE monitoring_details
     SET monitoring_date = ?, monitoring_conclusion = ?, previous_report_status = ?,
         center_directive_status = ?, improvements_made = ?, evidence_approved_sample = ?,
         evidence_website_notice = ?, evidence_service_record = ?, evidence_other = ?,
         evidence_other_text = ?, privacy_confirmed = ?
     WHERE submission_id = ?`
  ).run(
    String(monitoring.monitoring_date || ''),
    String(monitoring.monitoring_conclusion || ''),
    String(monitoring.previous_report_status || ''),
    String(monitoring.center_directive_status || ''),
    String(monitoring.improvements_made || ''),
    monitoring.evidence_approved_sample ? 1 : 0,
    monitoring.evidence_website_notice ? 1 : 0,
    monitoring.evidence_service_record ? 1 : 0,
    monitoring.evidence_other ? 1 : 0,
    String(monitoring.evidence_other_text || ''),
    monitoring.privacy_confirmed ? 1 : 0,
    subId
  );

  db.prepare('DELETE FROM corrective_actions WHERE submission_id = ?').run(subId);
  const insCorr = db.prepare(
    `INSERT INTO corrective_actions (submission_id, main_problem, root_cause, corrective_step, responsible_person, responsible_unit, target_deadline, expected_facilitation, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  if (correctiveActions.length === 0) {
    insCorr.run(subId, '', '', '', '', '', '', '', '');
  } else {
    for (const ca of correctiveActions) {
      insCorr.run(
        subId,
        String(ca.main_problem || ''),
        String(ca.root_cause || ''),
        String(ca.corrective_step || ''),
        String(ca.responsible_person || ''),
        String(ca.responsible_unit || ''),
        String(ca.target_deadline || ''),
        String(ca.expected_facilitation || ''),
        String(ca.remarks || '')
      );
    }
  }

  const updCert = db.prepare(
    `UPDATE certifications
     SET name_designation = ?, signature_text = ?, signed_date = ?, office_stamp_confirmed = ?, digital_pin_verified = ?
     WHERE submission_id = ? AND tier = ?`
  );
  for (const c of certifications) {
    updCert.run(
      String(c.name_designation || ''),
      String(c.signature_text || ''),
      String(c.signed_date || ''),
      c.office_stamp_confirmed ? 1 : 0,
      c.digital_pin_verified ? 1 : 0,
      subId,
      String(c.tier)
    );
  }

  const score = computeImplementationScore(
    { total_services: totalSvc, prepared_forms: prep, approved_forms: appr, in_use_forms: inUse },
    indicators
  );
  db.prepare("UPDATE submissions SET implementation_score = ?, updated_at = datetime('now') WHERE id = ?").run(score, subId);
}

// Save Draft
apiRouter.put('/submissions/:id/draft', requireAuth, requireRoles('office_user', 'super_admin', 'nvc_admin'), (req: AuthRequest, res: Response) => {
  const subId = Number(req.params.id);
  const full = loadFullSubmission(subId);
  if (!full) return res.status(404).json({ error: 'Submission not found.' });

  if (!canUserAccessOffice(req.authUser!, full.office_id, full.office.ministry_id, full.office.province_id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (
    req.authUser!.role === 'office_user' &&
    !['Not Started', 'Draft', 'Returned for Correction', 'Overdue'].includes(full.status)
  ) {
    return res.status(400).json({ error: 'पेश भइसकेको प्रतिवेदन संशोधन गर्न केन्द्रबाट फिर्ता भएको हुनुपर्छ।' });
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    saveSubmissionPayload(subId, req.body || {});
    if (full.status === 'Not Started' || full.status === 'Overdue') {
      db.prepare("UPDATE submissions SET status = 'Draft' WHERE id = ?").run(subId);
    }
    db.exec('COMMIT;');
    const updated = loadFullSubmission(subId);
    res.json({ submission: updated });
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Draft save error:', err);
    res.status(500).json({ error: 'Failed to save draft.' });
  }
});

// Final Submit / Resubmit
apiRouter.post('/submissions/:id/submit', requireAuth, requireRoles('office_user', 'super_admin', 'nvc_admin'), (req: AuthRequest, res: Response) => {
  const subId = Number(req.params.id);
  const full = loadFullSubmission(subId);
  if (!full) return res.status(404).json({ error: 'Submission not found.' });

  if (!canUserAccessOffice(req.authUser!, full.office_id, full.office.ministry_id, full.office.province_id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (
    req.authUser!.role === 'office_user' &&
    !['Not Started', 'Draft', 'Returned for Correction', 'Overdue'].includes(full.status)
  ) {
    return res.status(400).json({ error: 'यो प्रतिवेदन हालको अवस्थामा पेश गर्न मिल्दैन।' });
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    if (req.body && req.body.summary) {
      saveSubmissionPayload(subId, req.body);
    }
    const fresh = loadFullSubmission(subId)!;

    // Server-side validations per specification
    const s = fresh.summary;
    if (!s.exception_approved) {
      if (s.prepared_forms > s.total_services) {
        db.exec('ROLLBACK;');
        return res.status(400).json({ error: 'तयार भएका ढाँचा कुल सार्वजनिक सेवाको संख्याभन्दा बढी हुन सक्दैन।' });
      }
      if (s.approved_forms > s.prepared_forms) {
        db.exec('ROLLBACK;');
        return res.status(400).json({ error: 'स्वीकृत संख्या तयार भएको संख्याभन्दा बढी हुन सक्दैन।' });
      }
      if (s.in_use_forms > s.approved_forms) {
        db.exec('ROLLBACK;');
        return res.status(400).json({ error: 'प्रयोगमा आएको संख्या स्वीकृत संख्याभन्दा बढी हुन सक्दैन।' });
      }
    }

    for (const ind of fresh.indicators) {
      if (!ind.status) {
        db.exec('ROLLBACK;');
        return res.status(400).json({ error: `सूचक नं. ${ind.indicator_no} को अवस्था छान्नु अनिवार्य छ।` });
      }
    }

    const activeServices = fresh.services.filter((sv) => sv.service_name.trim().length > 0);
    if (activeServices.length === 0) {
      db.exec('ROLLBACK;');
      return res.status(400).json({ error: 'खण्ड ३ मा कम्तीमा एक सेवाको विवरण भर्नुहोस्।' });
    }

    for (const sv of activeServices) {
      if (sv.received_count !== sv.disposed_count + sv.pending_count + sv.returned_count) {
        db.exec('ROLLBACK;');
        return res.status(400).json({
          error: `सेवा "${sv.service_name}" मा प्राप्त निवेदन संख्या (${sv.received_count}) = फर्छ्योट + बाँकी + फिर्ता (${
            sv.disposed_count + sv.pending_count + sv.returned_count
          }) सँग बराबर हुनुपर्छ।`,
        });
      }
      if (sv.within_deadline_count > sv.disposed_count) {
        db.exec('ROLLBACK;');
        return res.status(400).json({
          error: `सेवा "${sv.service_name}" मा समयसीमाभित्र फर्छ्योट संख्या कुल फर्छ्योट संख्याभन्दा बढी हुन सक्दैन।`,
        });
      }
    }

    const headCert = fresh.certifications.find((c) => c.tier === 'head');
    if (!headCert || !headCert.name_designation.trim() || !headCert.signed_date.trim() || !headCert.digital_pin_verified) {
      db.exec('ROLLBACK;');
      return res.status(400).json({
        error: 'कार्यालय प्रमुख वा अधिकारप्राप्त अधिकारीबाट अन्तिम प्रमाणीकरण (नाम/पद, मिति तथा डिजिटल स्वीकृति) नभएसम्म प्रतिवेदन पेश गर्न मिल्दैन।',
      });
    }

    const nextStatus: SubmissionStatus = full.status === 'Returned for Correction' ? 'Resubmitted' : 'Submitted';
    const nextVersion = full.status === 'Returned for Correction' ? full.version_no + 1 : full.version_no;
    const isTimely = new Date().toISOString().slice(0, 10) <= fresh.deadline_ad ? 1 : 0;

    db.prepare(
      `UPDATE submissions
       SET status = ?, version_no = ?, is_timely = ?, submitted_by = ?, submitted_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    ).run(nextStatus, nextVersion, isTimely, req.authUser!.id, subId);

    db.prepare(
      `INSERT INTO submission_status_history (submission_id, from_status, to_status, changed_by, changed_by_name, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      subId,
      full.status,
      nextStatus,
      req.authUser!.id,
      req.authUser!.full_name_np,
      nextStatus === 'Resubmitted' ? 'सुधार गरी पुनः पेश गरिएको।' : 'अन्तिम प्रतिवेदन पेश गरिएको।'
    );

    db.prepare(
      `INSERT INTO submission_versions (submission_id, version_no, submitted_by_name, summary_json)
       VALUES (?, ?, ?, ?)`
    ).run(subId, nextVersion, req.authUser!.full_name_np, JSON.stringify({ summary: fresh.summary, services_count: activeServices.length }));

    // Notify NVC Admins & Reviewers
    const nvcStaff = db
      .prepare(
        `SELECT u.id FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE r.code IN ('nvc_admin', 'review_officer')`
      )
      .all() as Array<{ id: number }>;

    const insNotif = db.prepare(
      `INSERT INTO notifications (user_id, office_id, title_np, title_en, message_np, message_en, type, link_submission_id)
       VALUES (?, NULL, ?, ?, ?, ?, 'info', ?)`
    );
    for (const st of nvcStaff) {
      insNotif.run(
        st.id,
        nextStatus === 'Resubmitted' ? 'प्रतिवेदन पुनः पेश भयो' : 'नयाँ त्रैमासिक प्रतिवेदन प्राप्त',
        nextStatus === 'Resubmitted' ? 'Report Resubmitted' : 'New Report Submitted',
        `${fresh.office.name_np} ले आ.व. ${fresh.fiscal_year_np} ${fresh.quarter_name_np} को प्रतिवेदन पेश गरेको छ।`,
        `${fresh.office.name_en} submitted report for FY ${fresh.fiscal_year_code} Q${fresh.quarter_number}.`,
        subId
      );
    }

    writeAuditLog(req.authUser!.id, 'SUBMIT_REPORT', 'submission', subId, { status: nextStatus, version_no: nextVersion }, req.ip || '');
    db.exec('COMMIT;');
    res.json({ submission: loadFullSubmission(subId) });
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Failed to submit report.' });
  }
});

// Change Status / Review Action (Center Officer / NVC Admin / Super Admin)
apiRouter.post('/submissions/:id/status', requireAuth, requireRoles('super_admin', 'nvc_admin', 'review_officer'), (req: AuthRequest, res: Response) => {
  const subId = Number(req.params.id);
  const { status, note } = req.body || {};
  const allowedStatuses: SubmissionStatus[] = ['Under Review', 'Returned for Correction', 'Reviewed', 'Accepted'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid review status transition.' });
  }

  const full = loadFullSubmission(subId);
  if (!full) return res.status(404).json({ error: 'Submission not found.' });

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare(
      `UPDATE submissions
       SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    ).run(status, req.authUser!.id, subId);

    db.prepare('INSERT INTO reviews (submission_id, reviewer_id, decision, overall_remarks) VALUES (?, ?, ?, ?)').run(
      subId,
      req.authUser!.id,
      status,
      String(note || '')
    );

    db.prepare(
      `INSERT INTO submission_status_history (submission_id, from_status, to_status, changed_by, changed_by_name, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(subId, full.status, status, req.authUser!.id, req.authUser!.full_name_np, String(note || ''));

    const notifTitleNp =
      status === 'Returned for Correction'
        ? 'प्रतिवेदन सुधारका लागि फिर्ता गरियो'
        : status === 'Accepted'
        ? 'प्रतिवेदन स्वीकृत तथा अभिलेखीकरण गरियो'
        : `प्रतिवेदनको अवस्था: ${status}`;
    const notifTitleEn =
      status === 'Returned for Correction'
        ? 'Report Returned for Correction'
        : status === 'Accepted'
        ? 'Report Accepted'
        : `Report Status: ${status}`;

    db.prepare(
      `INSERT INTO notifications (user_id, office_id, title_np, title_en, message_np, message_en, type, link_submission_id)
       VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      full.office_id,
      notifTitleNp,
      notifTitleEn,
      `${full.fiscal_year_np} ${full.quarter_name_np}: ${note || notifTitleNp}`,
      `${full.fiscal_year_code} Q${full.quarter_number}: ${note || notifTitleEn}`,
      status === 'Returned for Correction' ? 'warning' : 'success',
      subId
    );

    writeAuditLog(req.authUser!.id, 'CHANGE_SUBMISSION_STATUS', 'submission', subId, { from: full.status, to: status }, req.ip || '');
    db.exec('COMMIT;');
    res.json({ submission: loadFullSubmission(subId) });
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Status update error:', err);
    res.status(500).json({ error: 'Failed to update status.' });
  }
});

// Admin Exception Override for Section 1B validation
apiRouter.post('/submissions/:id/exception', requireAuth, requireRoles('super_admin', 'nvc_admin'), (req: AuthRequest, res: Response) => {
  const subId = Number(req.params.id);
  const { exception_approved, exception_reason } = req.body || {};
  db.prepare('UPDATE office_progress_summary SET exception_approved = ?, exception_reason = ? WHERE submission_id = ?').run(
    exception_approved ? 1 : 0,
    String(exception_reason || ''),
    subId
  );
  writeAuditLog(req.authUser!.id, 'ADMIN_EXCEPTION_UPDATE', 'submission', subId, { exception_approved, exception_reason }, req.ip || '');
  res.json({ submission: loadFullSubmission(subId) });
});

// ========================
// ATTACHMENTS (PDF / JPG / JPEG / PNG with magic byte check)
// ========================
function validateFileSignature(buffer: Buffer, mimeType: string, ext: string): boolean {
  if (buffer.length < 4) return false;
  if (mimeType === 'application/pdf' && ext === '.pdf') {
    return buffer.subarray(0, 4).toString('ascii') === '%PDF';
  }
  if ((mimeType === 'image/jpeg' || mimeType === 'image/jpg') && (ext === '.jpg' || ext === '.jpeg')) {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png' && ext === '.png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  return false;
}

apiRouter.post('/submissions/:id/attachments', requireAuth, requireRoles('office_user', 'super_admin', 'nvc_admin'), (req: AuthRequest, res: Response) => {
  const subId = Number(req.params.id);
  const full = loadFullSubmission(subId);
  if (!full) return res.status(404).json({ error: 'Submission not found.' });

  if (!canUserAccessOffice(req.authUser!, full.office_id, full.office.ministry_id, full.office.province_id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { fileName, mimeType, base64Data, category, indicatorNo } = req.body || {};
  if (typeof fileName !== 'string' || typeof mimeType !== 'string' || typeof base64Data !== 'string') {
    return res.status(400).json({ error: 'Invalid upload payload.' });
  }

  const safeBaseName = path.basename(fileName).replace(/[^a-zA-Z0-9._\-\u0900-\u097F ]/g, '_');
  const ext = path.extname(safeBaseName).toLowerCase();
  if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) {
    return res.status(400).json({ error: 'केवल PDF, JPG, JPEG वा PNG फाइल मात्र अपलोड गर्न पाइन्छ।' });
  }

  const cleanB64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const buf = Buffer.from(cleanB64, 'base64');
  if (buf.length === 0 || buf.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'फाइल साइज अधिकतम ५ MB भित्र हुनुपर्छ।' });
  }
  if (!validateFileSignature(buf, mimeType.toLowerCase(), ext)) {
    return res.status(400).json({ error: 'फाइल ढाँचा (signature) मान्य भएन। कृपया वास्तविक PDF, JPG वा PNG अपलोड गर्नुहोस्।' });
  }

  const storedName = `${crypto.randomUUID()}${ext}`;
  const targetPath = path.resolve(UPLOADS_DIR, storedName);
  if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
    return res.status(400).json({ error: 'Invalid file path.' });
  }

  fs.writeFileSync(targetPath, buf);
  const ins = db
    .prepare(
      `INSERT INTO submission_attachments (submission_id, indicator_no, category, file_name, stored_name, mime_type, file_size, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(subId, indicatorNo ? Number(indicatorNo) : null, String(category || 'general'), safeBaseName, storedName, mimeType.toLowerCase(), buf.length, req.authUser!.id);

  writeAuditLog(req.authUser!.id, 'UPLOAD_ATTACHMENT', 'attachment', Number(ins.lastInsertRowid), { fileName: safeBaseName, subId }, req.ip || '');
  res.status(201).json({ submission: loadFullSubmission(subId), attachmentId: Number(ins.lastInsertRowid) });
});

apiRouter.get('/attachments/:id/file', requireAuth, (req: AuthRequest, res: Response) => {
  const attId = Number(req.params.id);
  const row = db
    .prepare(
      `SELECT sa.*, s.office_id, go.ministry_id, go.province_id
       FROM submission_attachments sa
       JOIN submissions s ON s.id = sa.submission_id
       JOIN government_offices go ON go.id = s.office_id
       WHERE sa.id = ?`
    )
    .get(attId) as Record<string, unknown> | undefined;

  if (!row) return res.status(404).json({ error: 'Attachment not found.' });
  if (!canUserAccessOffice(req.authUser!, Number(row.office_id), row.ministry_id ? Number(row.ministry_id) : null, Number(row.province_id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const resolvedPath = path.resolve(UPLOADS_DIR, String(row.stored_name));
  if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: 'File missing on server.' });
  }

  res.setHeader('Content-Type', String(row.mime_type));
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(String(row.file_name))}"`);
  fs.createReadStream(resolvedPath).pipe(res);
});

apiRouter.delete('/attachments/:id', requireAuth, requireRoles('office_user', 'super_admin', 'nvc_admin'), (req: AuthRequest, res: Response) => {
  const attId = Number(req.params.id);
  const row = db
    .prepare(
      `SELECT sa.*, s.office_id, s.status, go.ministry_id, go.province_id
       FROM submission_attachments sa
       JOIN submissions s ON s.id = sa.submission_id
       JOIN government_offices go ON go.id = s.office_id
       WHERE sa.id = ?`
    )
    .get(attId) as Record<string, unknown> | undefined;

  if (!row) return res.status(404).json({ error: 'Attachment not found.' });
  if (!canUserAccessOffice(req.authUser!, Number(row.office_id), row.ministry_id ? Number(row.ministry_id) : null, Number(row.province_id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.authUser!.role === 'office_user' && !['Draft', 'Returned for Correction'].includes(String(row.status))) {
    return res.status(400).json({ error: 'पेश भइसकेको प्रतिवेदनको प्रमाण मेटाउन मिल्दैन।' });
  }

  const resolvedPath = path.resolve(UPLOADS_DIR, String(row.stored_name));
  if (resolvedPath.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(resolvedPath)) {
    fs.unlinkSync(resolvedPath);
  }
  db.prepare('DELETE FROM submission_attachments WHERE id = ?').run(attId);
  res.json({ submission: loadFullSubmission(Number(row.submission_id)) });
});

// ========================
// TWO-WAY FEEDBACK SYSTEM
// ========================
apiRouter.post('/submissions/:id/feedbacks', requireAuth, requireRoles('super_admin', 'nvc_admin', 'review_officer', 'ministry_user'), (req: AuthRequest, res: Response) => {
  const subId = Number(req.params.id);
  const { scope_type, scope_ref, message, is_directive, requires_evidence } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Feedback message is required.' });
  }

  const full = loadFullSubmission(subId);
  if (!full) return res.status(404).json({ error: 'Submission not found.' });
  if (!canUserAccessOffice(req.authUser!, full.office_id, full.office.ministry_id, full.office.province_id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.prepare(
    `INSERT INTO feedbacks (submission_id, author_id, scope_type, scope_ref, message, is_directive, requires_evidence)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    subId,
    req.authUser!.id,
    String(scope_type || 'overall'),
    String(scope_ref || ''),
    message.trim(),
    is_directive ? 1 : 0,
    requires_evidence ? 1 : 0
  );

  db.prepare(
    `INSERT INTO notifications (user_id, office_id, title_np, title_en, message_np, message_en, type, link_submission_id)
     VALUES (NULL, ?, ?, ?, ?, ?, 'feedback', ?)`
  ).run(
    full.office_id,
    'केन्द्रबाट नयाँ टिप्पणी/निर्देशन प्राप्त',
    'New Feedback/Directive Received',
    `${req.authUser!.full_name_np}: ${message.trim().slice(0, 120)}`,
    `${req.authUser!.full_name_en}: ${message.trim().slice(0, 120)}`,
    subId
  );

  writeAuditLog(req.authUser!.id, 'CREATE_FEEDBACK', 'submission', subId, { scope_type, scope_ref }, req.ip || '');
  res.status(201).json({ submission: loadFullSubmission(subId) });
});

apiRouter.post('/feedbacks/:id/replies', requireAuth, requireRoles('super_admin', 'nvc_admin', 'review_officer', 'ministry_user', 'office_user'), (req: AuthRequest, res: Response) => {
  const fbId = Number(req.params.id);
  const { message, attachment_id } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Reply message is required.' });
  }

  const fb = db
    .prepare(
      `SELECT f.submission_id, s.office_id, go.ministry_id, go.province_id
       FROM feedbacks f
       JOIN submissions s ON s.id = f.submission_id
       JOIN government_offices go ON go.id = s.office_id
       WHERE f.id = ?`
    )
    .get(fbId) as Record<string, unknown> | undefined;

  if (!fb) return res.status(404).json({ error: 'Feedback not found.' });
  if (!canUserAccessOffice(req.authUser!, Number(fb.office_id), fb.ministry_id ? Number(fb.ministry_id) : null, Number(fb.province_id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.prepare('INSERT INTO feedback_replies (feedback_id, user_id, message, attachment_id) VALUES (?, ?, ?, ?)').run(
    fbId,
    req.authUser!.id,
    message.trim(),
    attachment_id ? Number(attachment_id) : null
  );

  writeAuditLog(req.authUser!.id, 'REPLY_FEEDBACK', 'feedback', fbId, { subId: fb.submission_id }, req.ip || '');
  res.status(201).json({ submission: loadFullSubmission(Number(fb.submission_id)) });
});

// ========================
// NOTIFICATIONS
// ========================
apiRouter.get('/notifications', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.authUser!;
  const officeIds = user.offices.map((o) => o.office_id);
  let rows: Array<Record<string, unknown>> = [];

  if (user.role === 'office_user' && officeIds.length > 0) {
    rows = db
      .prepare(
        `SELECT * FROM notifications
         WHERE user_id = ? OR office_id IN (${officeIds.map(() => '?').join(',')})
         ORDER BY created_at DESC LIMIT 40`
      )
      .all(user.id, ...officeIds) as Array<Record<string, unknown>>;
  } else {
    rows = db
      .prepare('SELECT * FROM notifications WHERE user_id = ? OR (user_id IS NULL AND office_id IS NULL) ORDER BY created_at DESC LIMIT 40')
      .all(user.id) as Array<Record<string, unknown>>;
  }

  res.json({
    notifications: rows.map((n) => ({
      id: Number(n.id),
      user_id: n.user_id ? Number(n.user_id) : null,
      office_id: n.office_id ? Number(n.office_id) : null,
      title_np: String(n.title_np),
      title_en: String(n.title_en),
      message_np: String(n.message_np),
      message_en: String(n.message_en),
      type: String(n.type),
      link_submission_id: n.link_submission_id ? Number(n.link_submission_id) : null,
      is_read: Boolean(n.is_read),
      created_at: String(n.created_at),
    })),
  });
});

apiRouter.post('/notifications/:id/read', requireAuth, (req: AuthRequest, res: Response) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

apiRouter.post('/notifications/read-all', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.authUser!;
  const officeIds = user.offices.map((o) => o.office_id);
  if (user.role === 'office_user' && officeIds.length > 0) {
    db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ? OR office_id IN (${officeIds.map(() => '?').join(',')})`).run(
      user.id,
      ...officeIds
    );
  } else {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(user.id);
  }
  res.json({ ok: true });
});

// ========================
// ANALYTICS & DASHBOARD ENGINE (supports all 14+ filters)
// ========================
function parseNumArray(val: unknown): number[] {
  if (!val) return [];
  return String(val)
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function parseStrArray(val: unknown): string[] {
  if (!val) return [];
  return String(val)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function buildAnalytics(req: AuthRequest): DashboardAnalytics {
  const user = req.authUser!;
  const fyIds = parseNumArray(req.query.fiscalYearIds);
  const qNums = parseNumArray(req.query.quarterNumbers);
  const govtLevels = parseStrArray(req.query.govtLevels);
  const ministryIds = parseNumArray(req.query.ministryIds);
  const departmentIds = parseNumArray(req.query.departmentIds);
  const provinceIds = parseNumArray(req.query.provinceIds);
  const districtIds = parseNumArray(req.query.districtIds);
  const localLevelIds = parseNumArray(req.query.localLevelIds);
  const officeTypes = parseStrArray(req.query.officeTypes);
  const officeIds = parseNumArray(req.query.officeIds);
  const statuses = parseStrArray(req.query.statuses);
  const implState = String(req.query.implState || '');
  const indicatorNo = req.query.indicatorNo ? Number(req.query.indicatorNo) : null;
  const dateFrom = String(req.query.dateFrom || '').trim();
  const dateTo = String(req.query.dateTo || '').trim();

  // Default to active fiscal year (2083/84) and Q1 if no period specified on initial load?
  // Wait: if caller specifies nothing, default to FY 2083/84 Q1 (period 5) OR respect explicit all-periods flag
  const effectiveFyIds = fyIds.length > 0 ? fyIds : [2];
  const effectiveQNums = qNums.length > 0 ? qNums : [1];

  // Scope enforcement for ministry_user & viewer_auditor
  let officeWhere = 'WHERE go.is_active = 1';
  const officeParams: Array<string | number> = [];

  if (user.role === 'ministry_user' && user.ministry_id) {
    officeWhere += ' AND go.ministry_id = ?';
    officeParams.push(user.ministry_id);
  } else if (user.role === 'viewer_auditor') {
    if (user.province_id) {
      officeWhere += ' AND go.province_id = ?';
      officeParams.push(user.province_id);
    }
    if (user.ministry_id) {
      officeWhere += ' AND go.ministry_id = ?';
      officeParams.push(user.ministry_id);
    }
  } else if (user.role === 'office_user') {
    const ids = user.offices.map((o) => o.office_id);
    if (ids.length > 0) {
      officeWhere += ` AND go.id IN (${ids.map(() => '?').join(',')})`;
      officeParams.push(...ids);
    } else {
      officeWhere += ' AND 1=0';
    }
  }

  if (govtLevels.length > 0) {
    officeWhere += ` AND go.govt_level IN (${govtLevels.map(() => '?').join(',')})`;
    officeParams.push(...govtLevels);
  }
  if (ministryIds.length > 0) {
    officeWhere += ` AND go.ministry_id IN (${ministryIds.map(() => '?').join(',')})`;
    officeParams.push(...ministryIds);
  }
  if (departmentIds.length > 0) {
    officeWhere += ` AND go.department_id IN (${departmentIds.map(() => '?').join(',')})`;
    officeParams.push(...departmentIds);
  }
  if (provinceIds.length > 0) {
    officeWhere += ` AND go.province_id IN (${provinceIds.map(() => '?').join(',')})`;
    officeParams.push(...provinceIds);
  }
  if (districtIds.length > 0) {
    officeWhere += ` AND go.district_id IN (${districtIds.map(() => '?').join(',')})`;
    officeParams.push(...districtIds);
  }
  if (localLevelIds.length > 0) {
    officeWhere += ` AND go.local_level_id IN (${localLevelIds.map(() => '?').join(',')})`;
    officeParams.push(...localLevelIds);
  }
  if (officeTypes.length > 0) {
    officeWhere += ` AND go.office_type_np IN (${officeTypes.map(() => '?').join(',')})`;
    officeParams.push(...officeTypes);
  }
  if (officeIds.length > 0) {
    officeWhere += ` AND go.id IN (${officeIds.map(() => '?').join(',')})`;
    officeParams.push(...officeIds);
  }

  let subWhere = `WHERE rp.fiscal_year_id IN (${effectiveFyIds.map(() => '?').join(',')}) AND rp.quarter_number IN (${effectiveQNums
    .map(() => '?')
    .join(',')})`;
  const subParams: Array<string | number> = [...effectiveFyIds, ...effectiveQNums];

  if (statuses.length > 0) {
    subWhere += ` AND s.status IN (${statuses.map(() => '?').join(',')})`;
    subParams.push(...statuses);
  }
  if (implState === 'high') {
    subWhere += ' AND s.implementation_score >= 80';
  } else if (implState === 'medium') {
    subWhere += ' AND s.implementation_score >= 50 AND s.implementation_score < 80';
  } else if (implState === 'low') {
    subWhere += ' AND s.implementation_score < 50';
  }
  if (dateFrom) {
    subWhere += ' AND substr(COALESCE(s.submitted_at, s.created_at), 1, 10) >= ?';
    subParams.push(dateFrom);
  }
  if (dateTo) {
    subWhere += ' AND substr(COALESCE(s.submitted_at, s.created_at), 1, 10) <= ?';
    subParams.push(dateTo);
  }

  const filteredOffices = db
    .prepare(
      `SELECT go.*, p.name_np AS province_name_np, p.name_en AS province_name_en,
              d.name_np AS district_name_np, d.name_en AS district_name_en, d.geo_key AS district_geo_key,
              m.name_np AS ministry_name_np, m.name_en AS ministry_name_en
       FROM government_offices go
       JOIN provinces p ON p.id = go.province_id
       JOIN districts d ON d.id = go.district_id
       LEFT JOIN ministries m ON m.id = go.ministry_id
       ${officeWhere}`
    )
    .all(...officeParams) as Array<Record<string, unknown>>;

  const filteredOfficeIdSet = new Set(filteredOffices.map((o) => Number(o.id)));

  const rawSubs = db
    .prepare(
      `SELECT s.id, s.office_id, go.office_code, go.name_np AS office_name_np, go.name_en AS office_name_en,
              go.govt_level, go.ministry_id, m.name_np AS ministry_name_np,
              go.province_id, p.name_np AS province_name_np, go.district_id, d.name_np AS district_name_np,
              d.geo_key AS district_geo_key, s.reporting_period_id, rp.fiscal_year_id,
              fy.name_np AS fiscal_year_np, rp.quarter_number, rp.quarter_name_np, rp.deadline_bs,
              s.status, s.version_no, s.is_timely, s.submitted_at, s.implementation_score,
              COALESCE(ops.total_services, 0) AS total_services,
              COALESCE(ops.prepared_forms, 0) AS prepared_forms,
              COALESCE(ops.approved_forms, 0) AS approved_forms,
              COALESCE(ops.in_use_forms, 0) AS in_use_forms,
              COALESCE(ops.free_available_forms, 0) AS free_available_forms,
              COALESCE(ops.digital_available_forms, 0) AS digital_available_forms,
              COALESCE((SELECT SUM(received_count) FROM service_details sd WHERE sd.submission_id = s.id), 0) AS total_received,
              COALESCE((SELECT SUM(disposed_count) FROM service_details sd WHERE sd.submission_id = s.id), 0) AS total_disposed,
              COALESCE((SELECT SUM(pending_count) FROM service_details sd WHERE sd.submission_id = s.id), 0) AS total_pending,
              COALESCE((SELECT SUM(returned_count) FROM service_details sd WHERE sd.submission_id = s.id), 0) AS total_returned,
              COALESCE((SELECT SUM(within_deadline_count) FROM service_details sd WHERE sd.submission_id = s.id), 0) AS total_within_deadline,
              (SELECT COUNT(*) FROM feedbacks fb WHERE fb.submission_id = s.id) AS feedback_count
       FROM submissions s
       JOIN government_offices go ON go.id = s.office_id
       LEFT JOIN ministries m ON m.id = go.ministry_id
       JOIN provinces p ON p.id = go.province_id
       JOIN districts d ON d.id = go.district_id
       JOIN reporting_periods rp ON rp.id = s.reporting_period_id
       JOIN fiscal_years fy ON fy.id = rp.fiscal_year_id
       LEFT JOIN office_progress_summary ops ON ops.submission_id = s.id
       ${subWhere}`
    )
    .all(...subParams) as Array<Record<string, unknown>>;

  const matchingSubsRaw = rawSubs.filter((r) => filteredOfficeIdSet.has(Number(r.office_id)));

  const submissions: SubmissionListItem[] = matchingSubsRaw.map((r) => ({
    id: Number(r.id),
    office_id: Number(r.office_id),
    office_code: String(r.office_code),
    office_name_np: String(r.office_name_np),
    office_name_en: String(r.office_name_en),
    govt_level: r.govt_level as 'federal' | 'provincial' | 'local',
    ministry_id: r.ministry_id ? Number(r.ministry_id) : null,
    ministry_name_np: r.ministry_name_np ? String(r.ministry_name_np) : null,
    province_id: Number(r.province_id),
    province_name_np: String(r.province_name_np),
    district_id: Number(r.district_id),
    district_name_np: String(r.district_name_np),
    district_geo_key: String(r.district_geo_key),
    reporting_period_id: Number(r.reporting_period_id),
    fiscal_year_id: Number(r.fiscal_year_id),
    fiscal_year_np: String(r.fiscal_year_np),
    quarter_number: Number(r.quarter_number),
    quarter_name_np: String(r.quarter_name_np),
    deadline_bs: String(r.deadline_bs),
    status: r.status as SubmissionStatus,
    version_no: Number(r.version_no),
    is_timely: Boolean(r.is_timely),
    submitted_at: r.submitted_at ? String(r.submitted_at) : null,
    implementation_score: Number(r.implementation_score || 0),
    total_services: Number(r.total_services || 0),
    prepared_forms: Number(r.prepared_forms || 0),
    approved_forms: Number(r.approved_forms || 0),
    in_use_forms: Number(r.in_use_forms || 0),
    total_received: Number(r.total_received || 0),
    total_disposed: Number(r.total_disposed || 0),
    total_within_deadline: Number(r.total_within_deadline || 0),
    feedback_count: Number(r.feedback_count || 0),
  }));

  const submittedStatuses = new Set(['Submitted', 'Under Review', 'Returned for Correction', 'Resubmitted', 'Reviewed', 'Accepted']);
  const submittedList = submissions.filter((s) => submittedStatuses.has(s.status));
  const notSubmittedList = submissions.filter((s) => !submittedStatuses.has(s.status));
  const pendingReviewList = submissions.filter((s) => ['Submitted', 'Under Review', 'Resubmitted'].includes(s.status));
  const reviewedCompletedList = submissions.filter((s) => ['Reviewed', 'Accepted'].includes(s.status));
  const returnedList = submissions.filter((s) => s.status === 'Returned for Correction');
  const timelyList = submittedList.filter((s) => s.is_timely);
  const lateList = submittedList.filter((s) => !s.is_timely);

  const avgImpl =
    submittedList.length > 0
      ? Math.round((submittedList.reduce((acc, s) => acc + s.implementation_score, 0) / submittedList.length) * 10) / 10
      : 0;

  // Province stats
  const allProvinces = db.prepare('SELECT * FROM provinces ORDER BY id').all() as Array<{ id: number; name_np: string; name_en: string }>;
  const provinceStats = allProvinces.map((p) => {
    const pOffices = filteredOffices.filter((o) => Number(o.province_id) === p.id);
    const pSubs = submissions.filter((s) => s.province_id === p.id);
    const pSubmitted = pSubs.filter((s) => submittedStatuses.has(s.status));
    const pAvg = pSubmitted.length > 0 ? Math.round((pSubmitted.reduce((a, b) => a + b.implementation_score, 0) / pSubmitted.length) * 10) / 10 : 0;
    const pRec = pSubmitted.reduce((a, b) => a + b.total_received, 0);
    const pDisp = pSubmitted.reduce((a, b) => a + b.total_disposed, 0);
    const pWithin = pSubmitted.reduce((a, b) => a + b.total_within_deadline, 0);
    return {
      province_id: p.id,
      province_name_np: p.name_np,
      province_name_en: p.name_en,
      total_offices: pOffices.length,
      submitted_offices: pSubmitted.length,
      not_submitted_offices: Math.max(0, pOffices.length - pSubmitted.length),
      avg_impl_pct: pAvg,
      total_services: pSubmitted.reduce((a, b) => a + b.total_services, 0),
      total_received: pRec,
      total_disposed: pDisp,
      timely_disposal_pct: pDisp > 0 ? Math.round((pWithin / pDisp) * 1000) / 10 : 0,
    };
  });

  // All 77 Districts stats
  const allDistricts = db.prepare('SELECT * FROM districts ORDER BY id').all() as Array<{
    id: number;
    province_id: number;
    geo_key: string;
    name_np: string;
    name_en: string;
  }>;
  const districtStats = allDistricts.map((d) => {
    const dOffices = filteredOffices.filter((o) => Number(o.district_id) === d.id);
    const dSubs = submissions.filter((s) => s.district_id === d.id);
    const dSubmitted = dSubs.filter((s) => submittedStatuses.has(s.status));
    const dAvg = dSubmitted.length > 0 ? Math.round((dSubmitted.reduce((a, b) => a + b.implementation_score, 0) / dSubmitted.length) * 10) / 10 : 0;
    return {
      district_id: d.id,
      geo_key: d.geo_key,
      district_name_np: d.name_np,
      district_name_en: d.name_en,
      province_id: d.province_id,
      total_offices: dOffices.length,
      submitted_offices: dSubmitted.length,
      avg_impl_pct: dAvg,
      total_received: dSubmitted.reduce((a, b) => a + b.total_received, 0),
      total_disposed: dSubmitted.reduce((a, b) => a + b.total_disposed, 0),
    };
  });

  // Govt Level Comparison
  const levels: Array<{ lvl: 'federal' | 'provincial' | 'local'; np: string; en: string }> = [
    { lvl: 'federal', np: 'संघीय तह', en: 'Federal Level' },
    { lvl: 'provincial', np: 'प्रदेश तह', en: 'Provincial Level' },
    { lvl: 'local', np: 'स्थानीय तह', en: 'Local Level' },
  ];
  const govtLevelStats = levels.map((l) => {
    const lOff = filteredOffices.filter((o) => o.govt_level === l.lvl);
    const lSub = submittedList.filter((s) => s.govt_level === l.lvl);
    return {
      govt_level: l.lvl,
      label_np: l.np,
      label_en: l.en,
      total_offices: lOff.length,
      submitted_offices: lSub.length,
      avg_impl_pct: lSub.length > 0 ? Math.round((lSub.reduce((a, b) => a + b.implementation_score, 0) / lSub.length) * 10) / 10 : 0,
    };
  });

  // Ministry Ranking
  const allMinistries = db.prepare('SELECT * FROM ministries ORDER BY id').all() as Array<{ id: number; name_np: string; name_en: string }>;
  const ministryStatsRaw = allMinistries
    .map((m) => {
      const mOff = filteredOffices.filter((o) => Number(o.ministry_id) === m.id);
      const mSub = submittedList.filter((s) => s.ministry_id === m.id);
      const avg = mSub.length > 0 ? Math.round((mSub.reduce((a, b) => a + b.implementation_score, 0) / mSub.length) * 10) / 10 : 0;
      return {
        ministry_id: m.id,
        ministry_name_np: m.name_np,
        ministry_name_en: m.name_en,
        total_offices: mOff.length,
        submitted_offices: mSub.length,
        not_submitted_offices: Math.max(0, mOff.length - mSub.length),
        avg_impl_pct: avg,
        rank: 0,
      };
    })
    .filter((m) => m.total_offices > 0)
    .sort((a, b) => b.avg_impl_pct - a.avg_impl_pct || b.submitted_offices - a.submitted_offices);

  const ministryStats = ministryStatsRaw.map((m, idx) => ({ ...m, rank: idx + 1 }));

  // 9 Indicator Analysis
  const allIndicators = db.prepare('SELECT * FROM implementation_indicators ORDER BY indicator_no').all() as Array<{
    indicator_no: number;
    title_np: string;
    title_en: string;
  }>;
  const subIdsForDetails = submittedList.map((s) => s.id);
  const indResponses =
    subIdsForDetails.length > 0
      ? (db
          .prepare(
            `SELECT indicator_no, status FROM indicator_responses WHERE submission_id IN (${subIdsForDetails.map(() => '?').join(',')})`
          )
          .all(...subIdsForDetails) as Array<{ indicator_no: number; status: string }>)
      : [];

  const indicatorStats = allIndicators
    .filter((ind) => !indicatorNo || ind.indicator_no === indicatorNo)
    .map((ind) => {
      const resps = indResponses.filter((r) => r.indicator_no === ind.indicator_no && r.status);
      const full_count = resps.filter((r) => r.status === 'पूर्ण').length;
      const partial_count = resps.filter((r) => r.status === 'आंशिक').length;
      const none_count = resps.filter((r) => r.status === 'छैन').length;
      const total_responses = resps.length;
      const compliance_pct =
        total_responses > 0 ? Math.round(((full_count * 100 + partial_count * 50) / (total_responses * 100)) * 1000) / 10 : 0;
      return {
        indicator_no: ind.indicator_no,
        title_np: ind.title_np,
        title_en: ind.title_en,
        full_count,
        partial_count,
        none_count,
        total_responses,
        compliance_pct,
      };
    });

  // Service Analytics
  const matchingRawForService = matchingSubsRaw.filter((r) => submittedStatuses.has(String(r.status)));
  const total_services = matchingRawForService.reduce((a, b) => a + Number(b.total_services || 0), 0);
  const prepared_forms = matchingRawForService.reduce((a, b) => a + Number(b.prepared_forms || 0), 0);
  const approved_forms = matchingRawForService.reduce((a, b) => a + Number(b.approved_forms || 0), 0);
  const in_use_forms = matchingRawForService.reduce((a, b) => a + Number(b.in_use_forms || 0), 0);
  const free_available_forms = matchingRawForService.reduce((a, b) => a + Number(b.free_available_forms || 0), 0);
  const digital_available_forms = matchingRawForService.reduce((a, b) => a + Number(b.digital_available_forms || 0), 0);
  const total_received = matchingRawForService.reduce((a, b) => a + Number(b.total_received || 0), 0);
  const total_disposed = matchingRawForService.reduce((a, b) => a + Number(b.total_disposed || 0), 0);
  const total_pending = matchingRawForService.reduce((a, b) => a + Number(b.total_pending || 0), 0);
  const total_returned = matchingRawForService.reduce((a, b) => a + Number(b.total_returned || 0), 0);
  const total_within_deadline = matchingRawForService.reduce((a, b) => a + Number(b.total_within_deadline || 0), 0);
  const within_deadline_pct = total_disposed > 0 ? Math.round((total_within_deadline / total_disposed) * 1000) / 10 : 0;

  let top_services: DashboardAnalytics['serviceAnalytics']['top_services'] = [];
  if (subIdsForDetails.length > 0) {
    const svcAgg = db
      .prepare(
        `SELECT service_name, COUNT(DISTINCT submission_id) AS office_count,
                SUM(received_count) AS received, SUM(disposed_count) AS disposed,
                SUM(pending_count) AS pending, SUM(returned_count) AS returned,
                SUM(within_deadline_count) AS within_deadline
         FROM service_details
         WHERE submission_id IN (${subIdsForDetails.map(() => '?').join(',')}) AND TRIM(service_name) != ''
         GROUP BY service_name
         ORDER BY received DESC
         LIMIT 15`
      )
      .all(...subIdsForDetails) as Array<Record<string, unknown>>;

    top_services = svcAgg.map((sv) => {
      const disp = Number(sv.disposed || 0);
      const w = Number(sv.within_deadline || 0);
      return {
        service_name: String(sv.service_name),
        office_count: Number(sv.office_count || 0),
        received: Number(sv.received || 0),
        disposed: disp,
        pending: Number(sv.pending || 0),
        returned: Number(sv.returned || 0),
        within_deadline: w,
        within_deadline_pct: disp > 0 ? Math.round((w / disp) * 1000) / 10 : 0,
      };
    });
  }

  // Quarterly Trend Analysis across all periods (filtered by selected offices!)
  const allPeriods = db
    .prepare(
      `SELECT rp.id, fy.code AS fy_code, fy.name_np AS fy_np, rp.quarter_number
       FROM reporting_periods rp
       JOIN fiscal_years fy ON fy.id = rp.fiscal_year_id
       ORDER BY rp.fiscal_year_id ASC, rp.quarter_number ASC`
    )
    .all() as Array<{ id: number; fy_code: string; fy_np: string; quarter_number: number }>;

  const quarterlyTrends = allPeriods
    .map((per) => {
      const pRows = db
        .prepare(
          `SELECT s.id, s.office_id, s.status, s.is_timely, s.implementation_score,
                  COALESCE(ops.total_services, 0) AS total_services,
                  COALESCE(ops.prepared_forms, 0) AS prepared_forms,
                  COALESCE(ops.in_use_forms, 0) AS in_use_forms,
                  COALESCE((SELECT SUM(received_count) FROM service_details sd WHERE sd.submission_id = s.id), 0) AS rec,
                  COALESCE((SELECT SUM(disposed_count) FROM service_details sd WHERE sd.submission_id = s.id), 0) AS disp
           FROM submissions s
           LEFT JOIN office_progress_summary ops ON ops.submission_id = s.id
           WHERE s.reporting_period_id = ?`
        )
        .all(per.id) as Array<Record<string, unknown>>;

      const scoped = pRows.filter((r) => filteredOfficeIdSet.has(Number(r.office_id)) && submittedStatuses.has(String(r.status)));
      if (scoped.length === 0) return null;

      const tSvc = scoped.reduce((a, b) => a + Number(b.total_services || 0), 0);
      const tPrep = scoped.reduce((a, b) => a + Number(b.prepared_forms || 0), 0);
      const tInUse = scoped.reduce((a, b) => a + Number(b.in_use_forms || 0), 0);
      const tRec = scoped.reduce((a, b) => a + Number(b.rec || 0), 0);
      const tDisp = scoped.reduce((a, b) => a + Number(b.disp || 0), 0);
      const qLabelsNp = ['', 'प्रथम', 'दोस्रो', 'तेस्रो', 'चौथो'];

      return {
        period_label_np: `${per.fy_np} (${qLabelsNp[per.quarter_number]})`,
        period_label_en: `${per.fy_code} Q${per.quarter_number}`,
        fiscal_year_code: per.fy_code,
        quarter_number: per.quarter_number,
        submitted_count: scoped.length,
        timely_count: scoped.filter((r) => Boolean(r.is_timely)).length,
        avg_impl_pct: Math.round((scoped.reduce((a, b) => a + Number(b.implementation_score || 0), 0) / scoped.length) * 10) / 10,
        prepared_rate_pct: tSvc > 0 ? Math.round((tPrep / tSvc) * 1000) / 10 : 0,
        in_use_rate_pct: tSvc > 0 ? Math.round((tInUse / tSvc) * 1000) / 10 : 0,
        disposal_rate_pct: tRec > 0 ? Math.round((tDisp / tRec) * 1000) / 10 : 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    kpis: {
      totalOffices: filteredOffices.length,
      requiredReportingOffices: filteredOffices.length,
      submittedOffices: submittedList.length,
      notSubmittedOffices: Math.max(0, filteredOffices.length - submittedList.length),
      pendingReviewCount: pendingReviewList.length,
      reviewedCompletedCount: reviewedCompletedList.length,
      returnedForCorrectionCount: returnedList.length,
      timelySubmittedCount: timelyList.length,
      lateSubmittedCount: lateList.length,
      avgImplementationPct: avgImpl,
    },
    officeListsByKpi: {
      all: submissions,
      submitted: submittedList,
      notSubmitted: notSubmittedList,
      pendingReview: pendingReviewList,
      reviewedCompleted: reviewedCompletedList,
      returned: returnedList,
      timely: timelyList,
      late: lateList,
    },
    provinceStats,
    districtStats,
    govtLevelStats,
    ministryStats,
    indicatorStats,
    serviceAnalytics: {
      total_services,
      prepared_forms,
      approved_forms,
      in_use_forms,
      free_available_forms,
      digital_available_forms,
      total_received,
      total_disposed,
      total_pending,
      total_returned,
      total_within_deadline,
      within_deadline_pct,
      top_services,
    },
    quarterlyTrends,
    submissions,
  };
}

apiRouter.get('/analytics/dashboard', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const analytics = buildAnalytics(req);
    res.json(analytics);
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to load analytics.' });
  }
});

// ========================
// SERVER-SIDE EXCEL EXPORT (ExcelJS)
// ========================
apiRouter.get('/export/excel', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const reportType = String(req.query.type || 'office_status');
    const analytics = buildAnalytics(req);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'National Vigilance Center (राष्ट्रिय सतर्कता केन्द्र)';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('NVC Report');

    const styleHeader = (row: ExcelJS.Row) => {
      row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F294D' } };
      row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      row.height = 28;
    };

    if (reportType === 'province_progress') {
      sheet.columns = [
        { header: 'प्रदेश', key: 'province_name_np', width: 24 },
        { header: 'कुल कार्यालय', key: 'total_offices', width: 15 },
        { header: 'पेश गरेका', key: 'submitted_offices', width: 15 },
        { header: 'पेश नगरेका', key: 'not_submitted_offices', width: 15 },
        { header: 'औसत कार्यान्वयन %', key: 'avg_impl_pct', width: 18 },
        { header: 'कुल निवेदन प्राप्त', key: 'total_received', width: 18 },
        { header: 'कुल फर्छ्योट', key: 'total_disposed', width: 16 },
        { header: 'समयसीमाभित्र फर्छ्योट %', key: 'timely_disposal_pct', width: 22 },
      ];
      styleHeader(sheet.getRow(1));
      analytics.provinceStats.forEach((p) => sheet.addRow(p));
    } else if (reportType === 'ministry_progress') {
      sheet.columns = [
        { header: 'श्रेणी (Rank)', key: 'rank', width: 12 },
        { header: 'मन्त्रालय / निकाय', key: 'ministry_name_np', width: 42 },
        { header: 'कुल कार्यालय', key: 'total_offices', width: 15 },
        { header: 'पेश गरेका', key: 'submitted_offices', width: 15 },
        { header: 'पेश नगरेका', key: 'not_submitted_offices', width: 15 },
        { header: 'औसत कार्यान्वयन %', key: 'avg_impl_pct', width: 18 },
      ];
      styleHeader(sheet.getRow(1));
      analytics.ministryStats.forEach((m) => sheet.addRow(m));
    } else if (reportType === 'district_progress') {
      sheet.columns = [
        { header: 'जिल्ला', key: 'district_name_np', width: 24 },
        { header: 'कुल कार्यालय', key: 'total_offices', width: 15 },
        { header: 'पेश गरेका', key: 'submitted_offices', width: 15 },
        { header: 'औसत कार्यान्वयन %', key: 'avg_impl_pct', width: 18 },
        { header: 'प्राप्त निवेदन', key: 'total_received', width: 16 },
        { header: 'फर्छ्योट निवेदन', key: 'total_disposed', width: 16 },
      ];
      styleHeader(sheet.getRow(1));
      analytics.districtStats.filter((d) => d.total_offices > 0).forEach((d) => sheet.addRow(d));
    } else if (reportType === 'indicator_status') {
      sheet.columns = [
        { header: 'सूचक नं.', key: 'indicator_no', width: 12 },
        { header: 'अनिवार्य सूचक विवरण', key: 'title_np', width: 55 },
        { header: 'पूर्ण', key: 'full_count', width: 12 },
        { header: 'आंशिक', key: 'partial_count', width: 12 },
        { header: 'छैन', key: 'none_count', width: 12 },
        { header: 'कार्यान्वयन %', key: 'compliance_pct', width: 16 },
      ];
      styleHeader(sheet.getRow(1));
      analytics.indicatorStats.forEach((i) => sheet.addRow(i));
    } else if (reportType === 'service_stats') {
      sheet.columns = [
        { header: 'सेवाको नाम', key: 'service_name', width: 38 },
        { header: 'कार्यालय संख्या', key: 'office_count', width: 15 },
        { header: 'प्राप्त निवेदन', key: 'received', width: 15 },
        { header: 'फर्छ्योट', key: 'disposed', width: 15 },
        { header: 'बाँकी', key: 'pending', width: 14 },
        { header: 'फिर्ता', key: 'returned', width: 14 },
        { header: 'समयसीमाभित्र फर्छ्योट', key: 'within_deadline', width: 20 },
        { header: 'समयसीमाभित्र %', key: 'within_deadline_pct', width: 16 },
      ];
      styleHeader(sheet.getRow(1));
      analytics.serviceAnalytics.top_services.forEach((sv) => sheet.addRow(sv));
    } else {
      sheet.columns = [
        { header: 'Office Code', key: 'office_code', width: 16 },
        { header: 'कार्यालयको नाम', key: 'office_name_np', width: 36 },
        { header: 'प्रदेश', key: 'province_name_np', width: 18 },
        { header: 'जिल्ला', key: 'district_name_np', width: 16 },
        { header: 'मन्त्रालय', key: 'ministry_name_np', width: 30 },
        { header: 'अवस्था (Status)', key: 'status', width: 22 },
        { header: 'कार्यान्वयन %', key: 'implementation_score', width: 15 },
        { header: 'कुल सेवा', key: 'total_services', width: 12 },
        { header: 'तयार ढाँचा', key: 'prepared_forms', width: 13 },
        { header: 'प्रयोगमा ढाँचा', key: 'in_use_forms', width: 14 },
        { header: 'प्राप्त निवेदन', key: 'total_received', width: 14 },
        { header: 'फर्छ्योट निवेदन', key: 'total_disposed', width: 15 },
      ];
      styleHeader(sheet.getRow(1));
      let rows = analytics.submissions;
      if (reportType === 'not_submitted') rows = analytics.officeListsByKpi.notSubmitted;
      else if (reportType === 'needs_improvement') rows = analytics.submissions.filter((s) => s.implementation_score > 0 && s.implementation_score < 75);
      else if (reportType === 'feedback_received') rows = analytics.submissions.filter((s) => s.feedback_count > 0);
      rows.forEach((s) => sheet.addRow(s));
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="nvc_${reportType}_report.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: 'Failed to generate Excel export.' });
  }
});

// ========================
// ADMIN & SUPER ADMIN CONSOLE ROUTES
// ========================
apiRouter.get('/admin/users', requireAuth, requireRoles('super_admin', 'nvc_admin'), (_req: AuthRequest, res: Response) => {
  const users = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.full_name_np, u.full_name_en, u.designation_np, u.phone,
              u.ministry_id, u.province_id, u.is_active, u.created_at,
              r.code AS role_code, r.name_np AS role_name_np, r.name_en AS role_name_en,
              m.name_np AS ministry_name_np
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       LEFT JOIN ministries m ON m.id = u.ministry_id
       ORDER BY u.id`
    )
    .all() as Array<Record<string, unknown>>;

  const links = db
    .prepare(
      `SELECT ou.user_id, ou.office_id, go.name_np AS office_name_np, ou.is_head, ou.can_submit
       FROM office_users ou
       JOIN government_offices go ON go.id = ou.office_id`
    )
    .all() as Array<Record<string, unknown>>;

  const enriched = users.map((u) => ({
    ...u,
    is_active: Boolean(u.is_active),
    offices: links.filter((l) => Number(l.user_id) === Number(u.id)),
  }));

  res.json({ users: enriched });
});

apiRouter.post('/admin/users', requireAuth, requireRoles('super_admin'), (req: AuthRequest, res: Response) => {
  const { username, email, password, full_name_np, full_name_en, designation_np, phone, role_code, ministry_id, province_id, office_id, is_head } =
    req.body || {};

  if (!username || !email || !password || !full_name_np || !role_code) {
    return res.status(400).json({ error: 'Required fields missing.' });
  }

  const roleRow = db.prepare('SELECT id FROM roles WHERE code = ?').get(String(role_code)) as { id: number } | undefined;
  if (!roleRow) return res.status(400).json({ error: 'Invalid role.' });

  db.exec('BEGIN TRANSACTION;');
  try {
    const uRes = db
      .prepare(
        `INSERT INTO users (username, email, password_hash, full_name_np, full_name_en, designation_np, phone, ministry_id, province_id, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(
        String(username).trim(),
        String(email).trim().toLowerCase(),
        hashPassword(String(password)),
        String(full_name_np),
        String(full_name_en || full_name_np),
        String(designation_np || ''),
        String(phone || ''),
        ministry_id ? Number(ministry_id) : null,
        province_id ? Number(province_id) : null
      );
    const newUserId = Number(uRes.lastInsertRowid);
    db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(newUserId, roleRow.id);

    if (office_id) {
      db.prepare('INSERT INTO office_users (office_id, user_id, is_head, can_submit, is_primary) VALUES (?, ?, ?, 1, 1)').run(
        Number(office_id),
        newUserId,
        is_head ? 1 : 0
      );
    }

    writeAuditLog(req.authUser!.id, 'CREATE_USER', 'user', newUserId, { username, role_code }, req.ip || '');
    db.exec('COMMIT;');
    res.status(201).json({ id: newUserId });
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Create user error:', err);
    res.status(400).json({ error: 'प्रयोगकर्ता नाम वा इमेल पहिले नै दर्ता छ।' });
  }
});

apiRouter.patch('/admin/users/:id/toggle', requireAuth, requireRoles('super_admin'), (req: AuthRequest, res: Response) => {
  const uid = Number(req.params.id);
  if (uid === req.authUser!.id) {
    return res.status(400).json({ error: 'आफ्नै खाता निष्क्रिय गर्न मिल्दैन।' });
  }
  const existing = db.prepare('SELECT is_active FROM users WHERE id = ?').get(uid) as { is_active: number } | undefined;
  if (!existing) return res.status(404).json({ error: 'User not found.' });

  const nextActive = existing.is_active ? 0 : 1;
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(nextActive, uid);
  writeAuditLog(req.authUser!.id, 'TOGGLE_USER_ACTIVE', 'user', uid, { is_active: Boolean(nextActive) }, req.ip || '');
  res.json({ is_active: Boolean(nextActive) });
});

apiRouter.post('/admin/offices', requireAuth, requireRoles('super_admin'), (req: AuthRequest, res: Response) => {
  const b = req.body || {};
  if (!b.office_code || !b.name_np || !b.province_id || !b.district_id) {
    return res.status(400).json({ error: 'Office code, name, province, and district are required.' });
  }
  try {
    const r = db
      .prepare(
        `INSERT INTO government_offices (office_code, name_np, name_en, office_type_np, office_type_en, govt_level, ministry_id, department_id, province_id, district_id, local_level_id, address_np, address_en, office_head_name, office_head_designation, contact_phone, email, website, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(
        String(b.office_code).trim(),
        String(b.name_np),
        String(b.name_en || b.name_np),
        String(b.office_type_np || 'सरकारी कार्यालय'),
        String(b.office_type_en || 'Government Office'),
        String(b.govt_level || 'federal'),
        b.ministry_id ? Number(b.ministry_id) : null,
        b.department_id ? Number(b.department_id) : null,
        Number(b.province_id),
        Number(b.district_id),
        b.local_level_id ? Number(b.local_level_id) : null,
        String(b.address_np || ''),
        String(b.address_en || ''),
        String(b.office_head_name || ''),
        String(b.office_head_designation || 'कार्यालय प्रमुख'),
        String(b.contact_phone || ''),
        String(b.email || ''),
        String(b.website || '')
      );
    writeAuditLog(req.authUser!.id, 'CREATE_OFFICE', 'government_office', Number(r.lastInsertRowid), { office_code: b.office_code }, req.ip || '');
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch (err) {
    console.error('Create office error:', err);
    res.status(400).json({ error: 'Office code already exists or invalid fields.' });
  }
});

apiRouter.patch('/admin/offices/:id/toggle', requireAuth, requireRoles('super_admin'), (req: AuthRequest, res: Response) => {
  const oid = Number(req.params.id);
  const row = db.prepare('SELECT is_active FROM government_offices WHERE id = ?').get(oid) as { is_active: number } | undefined;
  if (!row) return res.status(404).json({ error: 'Office not found.' });
  const next = row.is_active ? 0 : 1;
  db.prepare('UPDATE government_offices SET is_active = ? WHERE id = ?').run(next, oid);
  writeAuditLog(req.authUser!.id, 'TOGGLE_OFFICE_ACTIVE', 'government_office', oid, { is_active: Boolean(next) }, req.ip || '');
  res.json({ is_active: Boolean(next) });
});

apiRouter.patch('/admin/periods/:id', requireAuth, requireRoles('super_admin', 'nvc_admin'), (req: AuthRequest, res: Response) => {
  const pid = Number(req.params.id);
  const { status, deadline_bs, deadline_ad } = req.body || {};
  const existing = db.prepare('SELECT * FROM reporting_periods WHERE id = ?').get(pid) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: 'Reporting period not found.' });

  const nextStatus = status === 'open' || status === 'closed' ? status : String(existing.status);
  db.prepare('UPDATE reporting_periods SET status = ?, deadline_bs = ?, deadline_ad = ? WHERE id = ?').run(
    nextStatus,
    String(deadline_bs || existing.deadline_bs),
    String(deadline_ad || existing.deadline_ad),
    pid
  );

  if (nextStatus === 'open' && existing.status === 'closed') {
    db.prepare(
      `INSERT INTO notifications (user_id, office_id, title_np, title_en, message_np, message_en, type)
       VALUES (NULL, NULL, ?, ?, ?, ?, 'info')`
    ).run(
      'नयाँ त्रैमासिक प्रतिवेदन अवधि खुल्यो',
      'Reporting Period Opened',
      `${existing.quarter_name_np} को प्रतिवेदन पेश गर्ने अवधि खुला गरिएको छ। अन्तिम मिति: ${deadline_bs || existing.deadline_bs}`,
      `${existing.quarter_name_en} reporting is now open. Deadline: ${deadline_bs || existing.deadline_bs}`
    );
  }

  writeAuditLog(req.authUser!.id, 'UPDATE_REPORTING_PERIOD', 'reporting_period', pid, { nextStatus, deadline_bs }, req.ip || '');
  res.json({ ok: true });
});

apiRouter.get('/admin/settings', requireAuth, requireRoles('super_admin', 'nvc_admin'), (_req: AuthRequest, res: Response) => {
  const settings = db.prepare('SELECT * FROM system_settings ORDER BY key').all();
  res.json({ settings });
});

apiRouter.put('/admin/settings', requireAuth, requireRoles('super_admin'), (req: AuthRequest, res: Response) => {
  const { settings } = req.body || {};
  if (!Array.isArray(settings)) return res.status(400).json({ error: 'settings array required.' });
  const stmt = db.prepare("INSERT OR REPLACE INTO system_settings (key, value, description, updated_at) VALUES (?, ?, ?, datetime('now'))");
  for (const s of settings) {
    stmt.run(String(s.key), String(s.value), String(s.description || ''));
  }
  writeAuditLog(req.authUser!.id, 'UPDATE_SETTINGS', 'system_settings', 'all', {}, req.ip || '');
  res.json({ ok: true });
});

apiRouter.get('/admin/audit-logs', requireAuth, requireRoles('super_admin', 'nvc_admin'), (_req: AuthRequest, res: Response) => {
  const logs = db
    .prepare(
      `SELECT al.*, u.username, u.full_name_np
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.id DESC LIMIT 120`
    )
    .all();
  res.json({ logs });
});

apiRouter.get('/admin/backup', requireAuth, requireRoles('super_admin'), (req: AuthRequest, res: Response) => {
  writeAuditLog(req.authUser!.id, 'DOWNLOAD_DB_BACKUP', 'system', 'database', {}, req.ip || '');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="nvc_monitoring_backup.db"');
  fs.createReadStream(DB_PATH).pipe(res);
});
