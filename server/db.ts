import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { DISTRICTS_77, MINISTRIES_SEED, OFFICIAL_INDICATORS, PROVINCES } from '../src/data/nepalMasterData.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const DB_PATH = path.join(DATA_DIR, 'nvc_monitoring.db');
export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function hashSeedPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function initializeDatabase() {
  // All 27 required relational tables + version/status history + password reset tokens
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name_np TEXT NOT NULL,
      name_en TEXT NOT NULL,
      description TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS ministries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name_np TEXT NOT NULL,
      name_en TEXT NOT NULL,
      govt_level TEXT NOT NULL CHECK(govt_level IN ('federal','provincial','local'))
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ministry_id INTEGER NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
      name_np TEXT NOT NULL,
      name_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provinces (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name_np TEXT NOT NULL,
      name_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS districts (
      id INTEGER PRIMARY KEY,
      province_id INTEGER NOT NULL REFERENCES provinces(id),
      geo_key TEXT NOT NULL UNIQUE,
      name_np TEXT NOT NULL,
      name_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      district_id INTEGER NOT NULL REFERENCES districts(id),
      type_np TEXT NOT NULL,
      name_np TEXT NOT NULL,
      name_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS government_offices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      office_code TEXT NOT NULL UNIQUE,
      name_np TEXT NOT NULL,
      name_en TEXT NOT NULL,
      office_type_np TEXT NOT NULL,
      office_type_en TEXT NOT NULL,
      govt_level TEXT NOT NULL CHECK(govt_level IN ('federal','provincial','local')),
      ministry_id INTEGER REFERENCES ministries(id),
      department_id INTEGER REFERENCES departments(id),
      province_id INTEGER NOT NULL REFERENCES provinces(id),
      district_id INTEGER NOT NULL REFERENCES districts(id),
      local_level_id INTEGER REFERENCES local_levels(id),
      address_np TEXT NOT NULL,
      address_en TEXT NOT NULL,
      office_head_name TEXT NOT NULL,
      office_head_designation TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      email TEXT NOT NULL,
      website TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name_np TEXT NOT NULL,
      full_name_en TEXT NOT NULL,
      designation_np TEXT DEFAULT '',
      designation_en TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      ministry_id INTEGER REFERENCES ministries(id),
      province_id INTEGER REFERENCES provinces(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      UNIQUE(user_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS office_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      office_id INTEGER NOT NULL REFERENCES government_offices(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_head INTEGER NOT NULL DEFAULT 0,
      can_submit INTEGER NOT NULL DEFAULT 1,
      is_primary INTEGER NOT NULL DEFAULT 1,
      UNIQUE(office_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS fiscal_years (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name_np TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS reporting_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fiscal_year_id INTEGER NOT NULL REFERENCES fiscal_years(id),
      quarter_number INTEGER NOT NULL CHECK(quarter_number IN (1,2,3,4)),
      quarter_name_np TEXT NOT NULL,
      quarter_name_en TEXT NOT NULL,
      start_date_bs TEXT NOT NULL,
      end_date_bs TEXT NOT NULL,
      deadline_bs TEXT NOT NULL,
      deadline_ad TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
      UNIQUE(fiscal_year_id, quarter_number)
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      office_id INTEGER NOT NULL REFERENCES government_offices(id),
      reporting_period_id INTEGER NOT NULL REFERENCES reporting_periods(id),
      status TEXT NOT NULL DEFAULT 'Draft',
      version_no INTEGER NOT NULL DEFAULT 1,
      is_timely INTEGER NOT NULL DEFAULT 1,
      implementation_score REAL NOT NULL DEFAULT 0,
      submitted_by INTEGER REFERENCES users(id),
      submitted_at TEXT,
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(office_id, reporting_period_id)
    );

    CREATE TABLE IF NOT EXISTS office_progress_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
      office_name TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      contact_info TEXT NOT NULL DEFAULT '',
      level_ministry TEXT NOT NULL DEFAULT '',
      office_head TEXT NOT NULL DEFAULT '',
      total_services INTEGER NOT NULL DEFAULT 0,
      prepared_forms INTEGER NOT NULL DEFAULT 0,
      approved_forms INTEGER NOT NULL DEFAULT 0,
      in_use_forms INTEGER NOT NULL DEFAULT 0,
      free_available_forms INTEGER NOT NULL DEFAULT 0,
      digital_available_forms INTEGER NOT NULL DEFAULT 0,
      major_achievements TEXT NOT NULL DEFAULT '',
      exception_approved INTEGER NOT NULL DEFAULT 0,
      exception_reason TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS implementation_indicators (
      id INTEGER PRIMARY KEY,
      indicator_no INTEGER NOT NULL UNIQUE,
      title_np TEXT NOT NULL,
      title_en TEXT NOT NULL,
      is_required INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS indicator_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      indicator_id INTEGER NOT NULL REFERENCES implementation_indicators(id),
      indicator_no INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT '',
      remarks TEXT NOT NULL DEFAULT '',
      evidence_details TEXT NOT NULL DEFAULT '',
      attachment_id INTEGER,
      UNIQUE(submission_id, indicator_id)
    );

    CREATE TABLE IF NOT EXISTS service_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      serial_no INTEGER NOT NULL,
      service_name TEXT NOT NULL DEFAULT '',
      is_prepared INTEGER NOT NULL DEFAULT 0,
      is_approved INTEGER NOT NULL DEFAULT 0,
      is_in_use INTEGER NOT NULL DEFAULT 0,
      approval_date TEXT NOT NULL DEFAULT '',
      is_free INTEGER NOT NULL DEFAULT 0,
      is_notice_board INTEGER NOT NULL DEFAULT 0,
      is_website INTEGER NOT NULL DEFAULT 0,
      website_url TEXT NOT NULL DEFAULT '',
      received_count INTEGER NOT NULL DEFAULT 0,
      disposed_count INTEGER NOT NULL DEFAULT 0,
      pending_count INTEGER NOT NULL DEFAULT 0,
      returned_count INTEGER NOT NULL DEFAULT 0,
      within_deadline_count INTEGER NOT NULL DEFAULT 0,
      prescribed_timeline TEXT NOT NULL DEFAULT '',
      remarks TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS monitoring_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
      monitoring_date TEXT NOT NULL DEFAULT '',
      monitoring_conclusion TEXT NOT NULL DEFAULT '',
      previous_report_status TEXT NOT NULL DEFAULT '',
      center_directive_status TEXT NOT NULL DEFAULT '',
      improvements_made TEXT NOT NULL DEFAULT '',
      evidence_approved_sample INTEGER NOT NULL DEFAULT 0,
      evidence_website_notice INTEGER NOT NULL DEFAULT 0,
      evidence_service_record INTEGER NOT NULL DEFAULT 0,
      evidence_other INTEGER NOT NULL DEFAULT 0,
      evidence_other_text TEXT NOT NULL DEFAULT '',
      privacy_confirmed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS corrective_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      main_problem TEXT NOT NULL DEFAULT '',
      root_cause TEXT NOT NULL DEFAULT '',
      corrective_step TEXT NOT NULL DEFAULT '',
      responsible_person TEXT NOT NULL DEFAULT '',
      responsible_unit TEXT NOT NULL DEFAULT '',
      target_deadline TEXT NOT NULL DEFAULT '',
      expected_facilitation TEXT NOT NULL DEFAULT '',
      remarks TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS submission_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      indicator_no INTEGER,
      category TEXT NOT NULL DEFAULT 'general',
      file_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS certifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      tier TEXT NOT NULL CHECK(tier IN ('preparer','reviewer','head')),
      name_designation TEXT NOT NULL DEFAULT '',
      signature_text TEXT NOT NULL DEFAULT '',
      signed_date TEXT NOT NULL DEFAULT '',
      office_stamp_confirmed INTEGER NOT NULL DEFAULT 0,
      digital_pin_verified INTEGER NOT NULL DEFAULT 0,
      signed_doc_attachment_id INTEGER,
      UNIQUE(submission_id, tier)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      reviewer_id INTEGER NOT NULL REFERENCES users(id),
      decision TEXT NOT NULL,
      overall_remarks TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id),
      scope_type TEXT NOT NULL DEFAULT 'overall',
      scope_ref TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      is_directive INTEGER NOT NULL DEFAULT 0,
      requires_evidence INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feedback_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feedback_id INTEGER NOT NULL REFERENCES feedbacks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      message TEXT NOT NULL,
      attachment_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      office_id INTEGER REFERENCES government_offices(id),
      title_np TEXT NOT NULL,
      title_en TEXT NOT NULL,
      message_np TEXT NOT NULL,
      message_en TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      link_submission_id INTEGER REFERENCES submissions(id),
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details_json TEXT NOT NULL DEFAULT '{}',
      ip_address TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS submission_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_by INTEGER REFERENCES users(id),
      changed_by_name TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS submission_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      version_no INTEGER NOT NULL,
      submitted_by_name TEXT NOT NULL,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      summary_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_offices_province ON government_offices(province_id);
    CREATE INDEX IF NOT EXISTS idx_offices_district ON government_offices(district_id);
    CREATE INDEX IF NOT EXISTS idx_offices_ministry ON government_offices(ministry_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_period ON submissions(reporting_period_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
    CREATE INDEX IF NOT EXISTS idx_indicator_resp_sub ON indicator_responses(submission_id);
    CREATE INDEX IF NOT EXISTS idx_services_sub ON service_details(submission_id);
    CREATE INDEX IF NOT EXISTS idx_feedbacks_sub ON feedbacks(submission_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_office ON notifications(office_id);
  `);

  const roleCount = (db.prepare('SELECT COUNT(*) as c FROM roles').get() as { c: number }).c;
  if (roleCount === 0) {
    seedInitialData();
  }
}

function seedInitialData() {
  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Roles
    const rolesData = [
      { id: 1, code: 'super_admin', name_np: 'सुपर एडमिनिस्ट्रेटर', name_en: 'Super Administrator', desc: 'Full system control, master data & audit' },
      { id: 2, code: 'nvc_admin', name_np: 'राष्ट्रिय सतर्कता केन्द्र प्रशासक', name_en: 'NVC Administrator', desc: 'National monitoring, analytics, review & exports' },
      { id: 3, code: 'review_officer', name_np: 'केन्द्र समीक्षा अधिकृत', name_en: 'Center Review Officer', desc: 'Indicator review, feedback & directives' },
      { id: 4, code: 'ministry_user', name_np: 'मन्त्रालय/विभाग प्रयोगकर्ता', name_en: 'Ministry/Department User', desc: 'Monitor subordinate ministry offices' },
      { id: 5, code: 'office_user', name_np: 'सरकारी कार्यालय प्रयोगकर्ता', name_en: 'Government Office User', desc: 'Fill, save, certify and submit quarterly reports' },
      { id: 6, code: 'viewer_auditor', name_np: 'अवलोकनकर्ता/लेखापरीक्षक', name_en: 'Viewer / Auditor', desc: 'Read-only access to permitted scope' },
    ];
    const insRole = db.prepare('INSERT INTO roles (id, code, name_np, name_en, description) VALUES (?, ?, ?, ?, ?)');
    for (const r of rolesData) insRole.run(r.id, r.code, r.name_np, r.name_en, r.desc);

    // 2. Provinces
    const insProv = db.prepare('INSERT INTO provinces (id, code, name_np, name_en) VALUES (?, ?, ?, ?)');
    for (const p of PROVINCES) insProv.run(p.id, p.code, p.name_np, p.name_en);

    // 3. Districts (all 77)
    const insDist = db.prepare('INSERT INTO districts (id, province_id, geo_key, name_np, name_en) VALUES (?, ?, ?, ?, ?)');
    for (const d of DISTRICTS_77) insDist.run(d.id, d.province_id, d.geo_key, d.name_np, d.name_en);

    // 4. Local Levels (representative municipalities across key districts)
    const localLevelsSeed = [
      { district_id: 27, type_np: 'महानगरपालिका', name_np: 'काठमाडौं महानगरपालिका', name_en: 'Kathmandu Metropolitan City' },
      { district_id: 29, type_np: 'महानगरपालिका', name_np: 'ललितपुर महानगरपालिका', name_en: 'Lalitpur Metropolitan City' },
      { district_id: 23, type_np: 'नगरपालिका', name_np: 'भक्तपुर नगरपालिका', name_en: 'Bhaktapur Municipality' },
      { district_id: 38, type_np: 'महानगरपालिका', name_np: 'पोखरा महानगरपालिका', name_en: 'Pokhara Metropolitan City' },
      { district_id: 6, type_np: 'महानगरपालिका', name_np: 'विराटनगर महानगरपालिका', name_en: 'Biratnagar Metropolitan City' },
      { district_id: 18, type_np: 'महानगरपालिका', name_np: 'वीरगञ्ज महानगरपालिका', name_en: 'Birgunj Metropolitan City' },
      { district_id: 24, type_np: 'महानगरपालिका', name_np: 'भरतपुर महानगरपालिका', name_en: 'Bharatpur Metropolitan City' },
      { district_id: 16, type_np: 'उपमहानगरपालिका', name_np: 'जनकपुरधाम उपमहानगरपालिका', name_en: 'Janakpurdham Sub-Metropolitan' },
      { district_id: 58, type_np: 'उपमहानगरपालिका', name_np: 'बुटवल उपमहानगरपालिका', name_en: 'Butwal Sub-Metropolitan' },
      { district_id: 48, type_np: 'उपमहानगरपालिका', name_np: 'नेपालगञ्ज उपमहानगरपालिका', name_en: 'Nepalgunj Sub-Metropolitan' },
      { district_id: 76, type_np: 'उपमहानगरपालिका', name_np: 'धनगढी उपमहानगरपालिका', name_en: 'Dhangadhi Sub-Metropolitan' },
      { district_id: 67, type_np: 'नगरपालिका', name_np: 'वीरेन्द्रनगर नगरपालिका', name_en: 'Birendranagar Municipality' },
      { district_id: 74, type_np: 'नगरपालिका', name_np: 'महाकाली नगरपालिका', name_en: 'Mahakali Municipality' },
      { district_id: 74, type_np: 'गाउँपालिका', name_np: 'ब्यास गाउँपालिका', name_en: 'Byas Rural Municipality' },
      { district_id: 4, type_np: 'नगरपालिका', name_np: 'भद्रपुर नगरपालिका', name_en: 'Bhadrapur Municipality' },
      { id: 16, district_id: 11, type_np: 'उपमहानगरपालिका', name_np: 'इटहरी उपमहानगरपालिका', name_en: 'Itahari Sub-Metropolitan' },
      { id: 17, district_id: 30, type_np: 'उपमहानगरपालिका', name_np: 'हेटौंडा उपमहानगरपालिका', name_en: 'Hetauda Sub-Metropolitan' },
      { id: 18, district_id: 50, type_np: 'उपमहानगरपालिका', name_np: 'घोराही उपमहानगरपालिका', name_en: 'Ghorahi Sub-Metropolitan' },
      { id: 19, district_id: 63, type_np: 'नगरपालिका', name_np: 'चन्दननाथ नगरपालिका', name_en: 'Chandannath Municipality' },
      { id: 20, district_id: 41, type_np: 'गाउँपालिका', name_np: 'घरपझोङ गाउँपालिका', name_en: 'Gharapjhong Rural Municipality' },
      { id: 21, district_id: 77, type_np: 'नगरपालिका', name_np: 'भीमदत्त नगरपालिका', name_en: 'Bhimdatta Municipality' },
      { id: 22, district_id: 15, type_np: 'उपमहानगरपालिका', name_np: 'कलैया उपमहानगरपालिका', name_en: 'Kalaiya Sub-Metropolitan' },
      { id: 23, district_id: 37, type_np: 'नगरपालिका', name_np: 'गोरखा नगरपालिका', name_en: 'Gorkha Municipality' },
      { id: 24, district_id: 61, type_np: 'गाउँपालिका', name_np: 'सिमकोट गाउँपालिका', name_en: 'Simkot Rural Municipality' },
    ];
    const insLL = db.prepare('INSERT INTO local_levels (district_id, type_np, name_np, name_en) VALUES (?, ?, ?, ?)');
    for (const ll of localLevelsSeed) insLL.run(ll.district_id, ll.type_np, ll.name_np, ll.name_en);

    // 5. Ministries & Departments
    const insMin = db.prepare('INSERT INTO ministries (id, code, name_np, name_en, govt_level) VALUES (?, ?, ?, ?, ?)');
    for (const m of MINISTRIES_SEED) insMin.run(m.id, m.code, m.name_np, m.name_en, m.govt_level);

    const depsSeed = [
      { id: 1, ministry_id: 2, name_np: 'जिल्ला प्रशासन तथा शान्ति सुरक्षा विभाग', name_en: 'Department of Administration & Security' },
      { id: 2, ministry_id: 2, name_np: 'राष्ट्रिय परिचयपत्र तथा पञ्जीकरण विभाग', name_en: 'Dept. of National ID & Civil Registration' },
      { id: 3, ministry_id: 3, name_np: 'आन्तरिक राजस्व विभाग', name_en: 'Inland Revenue Department' },
      { id: 4, ministry_id: 3, name_np: 'भन्सार विभाग', name_en: 'Department of Customs' },
      { id: 5, ministry_id: 5, name_np: 'भूमि व्यवस्थापन तथा अभिलेख विभाग', name_en: 'Dept. of Land Management & Archive' },
      { id: 6, ministry_id: 5, name_np: 'नापी विभाग', name_en: 'Survey Department' },
      { id: 7, ministry_id: 6, name_np: 'यातायात व्यवस्था विभाग', name_en: 'Dept. of Transport Management' },
      { id: 8, ministry_id: 4, name_np: 'स्थानीय तह समन्वय महाशाखा', name_en: 'Local Level Coordination Division' },
      { id: 9, ministry_id: 7, name_np: 'स्वास्थ्य सेवा विभाग', name_en: 'Dept. of Health Services' },
      { id: 10, ministry_id: 8, name_np: 'शिक्षा तथा मानव स्रोत विकास केन्द्र', name_en: 'Center for Education & HRD' },
      { id: 11, ministry_id: 10, name_np: 'उद्योग विभाग', name_en: 'Department of Industry' },
      { id: 12, ministry_id: 9, name_np: 'कृषि विभाग', name_en: 'Department of Agriculture' },
    ];
    const insDep = db.prepare('INSERT INTO departments (id, ministry_id, name_np, name_en) VALUES (?, ?, ?, ?)');
    for (const d of depsSeed) insDep.run(d.id, d.ministry_id, d.name_np, d.name_en);

    // 6. Indicators (exact 9 from Section 2)
    const insInd = db.prepare('INSERT INTO implementation_indicators (id, indicator_no, title_np, title_en, is_required) VALUES (?, ?, ?, ?, ?)');
    for (const ind of OFFICIAL_INDICATORS) insInd.run(ind.id, ind.indicator_no, ind.title_np, ind.title_en, ind.is_required ? 1 : 0);

    // 7. Fiscal Years & Reporting Periods
    db.prepare("INSERT INTO fiscal_years (id, code, name_np, is_active) VALUES (1, '2082/83', '२०८२/८३', 0)").run();
    db.prepare("INSERT INTO fiscal_years (id, code, name_np, is_active) VALUES (2, '2083/84', '२०८३/८४', 1)").run();

    const periodsSeed = [
      { id: 1, fy: 1, q: 1, qnp: 'पहिलो त्रैमासिक (श्रावण–असोज)', qen: 'Q1 (Shrawan–Ashwin)', s: '2082/04/01', e: '2082/06/31', dbs: '2082/07/15', dad: '2025-11-01', st: 'closed' },
      { id: 2, fy: 1, q: 2, qnp: 'दोस्रो त्रैमासिक (कात्तिक–पुस)', qen: 'Q2 (Kartik–Poush)', s: '2082/07/01', e: '2082/09/30', dbs: '2082/10/15', dad: '2026-01-29', st: 'closed' },
      { id: 3, fy: 1, q: 3, qnp: 'तेस्रो त्रैमासिक (माघ–चैत)', qen: 'Q3 (Magh–Chaitra)', s: '2082/10/01', e: '2082/12/30', dbs: '2083/01/15', dad: '2026-04-28', st: 'closed' },
      { id: 4, fy: 1, q: 4, qnp: 'चौथो त्रैमासिक (वैशाख–असार)', qen: 'Q4 (Baisakh–Ashadh)', s: '2083/01/01', e: '2083/03/31', dbs: '2083/04/15', dad: '2026-07-31', st: 'closed' },
      { id: 5, fy: 2, q: 1, qnp: 'पहिलो त्रैमासिक (श्रावण–असोज)', qen: 'Q1 (Shrawan–Ashwin)', s: '2083/04/01', e: '2083/06/31', dbs: '2083/08/25', dad: '2026-12-11', st: 'open' },
      { id: 6, fy: 2, q: 2, qnp: 'दोस्रो त्रैमासिक (कात्तिक–पुस)', qen: 'Q2 (Kartik–Poush)', s: '2083/07/01', e: '2083/09/30', dbs: '2083/10/15', dad: '2027-01-29', st: 'open' },
      { id: 7, fy: 2, q: 3, qnp: 'तेस्रो त्रैमासिक (माघ–चैत)', qen: 'Q3 (Magh–Chaitra)', s: '2083/10/01', e: '2083/12/30', dbs: '2084/01/15', dad: '2027-04-28', st: 'closed' },
      { id: 8, fy: 2, q: 4, qnp: 'चौथो त्रैमासिक (वैशाख–असार)', qen: 'Q4 (Baisakh–Ashadh)', s: '2084/01/01', e: '2084/03/31', dbs: '2084/04/15', dad: '2027-07-31', st: 'closed' },
    ];
    const insPeriod = db.prepare(
      `INSERT INTO reporting_periods (id, fiscal_year_id, quarter_number, quarter_name_np, quarter_name_en, start_date_bs, end_date_bs, deadline_bs, deadline_ad, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const p of periodsSeed) insPeriod.run(p.id, p.fy, p.q, p.qnp, p.qen, p.s, p.e, p.dbs, p.dad, p.st);

    // 8. Government Offices (42 realistic offices across all 7 provinces & all 3 tiers)
    const officesSeed = [
      // Bagmati (3)
      { id: 1, code: 'NVC-FED-001', nnp: 'जिल्ला प्रशासन कार्यालय, काठमाडौं', nen: 'District Administration Office, Kathmandu', tnp: 'जिल्ला प्रशासन कार्यालय', ten: 'District Administration Office', lvl: 'federal', min: 2, dep: 1, prov: 3, dist: 27, ll: 1, addrnp: 'बबरमहल, काठमाडौं', addren: 'Babarmahal, Kathmandu', head: 'ऋषिराम तिवारी (प्रमुख जिल्ला अधिकारी)', hdes: 'प्रमुख जिल्ला अधिकारी', ph: '01-4262478', em: 'dao.ktm@moha.gov.np', web: 'https://daokathmandu.moha.gov.np' },
      { id: 2, code: 'NVC-LOC-002', nnp: 'ललितपुर महानगरपालिका', nen: 'Lalitpur Metropolitan City', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 3, dist: 29, ll: 2, addrnp: 'पुल्चोक, ललितपुर', addren: 'Pulchowk, Lalitpur', head: 'चिरिबाबु महर्जन / प्रमुख प्रशासकीय अधिकृत', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '01-5521571', em: 'info@lalitpurmun.gov.np', web: 'https://lalitpurmun.gov.np' },
      { id: 3, code: 'NVC-FED-003', nnp: 'मालपोत कार्यालय, डिल्लीबजार', nen: 'Land Revenue Office, Dillibazar', tnp: 'मालपोत कार्यालय', ten: 'Land Revenue Office', lvl: 'federal', min: 5, dep: 5, prov: 3, dist: 27, ll: 1, addrnp: 'डिल्लीबजार, काठमाडौं', addren: 'Dillibazar, Kathmandu', head: 'कमल प्रसाद तिमिल्सिना (प्रमुख मालपोत अधिकृत)', hdes: 'प्रमुख मालपोत अधिकृत', ph: '01-4411234', em: 'lro.dillibazar@molcpa.gov.np', web: 'https://dolma.gov.np' },
      { id: 4, code: 'NVC-FED-004', nnp: 'आन्तरिक राजस्व कार्यालय, बानेश्वर', nen: 'Inland Revenue Office, Baneshwor', tnp: 'आन्तरिक राजस्व कार्यालय', ten: 'Inland Revenue Office', lvl: 'federal', min: 3, dep: 3, prov: 3, dist: 27, ll: 1, addrnp: 'नयाँ बानेश्वर, काठमाडौं', addren: 'New Baneshwor, Kathmandu', head: 'सुमन दाहाल (प्रमुख कर अधिकृत)', hdes: 'प्रमुख कर अधिकृत', ph: '01-4782311', em: 'iro.baneshwor@ird.gov.np', web: 'https://ird.gov.np' },
      { id: 5, code: 'NVC-PRV-005', nnp: 'यातायात व्यवस्था कार्यालय, एकान्तकुना', nen: 'Transport Management Office, Ekantakuna', tnp: 'यातायात व्यवस्था कार्यालय', ten: 'Transport Management Office', lvl: 'provincial', min: 6, dep: 7, prov: 3, dist: 29, ll: 2, addrnp: 'एकान्तकुना, ललितपुर', addren: 'Ekantakuna, Lalitpur', head: 'राजुभाइ कुसवाह (कार्यालय प्रमुख)', hdes: 'कार्यालय प्रमुख', ph: '01-5001812', em: 'tmo.ekantakuna@bagamati.gov.np', web: 'https://dotm.bagamati.gov.np' },
      { id: 6, code: 'NVC-LOC-006', nnp: 'भक्तपुर नगरपालिका', nen: 'Bhaktapur Municipality', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 3, dist: 23, ll: 3, addrnp: 'दरबार क्षेत्र, भक्तपुर', addren: 'Durbar Square, Bhaktapur', head: 'वसन्त भट्टराई (प्रमुख प्रशासकीय अधिकृत)', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '01-6610988', em: 'info@bhaktapurmun.gov.np', web: 'https://bhaktapurmun.gov.np' },
      { id: 7, code: 'NVC-LOC-007', nnp: 'भरतपुर महानगरपालिका', nen: 'Bharatpur Metropolitan City', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 3, dist: 24, ll: 7, addrnp: 'भरतपुर, चितवन', addren: 'Bharatpur, Chitwan', head: 'नरेन्द्र कुमार राना (प्रमुख प्रशासकीय अधिकृत)', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '056-520720', em: 'info@bharatpurmun.gov.np', web: 'https://bharatpurmun.gov.np' },
      { id: 8, code: 'NVC-FED-008', nnp: 'जिल्ला प्रशासन कार्यालय, मकवानपुर', nen: 'District Administration Office, Makwanpur', tnp: 'जिल्ला प्रशासन कार्यालय', ten: 'District Administration Office', lvl: 'federal', min: 2, dep: 1, prov: 3, dist: 30, ll: 17, addrnp: 'हेटौंडा, मकवानपुर', addren: 'Hetauda, Makwanpur', head: 'तीर्थराज चिलुवाल (प्रमुख जिल्ला अधिकारी)', hdes: 'प्रमुख जिल्ला अधिकारी', ph: '057-520201', em: 'dao.makwanpur@moha.gov.np', web: 'https://daomakwanpur.moha.gov.np' },
      { id: 9, code: 'NVC-FED-009', nnp: 'वीर अस्पताल (चिकित्सा विज्ञान राष्ट्रिय प्रतिष्ठान)', nen: 'Bir Hospital (NAMS)', tnp: 'संघीय अस्पताल', ten: 'Federal Hospital', lvl: 'federal', min: 7, dep: 9, prov: 3, dist: 27, ll: 1, addrnp: 'महाबौद्ध, काठमाडौं', addren: 'Mahaboudha, Kathmandu', head: 'डा. सन्तोष पौडेल (निर्देशक)', hdes: 'निर्देशक', ph: '01-4221119', em: 'info@birhospital.gov.np', web: 'https://nams.org.np' },
      { id: 10, code: 'NVC-FED-010', nnp: 'जिल्ला प्रशासन कार्यालय, काभ्रेपलाञ्चोक', nen: 'District Administration Office, Kavrepalanchowk', tnp: 'जिल्ला प्रशासन कार्यालय', ten: 'District Administration Office', lvl: 'federal', min: 2, dep: 1, prov: 3, dist: 28, ll: null, addrnp: 'धुलिखेल, काभ्रे', addren: 'Dhulikhel, Kavre', head: 'उमेश कुमार ढकाल (प्रमुख जिल्ला अधिकारी)', hdes: 'प्रमुख जिल्ला अधिकारी', ph: '011-490133', em: 'dao.kavre@moha.gov.np', web: 'https://daokavre.moha.gov.np' },

      // Koshi (1)
      { id: 11, code: 'NVC-FED-011', nnp: 'जिल्ला प्रशासन कार्यालय, मोरङ', nen: 'District Administration Office, Morang', tnp: 'जिल्ला प्रशासन कार्यालय', ten: 'District Administration Office', lvl: 'federal', min: 2, dep: 1, prov: 1, dist: 6, ll: 5, addrnp: 'विराटनगर, मोरङ', addren: 'Biratnagar, Morang', head: 'प्रेम प्रसाद भट्टराई (प्रमुख जिल्ला अधिकारी)', hdes: 'प्रमुख जिल्ला अधिकारी', ph: '021-515444', em: 'dao.morang@moha.gov.np', web: 'https://daomorang.moha.gov.np' },
      { id: 12, code: 'NVC-LOC-012', nnp: 'विराटनगर महानगरपालिका', nen: 'Biratnagar Metropolitan City', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 1, dist: 6, ll: 5, addrnp: 'विराटनगर, मोरङ', addren: 'Biratnagar, Morang', head: 'राजेन्द्र पराजुली (प्रमुख प्रशासकीय अधिकृत)', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '021-512233', em: 'info@biratnagarmun.gov.np', web: 'https://biratnagarmun.gov.np' },
      { id: 13, code: 'NVC-FED-013', nnp: 'मालपोत कार्यालय, झापा', nen: 'Land Revenue Office, Jhapa', tnp: 'मालपोत कार्यालय', ten: 'Land Revenue Office', lvl: 'federal', min: 5, dep: 5, prov: 1, dist: 4, ll: 15, addrnp: 'भद्रपुर, झापा', addren: 'Bhadrapur, Jhapa', head: 'योगेन्द्र दुलाल (प्रमुख मालपोत अधिकृत)', hdes: 'प्रमुख मालपोत अधिकृत', ph: '023-520144', em: 'lro.jhapa@molcpa.gov.np', web: 'https://dolma.gov.np' },
      { id: 14, code: 'NVC-LOC-014', nnp: 'इटहरी उपमहानगरपालिका', nen: 'Itahari Sub-Metropolitan City', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 1, dist: 11, ll: 16, addrnp: 'इटहरी, सुनसरी', addren: 'Itahari, Sunsari', head: 'रामचरित्र मेहता (प्रमुख प्रशासकीय अधिकृत)', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '025-580112', em: 'info@itaharimun.gov.np', web: 'https://itaharimun.gov.np' },
      { id: 15, code: 'NVC-FED-015', nnp: 'आन्तरिक राजस्व कार्यालय, धरान', nen: 'Inland Revenue Office, Dharan', tnp: 'आन्तरिक राजस्व कार्यालय', ten: 'Inland Revenue Office', lvl: 'federal', min: 3, dep: 3, prov: 1, dist: 11, ll: 16, addrnp: 'धरान, सुनसरी', addren: 'Dharan, Sunsari', head: 'तीर्थराज बराल (प्रमुख कर अधिकृत)', hdes: 'प्रमुख कर अधिकृत', ph: '025-520876', em: 'iro.dharan@ird.gov.np', web: 'https://ird.gov.np' },
      { id: 16, code: 'NVC-FED-016', nnp: 'जिल्ला प्रशासन कार्यालय, इलाम', nen: 'District Administration Office, Ilam', tnp: 'जिल्ला प्रशासन कार्यालय', ten: 'District Administration Office', lvl: 'federal', min: 2, dep: 1, prov: 1, dist: 3, ll: null, addrnp: 'इलाम बजार, इलाम', addren: 'Ilam Bazar, Ilam', head: 'कल्पना श्रेष्ठ (प्रमुख जिल्ला अधिकारी)', hdes: 'प्रमुख जिल्ला अधिकारी', ph: '027-520022', em: 'dao.ilam@moha.gov.np', web: 'https://daoilam.moha.gov.np' },

      // Madhesh (2)
      { id: 17, code: 'NVC-FED-017', nnp: 'जिल्ला प्रशासन कार्यालय, धनुषा', nen: 'District Administration Office, Dhanusha', tnp: 'जिल्ला प्रशासन कार्यालय', ten: 'District Administration Office', lvl: 'federal', min: 2, dep: 1, prov: 2, dist: 16, ll: 8, addrnp: 'जनकपुरधाम, धनुषा', addren: 'Janakpurdham, Dhanusha', head: 'रामुराज कडरिया (प्रमुख जिल्ला अधिकारी)', hdes: 'प्रमुख जिल्ला अधिकारी', ph: '041-520102', em: 'dao.dhanusha@moha.gov.np', web: 'https://daodhanusha.moha.gov.np' },
      { id: 18, code: 'NVC-LOC-018', nnp: 'जनकपुरधाम उपमहानगरपालिका', nen: 'Janakpurdham Sub-Metropolitan City', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 2, dist: 16, ll: 8, addrnp: 'जनकपुरधाम, धनुषा', addren: 'Janakpurdham, Dhanusha', head: 'मिथिला विहारी ठाकुर (प्रमुख प्रशासकीय अधिकृत)', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '041-520345', em: 'info@janakpurmun.gov.np', web: 'https://janakpurmun.gov.np' },
      { id: 19, code: 'NVC-FED-019', nnp: 'वीरगञ्ज भन्सार कार्यालय', nen: 'Birgunj Customs Office', tnp: 'भन्सार कार्यालय', ten: 'Customs Office', lvl: 'federal', min: 3, dep: 4, prov: 2, dist: 18, ll: 6, addrnp: 'वीरगञ्ज, पर्सा', addren: 'Birgunj, Parsa', head: 'दीपक लामिछाने (प्रमुख भन्सार प्रशासक)', hdes: 'प्रमुख भन्सार प्रशासक', ph: '051-522121', em: 'birgunj@customs.gov.np', web: 'https://customs.gov.np' },
      { id: 20, code: 'NVC-LOC-020', nnp: 'कलैया उपमहानगरपालिका', nen: 'Kalaiya Sub-Metropolitan City', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 2, dist: 15, ll: 22, addrnp: 'कलैया, बारा', addren: 'Kalaiya, Bara', head: 'नाथु साह (प्रमुख प्रशासकीय अधिकृत)', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '053-550111', em: 'info@kalaiyamun.gov.np', web: 'https://kalaiyamun.gov.np' },
      { id: 21, code: 'NVC-FED-021', nnp: 'मालपोत कार्यालय, सप्तरी', nen: 'Land Revenue Office, Saptari', tnp: 'मालपोत कार्यालय', ten: 'Land Revenue Office', lvl: 'federal', min: 5, dep: 5, prov: 2, dist: 20, ll: null, addrnp: 'राजविराज, सप्तरी', addren: 'Rajbiraj, Saptari', head: 'रामकुमार यादव (प्रमुख मालपोत अधिकृत)', hdes: 'प्रमुख मालपोत अधिकृत', ph: '031-520411', em: 'lro.saptari@molcpa.gov.np', web: 'https://dolma.gov.np' },

      // Gandaki (4)
      { id: 22, code: 'NVC-FED-022', nnp: 'जिल्ला प्रशासन कार्यालय, कास्की', nen: 'District Administration Office, Kaski', tnp: 'जिल्ला प्रशासन कार्यालय', ten: 'District Administration Office', lvl: 'federal', min: 2, dep: 1, prov: 4, dist: 38, ll: 4, addrnp: 'शहीदचोक, पोखरा', addren: 'Shahid Chowk, Pokhara', head: 'भरतमणि पाण्डे (प्रमुख जिल्ला अधिकारी)', hdes: 'प्रमुख जिल्ला अधिकारी', ph: '061-462222', em: 'dao.kaski@moha.gov.np', web: 'https://daokaski.moha.gov.np' },
      { id: 23, code: 'NVC-LOC-023', nnp: 'पोखरा महानगरपालिका', nen: 'Pokhara Metropolitan City', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 4, dist: 38, ll: 4, addrnp: 'न्यूरोड, पोखरा', addren: 'New Road, Pokhara', head: 'श्यामकृष्ण थापा (प्रमुख प्रशासकीय अधिकृत)', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '061-521104', em: 'info@pokharamun.gov.np', web: 'https://pokharamun.gov.np' },
      { id: 24, code: 'NVC-PRV-024', nnp: 'कृषि विकास निर्देशनालय, गण्डकी प्रदेश', nen: 'Directorate of Agricultural Development, Gandaki', tnp: 'प्रदेश निर्देशनालय', ten: 'Provincial Directorate', lvl: 'provincial', min: 9, dep: 12, prov: 4, dist: 38, ll: 4, addrnp: 'पोखरा, कास्की', addren: 'Pokhara, Kaski', head: 'वासुदेव रेग्मी (निर्देशक)', hdes: 'निर्देशक', ph: '061-530421', em: 'agri@gandaki.gov.np', web: 'https://molmac.gandaki.gov.np' },
      { id: 25, code: 'NVC-LOC-025', nnp: 'गोरखा नगरपालिका', nen: 'Gorkha Municipality', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 4, dist: 37, ll: 23, addrnp: 'हरमटारी, गोरखा', addren: 'Haramtari, Gorkha', head: 'ज्ञाननाथ ढकाल (प्रमुख प्रशासकीय अधिकृत)', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '064-420105', em: 'info@gorkhamun.gov.np', web: 'https://gorkhamun.gov.np' },
      { id: 26, code: 'NVC-FED-026', nnp: 'जिल्ला प्रशासन कार्यालय, मुस्ताङ', nen: 'District Administration Office, Mustang', tnp: 'जिल्ला प्रशासन कार्यालय', ten: 'District Administration Office', lvl: 'federal', min: 2, dep: 1, prov: 4, dist: 41, ll: 20, addrnp: 'जोमसोम, मुस्ताङ', addren: 'Jomsom, Mustang', head: 'विष्णु प्रसाद भुसाल (प्रमुख जिल्ला अधिकारी)', hdes: 'प्रमुख जिल्ला अधिकारी', ph: '069-440101', em: 'dao.mustang@moha.gov.np', web: 'https://daomustang.moha.gov.np' },

      // Lumbini (5)
      { id: 27, code: 'NVC-FED-027', nnp: 'जिल्ला प्रशासन कार्यालय, रुपन्देही', nen: 'District Administration Office, Rupandehi', tnp: 'जिल्ला प्रशासन कार्यालय', ten: 'District Administration Office', lvl: 'federal', min: 2, dep: 1, prov: 5, dist: 58, ll: 9, addrnp: 'भैरहवा, रुपन्देही', addren: 'Bhairahawa, Rupandehi', head: 'गणेश अर्याल (प्रमुख जिल्ला अधिकारी)', hdes: 'प्रमुख जिल्ला अधिकारी', ph: '071-520105', em: 'dao.rupandehi@moha.gov.np', web: 'https://daorupandehi.moha.gov.np' },
      { id: 28, code: 'NVC-LOC-028', nnp: 'बुटवल उपमहानगरपालिका', nen: 'Butwal Sub-Metropolitan City', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 5, dist: 58, ll: 9, addrnp: 'बुटवल, रुपन्देही', addren: 'Butwal, Rupandehi', head: 'मित्रमणि खनाल (प्रमुख प्रशासकीय अधिकृत)', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '071-540120', em: 'info@butwalmun.gov.np', web: 'https://butwalmun.gov.np' },
      { id: 29, code: 'NVC-LOC-029', nnp: 'नेपालगञ्ज उपमहानगरपालिका', nen: 'Nepalgunj Sub-Metropolitan City', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 5, dist: 48, ll: 10, addrnp: 'नेपालगञ्ज, बाँके', addren: 'Nepalgunj, Banke', head: 'ओमबहादुर खड्का (प्रमुख प्रशासकीय अधिकृत)', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '081-520233', em: 'info@nepalgunjmun.gov.np', web: 'https://nepalgunjmun.gov.np' },
      { id: 30, code: 'NVC-LOC-030', nnp: 'घोराही उपमहानगरपालिका', nen: 'Ghorahi Sub-Metropolitan City', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 5, dist: 50, ll: 18, addrnp: 'घोराही, दाङ', addren: 'Ghorahi, Dang', head: 'भोजराज घिमिरे (प्रमुख प्रशासकीय अधिकृत)', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '082-560110', em: 'info@ghorahimun.gov.np', web: 'https://ghorahimun.gov.np' },
      { id: 31, code: 'NVC-FED-031', nnp: 'आन्तरिक राजस्व कार्यालय, भैरहवा', nen: 'Inland Revenue Office, Bhairahawa', tnp: 'आन्तरिक राजस्व कार्यालय', ten: 'Inland Revenue Office', lvl: 'federal', min: 3, dep: 3, prov: 5, dist: 58, ll: 9, addrnp: 'भैरहवा, रुपन्देही', addren: 'Bhairahawa, Rupandehi', head: 'मुक्तिराम आचार्य (प्रमुख कर अधिकृत)', hdes: 'प्रमुख कर अधिकृत', ph: '071-521445', em: 'iro.bhairahawa@ird.gov.np', web: 'https://ird.gov.np' },

      // Karnali (6)
      { id: 32, code: 'NVC-FED-032', nnp: 'जिल्ला प्रशासन कार्यालय, सुर्खेत', nen: 'District Administration Office, Surkhet', tnp: 'जिल्ला प्रशासन कार्यालय', ten: 'District Administration Office', lvl: 'federal', min: 2, dep: 1, prov: 6, dist: 67, ll: 12, addrnp: 'वीरेन्द्रनगर, सुर्खेत', addren: 'Birendranagar, Surkhet', head: 'शंकरहरि आचार्य (प्रमुख जिल्ला अधिकारी)', hdes: 'प्रमुख जिल्ला अधिकारी', ph: '083-520102', em: 'dao.surkhet@moha.gov.np', web: 'https://daosurkhet.moha.gov.np' },
      { id: 33, code: 'NVC-LOC-033', nnp: 'वीरेन्द्रनगर नगरपालिका', nen: 'Birendranagar Municipality', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 6, dist: 67, ll: 12, addrnp: 'वीरेन्द्रनगर, सुर्खेत', addren: 'Birendranagar, Surkhet', head: 'लक्ष्मी प्रसाद बास्कोटा (प्रमुख प्रशासकीय अधिकृत)', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '083-520256', em: 'info@birendranagarmun.gov.np', web: 'https://birendranagarmun.gov.np' },
      { id: 34, code: 'NVC-FED-034', nnp: 'जिल्ला प्रशासन कार्यालय, जुम्ला', nen: 'District Administration Office, Jumla', tnp: 'जिल्ला प्रशासन कार्यालय', ten: 'District Administration Office', lvl: 'federal', min: 2, dep: 1, prov: 6, dist: 63, ll: 19, addrnp: 'खलङ्गा, जुम्ला', addren: 'Khalanga, Jumla', head: 'रामबहादुर शाही (प्रमुख जिल्ला अधिकारी)', hdes: 'प्रमुख जिल्ला अधिकारी', ph: '087-520022', em: 'dao.jumla@moha.gov.np', web: 'https://daojumla.moha.gov.np' },
      { id: 35, code: 'NVC-LOC-035', nnp: 'सिमकोट गाउँपालिका', nen: 'Simkot Rural Municipality', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 6, dist: 61, ll: 24, addrnp: 'सिमकोट, हुम्ला', addren: 'Simkot, Humla', head: 'नविन बोहरा (प्रमुख प्रशासकीय अधिकृत)', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '087-680115', em: 'info@simkotmun.gov.np', web: 'https://simkotmun.gov.np' },
      { id: 36, code: 'NVC-PRV-036', nnp: 'भौतिक पूर्वाधार विकास निर्देशनालय, कर्णाली', nen: 'Infrastructure Development Directorate, Karnali', tnp: 'प्रदेश निर्देशनालय', ten: 'Provincial Directorate', lvl: 'provincial', min: 6, dep: 7, prov: 6, dist: 67, ll: 12, addrnp: 'वीरेन्द्रनगर, सुर्खेत', addren: 'Birendranagar, Surkhet', head: 'रामशरण आचार्य (निर्देशक)', hdes: 'निर्देशक', ph: '083-521890', em: 'idd@karnali.gov.np', web: 'https://mopid.karnali.gov.np' },

      // Sudurpashchim (7) - including Darchula!
      { id: 37, code: 'NVC-FED-037', nnp: 'जिल्ला प्रशासन कार्यालय, कैलाली', nen: 'District Administration Office, Kailali', tnp: 'जिल्ला प्रशासन कार्यालय', ten: 'District Administration Office', lvl: 'federal', min: 2, dep: 1, prov: 7, dist: 76, ll: 11, addrnp: 'धनगढी, कैलाली', addren: 'Dhangadhi, Kailali', head: 'धर्मेन्द्र कुमार मिश्र (प्रमुख जिल्ला अधिकारी)', hdes: 'प्रमुख जिल्ला अधिकारी', ph: '091-521102', em: 'dao.kailali@moha.gov.np', web: 'https://daokailali.moha.gov.np' },
      { id: 38, code: 'NVC-LOC-038', nnp: 'धनगढी उपमहानगरपालिका', nen: 'Dhangadhi Sub-Metropolitan City', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 7, dist: 76, ll: 11, addrnp: 'धनगढी, कैलाली', addren: 'Dhangadhi, Kailali', head: 'नरेन्द्र बहादुर खाती (प्रमुख प्रशासकीय अधिकृत)', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '091-521333', em: 'info@dhangadhimun.gov.np', web: 'https://dhangadhimun.gov.np' },
      { id: 39, code: 'NVC-FED-039', nnp: 'जिल्ला प्रशासन कार्यालय, दार्चुला', nen: 'District Administration Office, Darchula', tnp: 'जिल्ला प्रशासन कार्यालय', ten: 'District Administration Office', lvl: 'federal', min: 2, dep: 1, prov: 7, dist: 74, ll: 13, addrnp: 'खलङ्गा, दार्चुला', addren: 'Khalanga, Darchula', head: 'यज्ञराज जोशी (प्रमुख जिल्ला अधिकारी)', hdes: 'प्रमुख जिल्ला अधिकारी', ph: '093-420102', em: 'dao.darchula@moha.gov.np', web: 'https://daodarchula.moha.gov.np' },
      { id: 40, code: 'NVC-LOC-040', nnp: 'ब्यास गाउँपालिका, दार्चुला', nen: 'Byas Rural Municipality, Darchula', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 7, dist: 74, ll: 14, addrnp: 'सुनसेरा, दार्चुला', addren: 'Sunsera, Darchula', head: 'रमेश सिंह कुँवर (प्रमुख प्रशासकीय अधिकृत)', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '093-420411', em: 'info@byasmun.gov.np', web: 'https://byasmun.gov.np' },
      { id: 41, code: 'NVC-LOC-041', nnp: 'भीमदत्त नगरपालिका, कञ्चनपुर', nen: 'Bhimdatta Municipality, Kanchanpur', tnp: 'स्थानीय तह', ten: 'Local Government', lvl: 'local', min: 4, dep: 8, prov: 7, dist: 77, ll: 21, addrnp: 'महेन्द्रनगर, कञ्चनपुर', addren: 'Mahendranagar, Kanchanpur', head: 'महेश बहादुर बम (प्रमुख प्रशासकीय अधिकृत)', hdes: 'प्रमुख प्रशासकीय अधिकृत', ph: '099-521245', em: 'info@bhimdattamun.gov.np', web: 'https://bhimdattamun.gov.np' },
      { id: 42, code: 'NVC-FED-042', nnp: 'उद्योग तथा वाणिज्य कार्यालय, पाटन', nen: 'Industry & Commerce Office, Baitadi', tnp: 'उद्योग कार्यालय', ten: 'Industry Office', lvl: 'provincial', min: 10, dep: 11, prov: 7, dist: 70, ll: null, addrnp: 'पाटन, बैतडी', addren: 'Patan, Baitadi', head: 'अर्जुन सिंह कार्की (कार्यालय प्रमुख)', hdes: 'कार्यालय प्रमुख', ph: '095-520198', em: 'industry.baitadi@sudurpashchim.gov.np', web: 'https://moitfe.sudurpashchim.gov.np' },
    ];
    const insOff = db.prepare(
      `INSERT INTO government_offices (id, office_code, name_np, name_en, office_type_np, office_type_en, govt_level, ministry_id, department_id, province_id, district_id, local_level_id, address_np, address_en, office_head_name, office_head_designation, contact_phone, email, website, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    );
    for (const o of officesSeed) {
      insOff.run(o.id, o.code, o.nnp, o.nen, o.tnp, o.ten, o.lvl, o.min, o.dep, o.prov, o.dist, o.ll, o.addrnp, o.addren, o.head, o.hdes, o.ph, o.em, o.web);
    }

    // 9. Users (all 6 roles)
    const demoPassHash = hashSeedPassword('Nvc@2083');
    const usersSeed = [
      { id: 1, un: 'superadmin', em: 'superadmin@nvc.gov.np', np: 'महेश्वर न्यौपाने', en: 'Maheshwor Neupane', dnp: 'प्रमुख सूचना प्रविधि निर्देशक', den: 'Chief IT Director', ph: '01-4200101', min: null, prov: null, roleId: 1 },
      { id: 2, un: 'nvcadmin', em: 'admin@nvc.gov.np', np: 'सरिता अधिकारी', en: 'Sarita Adhikari', dnp: 'सह-सचिव (अनुगमन महाशाखा)', den: 'Joint Secretary (Monitoring Division)', ph: '01-4200102', min: null, prov: null, roleId: 2 },
      { id: 3, un: 'reviewer', em: 'reviewer@nvc.gov.np', np: 'राजन कुमार पौडेल', en: 'Rajan Kumar Poudel', dnp: 'उप-सचिव (समीक्षा अधिकृत)', den: 'Under Secretary (Review Officer)', ph: '01-4200103', min: null, prov: null, roleId: 3 },
      { id: 4, un: 'mohaministry', em: 'ministry@moha.gov.np', np: 'दीपकराज नेपाल', en: 'Dipak Raj Nepal', dnp: 'मन्त्रालय अनुगमन फोकल पर्सन', den: 'Ministry Monitoring Focal Person', ph: '01-4211214', min: 2, prov: null, roleId: 4 },
      { id: 5, un: 'daoktm', em: 'office.dao.ktm@gov.np', np: 'नारायण प्रसाद शर्मा', en: 'Narayan Prasad Sharma', dnp: 'प्रशासकीय अधिकृत (प्रतिवेदन अधिकारी)', den: 'Administrative Officer (Reporting Officer)', ph: '9841223344', min: 2, prov: 3, roleId: 5 },
      { id: 6, un: 'lalitpurmun', em: 'office.lalitpur@gov.np', np: 'प्रभा श्रेष्ठ', en: 'Prabha Shrestha', dnp: 'योजना तथा अनुगमन अधिकृत', den: 'Planning & Monitoring Officer', ph: '9851144556', min: 4, prov: 3, roleId: 5 },
      { id: 7, un: 'daodarchula', em: 'office.darchula@gov.np', np: 'लोकेन्द्र बहादुर बडाल', en: 'Lokendra Bahadur Badal', dnp: 'नायब सुब्बा (सहायक प्रतिवेदन अधिकारी)', den: 'Nayab Subba (Reporting Officer)', ph: '9848776655', min: 2, prov: 7, roleId: 5 },
      { id: 8, un: 'auditor', em: 'auditor@nvc.gov.np', np: 'विमल कोइराला', en: 'Bimal Koirala', dnp: 'वरिष्ठ लेखापरीक्षक', den: 'Senior Auditor', ph: '01-4200199', min: null, prov: null, roleId: 6 },
    ];
    const insUser = db.prepare(
      `INSERT INTO users (id, username, email, password_hash, full_name_np, full_name_en, designation_np, designation_en, phone, ministry_id, province_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    );
    const insUserRole = db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
    for (const u of usersSeed) {
      insUser.run(u.id, u.un, u.em, demoPassHash, u.np, u.en, u.dnp, u.den, u.ph, u.min, u.prov);
      insUserRole.run(u.id, u.roleId);
    }

    // Link office users to offices (supporting multiple offices/users)
    db.prepare('INSERT INTO office_users (office_id, user_id, is_head, can_submit, is_primary) VALUES (1, 5, 0, 1, 1)').run();
    db.prepare('INSERT INTO office_users (office_id, user_id, is_head, can_submit, is_primary) VALUES (3, 5, 0, 1, 0)').run();
    db.prepare('INSERT INTO office_users (office_id, user_id, is_head, can_submit, is_primary) VALUES (2, 6, 0, 1, 1)').run();
    db.prepare('INSERT INTO office_users (office_id, user_id, is_head, can_submit, is_primary) VALUES (39, 7, 0, 1, 1)').run();

    // 10. System Settings
    const settingsSeed = [
      ['system_name_np', 'राष्ट्रिय सतर्कता केन्द्र — त्रैमासिक प्रगति प्रतिवेदन प्रणाली', 'Official System Title (Nepali)'],
      ['directive_ref', 'सरकारी कार्यालयमा प्रयोग हुने निवेदनको ढाँचा तथा सोको कार्यान्वयन मार्गदर्शन, २०८३ (निर्णय मिति: २०८३/०४/२१)', 'Directive Reference'],
      ['max_attachment_mb', '5', 'Maximum attachment file size in MB'],
      ['auto_save_interval_sec', '20', 'Form auto-save interval in seconds'],
      ['require_head_certification', 'true', 'Require Office Head certification before Final Submit'],
    ];
    const insSet = db.prepare('INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)');
    for (const [k, v, d] of settingsSeed) insSet.run(k, v, d);

    // 11. Seed realistic historical submissions (2082/83 Q1-Q4 for top 18 offices) and current 2083/84 Q1 across all 42 offices!
    const sampleServicesCatalog = [
      { name: 'नागरिकता प्रमाणपत्र / प्रतिलिपि सिफारिस', timeline: 'सोही दिन', rec: 420, dispRatio: 0.94, withinRatio: 0.91 },
      { name: 'जग्गा नामसारी तथा रजिष्ट्रेशन सेवा', timeline: '३ कार्यदिन', rec: 315, dispRatio: 0.87, withinRatio: 0.84 },
      { name: 'व्यवसाय दर्ता तथा नवीकरण सेवा', timeline: '२ कार्यदिन', rec: 190, dispRatio: 0.92, withinRatio: 0.89 },
      { name: 'राहदानी तथा सिफारिस प्रमाणीकरण', timeline: 'सोही दिन', rec: 280, dispRatio: 0.96, withinRatio: 0.94 },
      { name: 'कर चुक्ता तथा स्थायी लेखा नम्बर सेवा', timeline: '१ कार्यदिन', rec: 360, dispRatio: 0.90, withinRatio: 0.88 },
      { name: 'सामाजिक सुरक्षा तथा पञ्जीकरण सेवा', timeline: 'सोही दिन', rec: 245, dispRatio: 0.95, withinRatio: 0.93 },
    ];

    const insSub = db.prepare(
      `INSERT INTO submissions (office_id, reporting_period_id, status, version_no, is_timely, implementation_score, submitted_by, submitted_at, reviewed_by, reviewed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insSum = db.prepare(
      `INSERT INTO office_progress_summary (submission_id, office_name, address, contact_info, level_ministry, office_head, total_services, prepared_forms, approved_forms, in_use_forms, free_available_forms, digital_available_forms, major_achievements, exception_approved, exception_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insIndResp = db.prepare(
      `INSERT INTO indicator_responses (submission_id, indicator_id, indicator_no, status, remarks, evidence_details)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const insSvc = db.prepare(
      `INSERT INTO service_details (submission_id, serial_no, service_name, is_prepared, is_approved, is_in_use, approval_date, is_free, is_notice_board, is_website, website_url, received_count, disposed_count, pending_count, returned_count, within_deadline_count, prescribed_timeline, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insMon = db.prepare(
      `INSERT INTO monitoring_details (submission_id, monitoring_date, monitoring_conclusion, previous_report_status, center_directive_status, improvements_made, evidence_approved_sample, evidence_website_notice, evidence_service_record, evidence_other, evidence_other_text, privacy_confirmed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    );
    const insCorr = db.prepare(
      `INSERT INTO corrective_actions (submission_id, main_problem, root_cause, corrective_step, responsible_person, responsible_unit, target_deadline, expected_facilitation, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insCert = db.prepare(
      `INSERT INTO certifications (submission_id, tier, name_designation, signature_text, signed_date, office_stamp_confirmed, digital_pin_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insHist = db.prepare(
      `INSERT INTO submission_status_history (submission_id, from_status, to_status, changed_by, changed_by_name, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insVer = db.prepare(
      `INSERT INTO submission_versions (submission_id, version_no, submitted_by_name, submitted_at, summary_json)
       VALUES (?, ?, ?, ?, ?)`
    );

    const statusPool2083Q1: Array<{ status: string; timely: number; scoreBase: number }> = [
      { status: 'Accepted', timely: 1, scoreBase: 92 },
      { status: 'Reviewed', timely: 1, scoreBase: 86 },
      { status: 'Under Review', timely: 1, scoreBase: 79 },
      { status: 'Submitted', timely: 1, scoreBase: 74 },
      { status: 'Returned for Correction', timely: 0, scoreBase: 58 },
      { status: 'Resubmitted', timely: 1, scoreBase: 81 },
      { status: 'Draft', timely: 1, scoreBase: 45 },
      { status: 'Not Started', timely: 0, scoreBase: 0 },
      { status: 'Overdue', timely: 0, scoreBase: 0 },
    ];

    // Seed historical 2082/83 (periods 1..4) for first 20 offices to power Quarterly Trends
    for (let periodId = 1; periodId <= 4; periodId++) {
      for (let idx = 0; idx < 22; idx++) {
        const off = officesSeed[idx];
        const baseScore = 52 + periodId * 7 + ((idx * 11) % 24);
        const clampedScore = Math.min(98, baseScore);
        const totalSvc = 12 + (idx % 14);
        const prep = Math.min(totalSvc, Math.round(totalSvc * (0.65 + periodId * 0.08)));
        const appr = Math.min(prep, Math.max(1, prep - (periodId < 3 ? 1 : 0)));
        const inUse = Math.min(appr, Math.max(1, appr - (idx % 3 === 0 && periodId < 4 ? 1 : 0)));
        const freeAv = inUse;
        const digAv = Math.max(1, inUse - (idx % 2));

        const subRes = insSub.run(
          off.id,
          periodId,
          'Accepted',
          1,
          idx % 6 === 0 ? 0 : 1,
          clampedScore,
          5,
          `2082-${String(periodId * 3 + 1).padStart(2, '0')}-12 14:20:00`,
          3,
          `2082-${String(periodId * 3 + 1).padStart(2, '0')}-20 11:00:00`,
          `2082-${String(periodId * 3 + 1).padStart(2, '0')}-20 11:00:00`
        );
        const subId = Number(subRes.lastInsertRowid);

        insSum.run(
          subId,
          off.nnp,
          off.addrnp,
          `${off.ph} / ${off.em}`,
          `${off.lvl === 'federal' ? 'संघ' : off.lvl === 'provincial' ? 'प्रदेश' : 'स्थानीय'} / ${MINISTRIES_SEED.find((m) => m.id === off.min)?.name_np || ''}`,
          off.head,
          totalSvc,
          prep,
          appr,
          inUse,
          freeAv,
          digAv,
          'निवेदन ढाँचा एकरूपता लागू गरिएको तथा सहायता कक्ष सञ्चालनमा ल्याइएको।',
          0,
          ''
        );

        for (let k = 1; k <= 9; k++) {
          const st = clampedScore >= 85 ? (k <= 7 ? 'पूर्ण' : 'आंशिक') : clampedScore >= 65 ? (k <= 5 ? 'पूर्ण' : k <= 8 ? 'आंशिक' : 'छैन') : k <= 3 ? 'पूर्ण' : 'आंशिक';
          insIndResp.run(subId, k, k, st, st === 'पूर्ण' ? 'कार्यान्वयन भइसकेको।' : 'क्रमशः सुधार भइरहेको।', 'कार्यालय अभिलेख तथा वेबसाइटमा अद्यावधिक।');
        }

        for (let s = 0; s < 6; s++) {
          const cat = sampleServicesCatalog[s];
          const rec = Math.round(cat.rec * (0.6 + ((idx + periodId) % 5) * 0.15));
          const disp = Math.round(rec * Math.min(0.97, cat.dispRatio - 0.03 + periodId * 0.01));
          const ret = Math.max(0, Math.round((rec - disp) * 0.25));
          const pend = rec - disp - ret;
          const within = Math.min(disp, Math.round(disp * Math.min(0.96, cat.withinRatio - 0.03 + periodId * 0.015)));
          insSvc.run(
            subId,
            s + 1,
            cat.name,
            1,
            1,
            1,
            '2082/05/10',
            1,
            1,
            s < 4 ? 1 : 0,
            s < 4 ? off.web : '',
            rec,
            disp,
            pend,
            ret,
            within,
            cat.timeline,
            pend > 0 ? 'आवश्यक कागजात प्रमाणिकरण प्रक्रियामा रहेको' : 'समयसीमाभित्र फर्छ्योट'
          );
        }

        insMon.run(subId, '2082/06/20', 'त्रैमासिक आन्तरिक समीक्षा सम्पन्न।', 'अघिल्लो त्रैमासिकका सुझावहरू कार्यान्वयन गरिएको।', 'केन्द्रको मार्गदर्शन अनुसार सुधार जारी।', 'नागरिक बडापत्र र वेबसाइट अद्यावधिक।', 1, 1, 1, 0, '');
        insCorr.run(subId, 'केही सेवामा अनलाइन ढाँचा प्रयोग कम देखिएको', 'सेवाग्राहीमा डिजिटल साक्षरताको कमी', 'सहायता कक्षमार्फत सहजीकरण', 'प्रशासकीय अधिकृत', 'प्रशासन शाखा', '2083/01/15', 'प्राविधिक समन्वय', 'नियमित अनुगमन भइरहेको');
        insCert.run(subId, 'preparer', 'प्रशासकीय अधिकृत', 'डिजिटल स्वीकृत', '2082/06/28', 0, 1);
        insCert.run(subId, 'reviewer', 'वरिष्ठ प्रशासकीय अधिकृत', 'डिजिटल स्वीकृत', '2082/06/29', 0, 1);
        insCert.run(subId, 'head', off.head, 'डिजिटल प्रमाणित', '2082/06/30', 1, 1);
      }
    }

    // Seed 2083/84 Q1 (periodId = 5) across all 42 offices
    for (let idx = 0; idx < officesSeed.length; idx++) {
      const off = officesSeed[idx];
      // Make office 1 (DAO Kathmandu -> Returned for Correction so office_user sees rich 2-way feedback!), office 2 (Lalitpur -> Submitted), office 39 (Darchula -> Draft)
      let spec = statusPool2083Q1[idx % statusPool2083Q1.length];
      if (off.id === 1) spec = { status: 'Returned for Correction', timely: 1, scoreBase: 76 };
      if (off.id === 2) spec = { status: 'Submitted', timely: 1, scoreBase: 88 };
      if (off.id === 3) spec = { status: 'Under Review', timely: 1, scoreBase: 82 };
      if (off.id === 39) spec = { status: 'Draft', timely: 1, scoreBase: 61 };
      if (off.id === 11) spec = { status: 'Accepted', timely: 1, scoreBase: 94 };
      if (off.id === 22) spec = { status: 'Accepted', timely: 1, scoreBase: 91 };
      if (off.id === 37) spec = { status: 'Reviewed', timely: 1, scoreBase: 85 };

      const isBlank = spec.status === 'Not Started' || spec.status === 'Overdue';
      const totalSvc = 14 + (idx % 12);
      const prep = isBlank ? 0 : Math.min(totalSvc, Math.round(totalSvc * (spec.scoreBase / 100)));
      const appr = isBlank ? 0 : Math.min(prep, Math.max(1, prep - (spec.scoreBase < 75 ? 2 : 0)));
      const inUse = isBlank ? 0 : Math.min(appr, Math.max(1, appr - (spec.scoreBase < 80 ? 1 : 0)));
      const freeAv = inUse;
      const digAv = isBlank ? 0 : Math.max(1, inUse - (idx % 3 === 0 ? 1 : 0));

      const subRes = insSub.run(
        off.id,
        5,
        spec.status,
        spec.status === 'Resubmitted' ? 2 : 1,
        spec.timely,
        isBlank ? 0 : Math.min(100, spec.scoreBase + (idx % 5)),
        5,
        isBlank || spec.status === 'Draft' ? null : '2083-08-05 15:30:00',
        spec.status === 'Accepted' || spec.status === 'Reviewed' ? 3 : null,
        spec.status === 'Accepted' || spec.status === 'Reviewed' ? '2083-08-08 10:15:00' : null,
        '2083-08-08 10:15:00'
      );
      const subId = Number(subRes.lastInsertRowid);

      insSum.run(
        subId,
        off.nnp,
        off.addrnp,
        `${off.ph} / ${off.em}`,
        `${off.lvl === 'federal' ? 'संघ' : off.lvl === 'provincial' ? 'प्रदेश' : 'स्थानीय'} / ${MINISTRIES_SEED.find((m) => m.id === off.min)?.name_np || ''}`,
        off.head,
        totalSvc,
        prep,
        appr,
        inUse,
        freeAv,
        digAv,
        isBlank ? '' : 'मार्गदर्शन २०८३ बमोजिम अधिकांश सेवाका निवेदन ढाँचा स्वीकृत भई निःशुल्क वितरण र सहायता कक्ष सञ्चालनमा रहेको।',
        0,
        ''
      );

      for (let k = 1; k <= 9; k++) {
        let st = '';
        if (!isBlank) {
          if (spec.scoreBase >= 88) st = k <= 8 ? 'पूर्ण' : 'आंशिक';
          else if (spec.scoreBase >= 75) st = k <= 6 ? 'पूर्ण' : k <= 8 ? 'आंशिक' : 'छैन';
          else st = k <= 3 ? 'पूर्ण' : k <= 7 ? 'आंशिक' : 'छैन';
        }
        insIndResp.run(
          subId,
          k,
          k,
          st,
          st === 'पूर्ण' ? 'पूर्ण रूपमा लागू गरिएको।' : st === 'आंशिक' ? 'कार्यान्वयन चरणमा रहेको।' : st === 'छैन' ? 'बजेट तथा जनशक्ति अभावका कारण बाँकी।' : '',
          st ? 'कार्यालय वेबसाइट तथा सूचनापाटी अभिलेख।' : ''
        );
      }

      if (!isBlank) {
        for (let s = 0; s < 6; s++) {
          const cat = sampleServicesCatalog[s];
          const rec = Math.round(cat.rec * (0.75 + (idx % 4) * 0.2));
          const disp = Math.round(rec * cat.dispRatio);
          const ret = Math.max(0, Math.round((rec - disp) * 0.25));
          const pend = rec - disp - ret;
          const within = Math.min(disp, Math.round(disp * cat.withinRatio));
          insSvc.run(
            subId,
            s + 1,
            cat.name,
            1,
            1,
            s < 5 ? 1 : 0,
            '2083/05/12',
            1,
            1,
            s < 4 ? 1 : 0,
            s < 4 ? off.web : '',
            rec,
            disp,
            pend,
            ret,
            within,
            cat.timeline,
            pend > 0 ? 'कागजात अपूर्ण तथा स्थलगत सर्जमिन प्रक्रियामा' : 'तोकिएको समयभित्र सम्पन्न'
          );
        }
      }

      insMon.run(
        subId,
        isBlank ? '' : '2083/07/22',
        isBlank ? '' : 'आन्तरिक अनुगमन समितिबाट त्रैमासिक समीक्षा सम्पन्न भई सुधार कार्ययोजना स्वीकृत।',
        isBlank ? '' : 'अघिल्लो त्रैमासिकका ९०% सुझाव कार्यान्वयन भइसकेका।',
        isBlank ? '' : 'केन्द्रको निर्देशनबमोजिम अनधिकृत बिचौलिया प्रवेश निषेध सूचना टाँस गरिएको।',
        isBlank ? '' : 'Digital Kiosk र सहायता कक्षमा थप कर्मचारी खटाइएको।',
        isBlank ? 0 : 1,
        isBlank ? 0 : 1,
        isBlank ? 0 : 1,
        0,
        ''
      );

      insCorr.run(
        subId,
        isBlank ? '' : 'केही अनलाइन सेवामा दोहोरो कागजात माग हुने समस्या',
        isBlank ? '' : 'प्रणाली एकीकरण नहुनु',
        isBlank ? '' : 'डिजिटल ढाँचा अद्यावधिक र कर्मचारी अभिमुखीकरण',
        isBlank ? '' : 'सूचना प्रविधि अधिकृत',
        isBlank ? '' : 'सेवा प्रवाह तथा आईटी शाखा',
        isBlank ? '' : '2083/09/15',
        isBlank ? '' : 'केन्द्रीय पोर्टलमा साझा टेम्प्लेट उपलब्ध गराउने',
        isBlank ? '' : 'कार्यान्वयन प्रगतिशील'
      );

      if (!isBlank && spec.status !== 'Draft') {
        insCert.run(subId, 'preparer', 'नारायण प्रसाद शर्मा / प्रशासकीय अधिकृत', 'इलेक्ट्रोनिक प्रमाणीकरण', '2083/08/04', 0, 1);
        insCert.run(subId, 'reviewer', 'हरिहर सुवेदी / सहायक प्रमुख जिल्ला अधिकारी', 'इलेक्ट्रोनिक प्रमाणीकरण', '2083/08/05', 0, 1);
        insCert.run(subId, 'head', off.head, 'डिजिटल प्रमाणित', '2083/08/05', 1, 1);
        insHist.run(subId, 'Draft', spec.status, 5, 'नारायण प्रसाद शर्मा', 'प्रतिवेदन पेश गरिएको।', '2083-08-05 15:30:00');
        insVer.run(subId, 1, 'नारायण प्रसाद शर्मा', '2083-08-05 15:30:00', JSON.stringify({ total_services: totalSvc, prepared_forms: prep, approved_forms: appr, in_use_forms: inUse }));
      } else {
        insCert.run(subId, 'preparer', '', '', '', 0, 0);
        insCert.run(subId, 'reviewer', '', '', '', 0, 0);
        insCert.run(subId, 'head', '', '', '', 0, 0);
      }

      // Seed 2-way feedback on DAO Kathmandu (subId for off.id === 1 in 2083/84 Q1)
      if (off.id === 1) {
        const fb1 = db
          .prepare(
            `INSERT INTO feedbacks (submission_id, author_id, scope_type, scope_ref, message, is_directive, requires_evidence, created_at)
             VALUES (?, 3, 'indicator', '8', ?, 1, 1, '2083-08-06 11:20:00')`
          )
          .run(subId, 'सूचक ८ (सेवाग्राही सहायता कक्ष तथा Digital Kiosk) मा आंशिक उल्लेख गरिएको छ। सहायता कक्षको फोटो तथा सेवाग्राही अभिलेख प्रमाण संलग्न गरी पुनः पेश गर्नुहोला।');

        db.prepare(
          `INSERT INTO feedback_replies (feedback_id, user_id, message, created_at)
           VALUES (?, 5, ?, '2083-08-07 09:45:00')`
        ).run(Number(fb1.lastInsertRowid), 'सहायता कक्षमा नयाॅ कम्प्युटर र प्रिन्टर जडान कार्य सम्पन्न भएको छ, प्रमाण अपलोड गरी पुनः पेश गर्दैछौं।');

        db.prepare(
          `INSERT INTO feedbacks (submission_id, author_id, scope_type, scope_ref, message, is_directive, requires_evidence, created_at)
           VALUES (?, 2, 'section', '3', ?, 1, 0, '2083-08-06 14:00:00')`
        ).run(subId, 'खण्ड ३ को जग्गा नामसारी सेवामा बाँकी निवेदन संख्याको कारण स्पष्ट रूपमा कैफियतमा खुलाउनुहोला।');
      }
    }

    // 12. Notifications
    const insNotif = db.prepare(
      `INSERT INTO notifications (user_id, office_id, title_np, title_en, message_np, message_en, type, link_submission_id, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
    );
    insNotif.run(5, 1, 'सुधारका लागि प्रतिवेदन फिर्ता', 'Report Returned for Correction', 'आ.व. २०८३/८४ पहिलो त्रैमासिक प्रतिवेदनमा केन्द्रबाट २ वटा टिप्पणी प्राप्त भएको छ। कृपया सुधार गरी पुनः पेश गर्नुहोस्।', '2 feedback comments received from NVC Center for FY 2083/84 Q1 report. Please revise and resubmit.', 'warning', null);
    insNotif.run(null, 39, 'त्रैमासिक प्रतिवेदन पेश गर्ने म्याद सूचना', 'Quarterly Reporting Deadline Reminder', 'आ.व. २०८३/८४ पहिलो त्रैमासिक प्रगति प्रतिवेदन पेश गर्ने अन्तिम मिति २०८३/०८/२५ रहेको छ।', 'Deadline for FY 2083/84 Q1 report is 2083/08/25 BS.', 'info', null);
    insNotif.run(2, null, 'नयाँ प्रतिवेदन समीक्षाको लागि प्राप्त', 'New Submissions Pending Review', 'ललितपुर महानगरपालिका र अन्य कार्यालयबाट आ.व. २०८३/८४ पहिलो त्रैमासिक प्रतिवेदन पेश भएको छ।', 'New quarterly reports submitted by Lalitpur Metropolitan City and other offices.', 'info', null);

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Database seed failed:', err);
    throw err;
  }
}
