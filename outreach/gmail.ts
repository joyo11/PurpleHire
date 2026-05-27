import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER and GMAIL_APP_PASSWORD must be set in outreach/.env",
    );
  }
  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  return transporter;
}

export async function sendCold({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ messageId: string }> {
  const t = getTransporter();
  const from = process.env.GMAIL_USER!;
  const senderName = process.env.SENDER_NAME ?? "Shafay";
  const info = await t.sendMail({
    from: `"${senderName}" <${from}>`,
    to,
    subject,
    text: body,
    // No HTML — looks more like a real personal email.
  });
  return { messageId: info.messageId };
}

export async function verifyTransport(): Promise<void> {
  const t = getTransporter();
  await t.verify();
}
