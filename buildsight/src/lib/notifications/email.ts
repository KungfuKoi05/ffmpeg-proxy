/**
 * Email delivery adapter.
 *
 * Notifications are always written to the database so they appear in-app. Email
 * is a separate, best-effort channel: with no provider configured the message
 * is recorded as queued rather than silently dropped, so the UI can tell the
 * user what actually happened.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailResult {
  delivered: boolean;
  reason: "sent" | "not_configured" | "failed";
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    console.info(`[email] not configured; queued message to ${message.to}: ${message.subject}`);
    return { delivered: false, reason: "not_configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        text: message.body,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok
      ? { delivered: true, reason: "sent" }
      : { delivered: false, reason: "failed" };
  } catch (error) {
    console.error("[email] delivery failed", error);
    return { delivered: false, reason: "failed" };
  }
}
