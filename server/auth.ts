import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';
import { AuthUser, RoleCode, UserOfficeLink } from '../src/types/index.ts';

// Session signing secret: uses env var if set, otherwise a secure random secret in memory
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

interface TokenPayload {
  uid: number;
  role: RoleCode;
  exp: number;
}

export function signToken(userId: number, role: RoleCode): string {
  const payload: TokenPayload = {
    uid: userId,
    role,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.uid || !parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getAuthUserById(userId: number): AuthUser | null {
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.full_name_np, u.full_name_en,
              u.designation_np, u.designation_en, u.phone, u.ministry_id, u.province_id, u.is_active,
              r.code AS role, r.name_np AS role_name_np, r.name_en AS role_name_en,
              m.name_np AS ministry_name_np
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       LEFT JOIN ministries m ON m.id = u.ministry_id
       WHERE u.id = ?
       LIMIT 1`
    )
    .get(userId) as Record<string, unknown> | undefined;

  if (!row) return null;

  const offices = db
    .prepare(
      `SELECT ou.office_id, go.name_np AS office_name_np, go.name_en AS office_name_en,
              go.office_code, ou.is_head, ou.can_submit, ou.is_primary
       FROM office_users ou
       JOIN government_offices go ON go.id = ou.office_id
       WHERE ou.user_id = ?
       ORDER BY ou.is_primary DESC, go.name_np ASC`
    )
    .all(userId) as Array<Record<string, unknown>>;

  const mappedOffices: UserOfficeLink[] = offices.map((o) => ({
    office_id: Number(o.office_id),
    office_name_np: String(o.office_name_np),
    office_name_en: String(o.office_name_en),
    office_code: String(o.office_code),
    is_head: Boolean(o.is_head),
    can_submit: Boolean(o.can_submit),
    is_primary: Boolean(o.is_primary),
  }));

  return {
    id: Number(row.id),
    username: String(row.username),
    email: String(row.email),
    full_name_np: String(row.full_name_np),
    full_name_en: String(row.full_name_en),
    designation_np: String(row.designation_np || ''),
    designation_en: String(row.designation_en || ''),
    phone: String(row.phone || ''),
    role: row.role as RoleCode,
    role_name_np: String(row.role_name_np),
    role_name_en: String(row.role_name_en),
    ministry_id: row.ministry_id ? Number(row.ministry_id) : null,
    ministry_name_np: row.ministry_name_np ? String(row.ministry_name_np) : null,
    province_id: row.province_id ? Number(row.province_id) : null,
    is_active: Boolean(row.is_active),
    offices: mappedOffices,
  };
}

export interface AuthRequest extends Request {
  authUser?: AuthUser;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token' });
  }
  const user = getAuthUserById(payload.uid);
  if (!user || !user.is_active) {
    return res.status(403).json({ error: 'Account is inactive or not found' });
  }
  req.authUser = user;
  next();
}

export function requireRoles(...allowed: RoleCode[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!allowed.includes(req.authUser.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
    }
    next();
  };
}

export function canUserAccessOffice(user: AuthUser, officeId: number, officeMinistryId: number | null, officeProvinceId: number): boolean {
  if (user.role === 'super_admin' || user.role === 'nvc_admin' || user.role === 'review_officer') {
    return true;
  }
  if (user.role === 'viewer_auditor') {
    if (user.province_id && user.province_id !== officeProvinceId) return false;
    if (user.ministry_id && user.ministry_id !== officeMinistryId) return false;
    return true;
  }
  if (user.role === 'ministry_user') {
    return user.ministry_id !== null && user.ministry_id === officeMinistryId;
  }
  if (user.role === 'office_user') {
    return user.offices.some((o) => o.office_id === officeId);
  }
  return false;
}

export function writeAuditLog(
  userId: number | null,
  action: string,
  entityType: string,
  entityId: string | number | null,
  details: Record<string, unknown>,
  ipAddress = ''
) {
  try {
    db.prepare(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      action,
      entityType,
      entityId !== null ? String(entityId) : null,
      JSON.stringify(details),
      ipAddress
    );
  } catch (err) {
    console.error('Audit log insert failed:', err);
  }
}
