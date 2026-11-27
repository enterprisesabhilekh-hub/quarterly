import nodemailer from 'nodemailer';

export class EmailConfigurationError extends Error {
  constructor() {
    super('Email delivery is not configured. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.');
    this.name = 'EmailConfigurationError';
  }
}

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !process.env.SMTP_FROM) {
    throw new EmailConfigurationError();
  }

  const port = Number(SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EmailConfigurationError();
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );
}

export async function sendTemporaryPasswordEmail(to: string, username: string, password: string): Promise<void> {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Your NVC monitoring account is approved',
    text: [
      'Your account has been approved.',
      `Username: ${username}`,
      `Temporary password: ${password}`,
      'Sign in and change this password immediately.',
    ].join('\n'),
  });
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'NVC password reset code',
    text: `Your password reset code is ${code}. It expires in 15 minutes.`,
  });
}
