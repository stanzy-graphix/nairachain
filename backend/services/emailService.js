const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const BASE_STYLE = `
  font-family: 'DM Mono', Courier New, monospace;
  background: #0A0E1A; color: #E8EDF5;
  max-width: 520px; margin: 0 auto; padding: 32px 28px;
  border-radius: 12px; border: 1px solid #1E2D47;
`
const ACCENT = '#00D4AA'

const emailService = {

  async sendVerificationEmail(email, name, token) {
    const url = `${process.env.FRONTEND_URL}/auth/verify?token=${token}`
    await transporter.sendMail({
      from:    process.env.FROM_EMAIL,
      to:      email,
      subject: 'Verify your NairaChain account',
      html: `
        <div style="${BASE_STYLE}">
          <h2 style="color:${ACCENT};font-family:sans-serif;">NAIRACHAIN</h2>
          <h3>Hello ${name},</h3>
          <p>Thanks for signing up! Click the button below to verify your email.</p>
          <a href="${url}" style="display:inline-block;background:${ACCENT};color:#000;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;margin:20px 0;">
            Verify Email →
          </a>
          <p style="color:#64748B;font-size:12px;">This link expires in 24 hours. If you didn't sign up, ignore this email.</p>
        </div>
      `,
    })
  },

  async sendPasswordResetEmail(email, name, token) {
    const url = `${process.env.FRONTEND_URL}/auth/new-password?token=${token}`
    await transporter.sendMail({
      from:    process.env.FROM_EMAIL,
      to:      email,
      subject: 'Reset your NairaChain password',
      html: `
        <div style="${BASE_STYLE}">
          <h2 style="color:${ACCENT};font-family:sans-serif;">NAIRACHAIN</h2>
          <h3>Password Reset</h3>
          <p>Hi ${name}, click below to reset your password.</p>
          <a href="${url}" style="display:inline-block;background:${ACCENT};color:#000;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;margin:20px 0;">
            Reset Password →
          </a>
          <p style="color:#64748B;font-size:12px;">Expires in 1 hour. If you didn't request this, ignore it.</p>
        </div>
      `,
    })
  },

  async sendTradeStarted(buyerEmail, sellerEmail, trade) {
    const msg = (role) => `
      <div style="${BASE_STYLE}">
        <h2 style="color:${ACCENT};font-family:sans-serif;">Trade Started</h2>
        <p>A new trade has been initiated.</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
          <tr><td style="padding:8px 0;color:#64748B;">Trade ID</td><td style="font-weight:600;">${trade.id}</td></tr>
          <tr><td style="padding:8px 0;color:#64748B;">Crypto</td><td style="font-weight:600;">${trade.crypto_amount} ${trade.crypto}</td></tr>
          <tr><td style="padding:8px 0;color:#64748B;">Naira</td><td style="font-weight:600;">₦${Number(trade.naira_amount).toLocaleString()}</td></tr>
          <tr><td style="padding:8px 0;color:#64748B;">Your Role</td><td style="font-weight:600;">${role}</td></tr>
        </table>
        <a href="${process.env.FRONTEND_URL}/market/trade/${trade.id}" style="display:inline-block;background:${ACCENT};color:#000;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;">
          View Trade →
        </a>
      </div>
    `
    await Promise.all([
      transporter.sendMail({ from: process.env.FROM_EMAIL, to: buyerEmail,  subject: 'NairaChain: Trade Started — You are the Buyer',  html: msg('Buyer') }),
      transporter.sendMail({ from: process.env.FROM_EMAIL, to: sellerEmail, subject: 'NairaChain: Trade Started — You are the Seller', html: msg('Seller') }),
    ])
  },

  async sendTradeComplete(email, trade) {
    await transporter.sendMail({
      from:    process.env.FROM_EMAIL,
      to:      email,
      subject: '✅ NairaChain: Trade Completed!',
      html: `
        <div style="${BASE_STYLE}">
          <h2 style="color:${ACCENT};">Trade Complete!</h2>
          <p>Trade <strong>${trade.id}</strong> has been completed successfully.</p>
          <p style="color:${ACCENT};font-weight:700;font-size:18px;">${trade.crypto_amount} ${trade.crypto} transferred.</p>
        </div>
      `,
    })
  },

  async sendDisputeOpened(adminEmail, trade, reason) {
    await transporter.sendMail({
      from:    process.env.FROM_EMAIL,
      to:      adminEmail,
      subject: `⚠️ Dispute Opened: Trade ${trade.id}`,
      html: `
        <div style="${BASE_STYLE}">
          <h2 style="color:#FF4D6D;">Dispute Opened</h2>
          <p>Trade <strong>${trade.id}</strong> has been disputed.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <a href="${process.env.FRONTEND_URL}/admin" style="display:inline-block;background:#FF4D6D;color:#fff;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;margin-top:16px;">
            View in Admin Panel →
          </a>
        </div>
      `,
    })
  },
}

module.exports = emailService
