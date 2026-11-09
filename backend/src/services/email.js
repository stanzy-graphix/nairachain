const nodemailer = require('nodemailer');

// Without SMTP settings (local dev), emails are not sent; their links are logged instead.
const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : nodemailer.createTransport({ jsonTransport: true });

const frontend = () => process.env.FRONTEND_URL || 'http://localhost:3000';

const sendEmail = async ({ to, subject, html }) => {
  if (!to) return;
  const info = await transporter.sendMail({ from: process.env.EMAIL_FROM || 'NairaChain <noreply@nairachain.com>', to, subject, html });
  if (!smtpConfigured) {
    const links = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    console.log(`📧 [dev email] to=${to} subject="${subject}"${links.length ? ' links=' + links.join(' ') : ''}`);
  }
  return info;
};

// Fire-and-forget wrapper so email problems never break a request
const sendEmailSafe = (opts) => sendEmail(opts).catch(err => console.error('Email send failed:', err.message));

const escape = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const layout = (title, body, cta) => `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0A0E1A;color:#E8EDF5;padding:40px;border-radius:12px">
    <h2 style="color:#00D4AA;font-size:22px">${title}</h2>
    ${body}
    ${cta ? `<a href="${cta.href}" style="display:inline-block;background:#00D4AA;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:20px 0">${cta.label} →</a>` : ''}
    <p style="color:#64748b;font-size:12px;margin-top:24px">NairaChain · P2P crypto, escrow protected</p>
  </div>`;

const emailTemplates = {
  verifyEmail: (name, token) => ({
    subject: 'Verify your NairaChain email',
    html: layout(`Welcome to NairaChain, ${escape(name)}!`,
      '<p style="color:#94a3b8;line-height:1.7">Click the button below to verify your email address and start trading. The link expires in 24 hours.</p>',
      { href: `${frontend()}/auth/verify?token=${token}`, label: 'Verify Email' }),
  }),
  passwordReset: (name, token) => ({
    subject: 'Reset your NairaChain password',
    html: layout('Reset Your Password',
      `<p style="color:#94a3b8">Hi ${escape(name)}, click below to reset your password. The link expires in 1 hour.</p>`,
      { href: `${frontend()}/auth/reset-password?token=${token}`, label: 'Reset Password' }),
  }),
  tradeStarted: (name, role, tradeRef, amount, crypto, minutes) => ({
    subject: `Trade ${tradeRef} started — you are the ${role}`,
    html: layout('Trade Started',
      `<p>Hi ${escape(name)}, trade <strong>${tradeRef}</strong> for <strong>${amount} ${crypto}</strong> has started. You are the <strong>${role}</strong>.</p>
       <p style="color:#F5A623">⚡ The buyer has ${minutes} minutes to send payment.</p>`,
      { href: `${frontend()}/trades/${tradeRef}`, label: 'View Trade' }),
  }),
  tradeCompleted: (name, tradeRef, amount, crypto) => ({
    subject: `Trade ${tradeRef} completed`,
    html: layout('Trade Completed ✅',
      `<p>Hi ${escape(name)}, trade <strong>${tradeRef}</strong> is complete. ${amount} ${crypto} has been released from escrow.</p>`,
      { href: `${frontend()}/trades/${tradeRef}`, label: 'Rate Your Trader' }),
  }),
  disputeOpened: (tradeRef, reason) => ({
    subject: `⚠️ Dispute opened on ${tradeRef}`,
    html: layout('Dispute Opened',
      `<p>A dispute was opened on trade <strong>${tradeRef}</strong>.</p><p style="color:#FF4D6D">${escape(reason)}</p>`,
      { href: `${frontend()}/admin`, label: 'Review in Admin' }),
  }),
};

module.exports = { sendEmail, sendEmailSafe, emailTemplates, smtpConfigured };
