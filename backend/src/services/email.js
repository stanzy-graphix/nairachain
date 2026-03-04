const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
};

const emailTemplates = {
  verifyEmail: (name, token) => ({
    subject: 'Verify your NairaChain email',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0A0E1A;color:#E8EDF5;padding:40px;border-radius:12px">
        <h2 style="color:#00D4AA;font-size:24px">Welcome to NairaChain, ${name}!</h2>
        <p style="color:#94a3b8;line-height:1.7">Click the button below to verify your email address and start trading.</p>
        <a href="${process.env.FRONTEND_URL}/auth/verify?token=${token}" 
           style="display:inline-block;background:#00D4AA;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:20px 0">
          Verify Email →
        </a>
        <p style="color:#64748b;font-size:12px">Link expires in 24 hours. If you didn't sign up, ignore this email.</p>
      </div>
    `
  }),
  passwordReset: (name, token) => ({
    subject: 'Reset your NairaChain password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0A0E1A;color:#E8EDF5;padding:40px;border-radius:12px">
        <h2 style="color:#00D4AA">Reset Your Password</h2>
        <p style="color:#94a3b8">Hi ${name}, click below to reset your password. Link expires in 1 hour.</p>
        <a href="${process.env.FRONTEND_URL}/auth/reset-password?token=${token}"
           style="display:inline-block;background:#00D4AA;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:20px 0">
          Reset Password →
        </a>
      </div>
    `
  }),
  tradeStarted: (name, tradeRef, amount, crypto) => ({
    subject: `Trade ${tradeRef} started - NairaChain`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0A0E1A;color:#E8EDF5;padding:40px;border-radius:12px">
        <h2 style="color:#00D4AA">Trade Started</h2>
        <p>Hi ${name}, your trade <strong>${tradeRef}</strong> for <strong>${amount} ${crypto}</strong> has started.</p>
        <p style="color:#F5A623">⚡ You have 30 minutes to complete the payment.</p>
        <a href="${process.env.FRONTEND_URL}/trades/${tradeRef}"
           style="display:inline-block;background:#00D4AA;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:20px 0">
          View Trade →
        </a>
      </div>
    `
  }),
};

module.exports = { sendEmail, emailTemplates };
