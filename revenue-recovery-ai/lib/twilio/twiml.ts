/**
 * TwiML builders. Kept as plain strings so the voice webhook can respond
 * without instantiating the Twilio SDK (which needs credentials).
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function twimlResponse(inner: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

/** Speak, then collect the caller's next utterance via speech recognition. */
export function sayAndGather(input: {
  say: string;
  actionUrl: string;
  timeoutSeconds?: number;
}): string {
  return (
    `<Gather input="speech" action="${escapeXml(input.actionUrl)}" method="POST" ` +
    `speechTimeout="auto" timeout="${input.timeoutSeconds ?? 5}" language="en-US">` +
    `<Say voice="Polly.Joanna">${escapeXml(input.say)}</Say>` +
    `</Gather>` +
    `<Redirect method="POST">${escapeXml(input.actionUrl)}?no_input=1</Redirect>`
  );
}

export function sayAndHangup(text: string): string {
  return `<Say voice="Polly.Joanna">${escapeXml(text)}</Say><Hangup/>`;
}

export function dial(number: string, callerId?: string): string {
  const attr = callerId ? ` callerId="${escapeXml(callerId)}"` : "";
  return `<Dial${attr}>${escapeXml(number)}</Dial>`;
}
