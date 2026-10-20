import "server-only";
import { Resend } from "resend";

// Transactional email through Resend. RESEND_API_KEY is server only (sensitive in Vercel).
const FROM = "Timeo <updates@ordinity.com>";

let client: Resend | null = null;
const resend = () => {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
  return (client ??= new Resend(process.env.RESEND_API_KEY));
};

/** Absolute base URL for links in emails. Never derived from request headers, which a caller controls. */
export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }) {
  const { error } = await resend().emails.send({ from: FROM, ...msg });
  if (error) throw new Error(`Resend: ${error.name} ${error.message}`);
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function resetPasswordEmail({ name, url, minutes }: { name: string; url: string; minutes: number }) {
  const text = [
    `Hi ${name},`,
    "",
    "Someone asked to reset the password for your Timeo account. Open this link to choose a new one:",
    url,
    "",
    `It works once and expires in ${minutes} minutes. If you didn't ask for this, ignore this email and your password stays the same.`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f5f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1917;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border:1px solid #e8e6e0;border-radius:20px;padding:32px 28px;">
          <tr><td>
            <p style="margin:0 0 20px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#8a867e;">Timeo</p>
            <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;font-weight:600;letter-spacing:-0.01em;">Reset your password</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#55524c;">Hi ${escape(name)}, tap the button to choose a new password. The link works once and expires in ${minutes} minutes.</p>
            <a href="${escape(url)}" style="display:inline-block;background:#1a1917;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 22px;border-radius:14px;">Choose a new password</a>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.55;color:#8a867e;">If you didn't ask for this, ignore this email. Your password stays the same.</p>
            <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#a8a49c;word-break:break-all;">${escape(url)}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject: "Reset your Timeo password", html, text };
}
