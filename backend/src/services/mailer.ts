import nodemailer from "nodemailer";

const enabled = (process.env.EMAIL_ENABLED ?? "true") === "true";

let mailer: nodemailer.Transporter | null = null;
let verified = false;

function getMailer() {
  if (!enabled) return null;

  if (!mailer) {
    mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: (process.env.SMTP_SECURE ?? "false") === "true", // true for 465
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });
  }

  return mailer;
}

async function verifyOnce() {
  if (!enabled) return;
  if (verified) return;

  const t = getMailer();
  if (!t) return;

  try {
    await t.verify();
    verified = true;
    console.log("✅ SMTP transport verified");
  } catch (e) {
    // IMPORTANT: don't crash the app in Docker if SMTP isn't reachable
    console.error("❌ SMTP verify failed:", e);
  }
}

export async function sendMail(params: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}) {
  if (!enabled) return;

  const t = getMailer();
  if (!t) return;

  await verifyOnce();

  const from = process.env.MAIL_FROM || "no-reply@jex.local";
  const replyTo = process.env.REPLY_TO_EMAIL || from;

  console.log("📧 Sending email:", params.subject);

  await t.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    replyTo,
  });
}

