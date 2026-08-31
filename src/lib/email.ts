/**
 * Transactional email via Resend.
 *
 * Talks to the REST API with plain fetch, the same way lib/realty.ts talks to
 * RealtyAPI — no SDK, no extra dependency to keep patched.
 *
 * Nothing in here may throw into a request handler. A booking that is safely in
 * the database is a real booking; failing the response because a mail server
 * hiccuped would tell the visitor their call did not happen when it did.
 * Callers get a result object, and failures are logged for follow-up.
 */
import "server-only";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendResult = { sent: boolean; skipped?: string; error?: string; id?: string };

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.BOOKING_FROM_EMAIL);
}

type Attachment = { filename: string; content: string; contentType?: string };

async function send(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: Attachment[];
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.BOOKING_FROM_EMAIL;

  if (!key || !from) {
    return { sent: false, skipped: "RESEND_API_KEY or BOOKING_FROM_EMAIL not set" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
        ...(msg.attachments ? { attachments: msg.attachments } : {}),
      }),
      // Never let a hanging mail API hold the booking response open.
      signal: AbortSignal.timeout(8000),
    });

    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { sent: false, error: body.message ?? `Resend responded ${res.status}` };
    return { sent: true, id: body.id };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "Unknown mail error" };
  }
}

/* ------------------------------------------------------------------ */
/* Calendar invite                                                     */
/* ------------------------------------------------------------------ */

const icsStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Folds a line to the 75-octet limit RFC 5545 asks for. */
const fold = (line: string): string =>
  line.length <= 75 ? line : line.replace(/(.{75})/g, "$1\r\n ").trimEnd();

const escapeIcs = (v: string) => v.replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");

/**
 * A VEVENT the visitor can add to their own calendar. Times are UTC instants,
 * so the invite lands correctly whatever zone they are in.
 */
export function buildIcs(opts: {
  id: string;
  start: string;
  end: string;
  organizerEmail: string;
  attendeeEmail: string;
  attendeeName: string;
  phone: string;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Go M Realty//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${opts.id}@gomrealty`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(opts.start)}`,
    `DTEND:${icsStamp(opts.end)}`,
    fold(`SUMMARY:${escapeIcs("Call with Go M Realty")}`),
    fold(
      `DESCRIPTION:${escapeIcs(
        `A 30-minute call with Go M Realty. We'll ring you on ${opts.phone || "the number you gave us"}.`,
      )}`,
    ),
    fold(`ORGANIZER;CN=Go M Realty:mailto:${opts.organizerEmail}`),
    fold(`ATTENDEE;CN=${escapeIcs(opts.attendeeName)};RSVP=FALSE:mailto:${opts.attendeeEmail}`),
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

/* ------------------------------------------------------------------ */
/* Booking mail                                                        */
/* ------------------------------------------------------------------ */

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const shell = (heading: string, rows: [string, string][], footer: string) => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
            max-width:520px;margin:0 auto;padding:32px 24px;color:#1c1f1d;">
  <div style="font-size:13px;font-weight:600;letter-spacing:.18em;color:#2f7a4d;">GO M REALTY</div>
  <h1 style="font-size:26px;line-height:1.2;letter-spacing:-.02em;margin:14px 0 22px;">${esc(heading)}</h1>
  <table style="width:100%;border-collapse:collapse;font-size:15px;">
    ${rows
      .map(
        ([k, v]) => `<tr>
      <td style="padding:9px 0;color:#6b736e;width:34%;vertical-align:top;">${esc(k)}</td>
      <td style="padding:9px 0;font-weight:500;">${esc(v)}</td></tr>`,
      )
      .join("")}
  </table>
  <p style="font-size:14px;line-height:1.6;color:#4a534d;margin:24px 0 0;">${footer}</p>
</div>`;

type BookingMail = {
  id: string;
  /** Absolute URL of the cancellation page, when NEXT_PUBLIC_SITE_URL is set. */
  cancelUrl?: string | null;
  start: string;
  end: string;
  summary: string;
  zone: string;
  fullName: string;
  email: string;
  phone: string | null;
  topic: string | null;
  message: string | null;
};

/** Confirmation to the person who booked, with an .ics they can add. */
export async function sendBookingConfirmation(b: BookingMail): Promise<SendResult> {
  const from = process.env.BOOKING_FROM_EMAIL ?? "";
  const rows: [string, string][] = [
    ["When", `${b.summary} (${b.zone})`],
    ["Length", "30 minutes"],
    ["We'll call", b.phone || "the number you gave us"],
  ];
  if (b.topic) rows.push(["About", b.topic]);

  const ics = buildIcs({
    id: b.id,
    start: b.start,
    end: b.end,
    organizerEmail: from.replace(/^.*<|>$/g, ""),
    attendeeEmail: b.email,
    attendeeName: b.fullName,
    phone: b.phone ?? "",
  });

  return send({
    to: b.email,
    subject: `Your call with Go M Realty — ${b.summary}`,
    replyTo: process.env.BOOKING_NOTIFY_EMAIL,
    html: shell(
      `You're on the calendar, ${b.fullName.split(" ")[0]}`,
      rows,
      `${
        b.cancelUrl
          ? `Need to cancel? <a href="${b.cancelUrl}" style="color:#2f7a4d;">Cancel this call</a>. `
          : ""
      }To move it instead, reply to this email or call
       <a href="tel:8325147301" style="color:#2f7a4d;">832.514.7301</a>.
       The attached invite adds it to your calendar.`,
    ),
    text: [
      `You're on the calendar, ${b.fullName.split(" ")[0]}.`,
      ``,
      `When: ${b.summary} (${b.zone})`,
      `Length: 30 minutes`,
      `We'll call: ${b.phone || "the number you gave us"}`,
      b.topic ? `About: ${b.topic}` : "",
      ``,
      b.cancelUrl ? `Cancel this call: ${b.cancelUrl}` : "",
      `To move it instead, reply to this email or call 832.514.7301.`,
    ]
      .filter(Boolean)
      .join("\n"),
    attachments: [
      {
        filename: "go-m-realty-call.ics",
        content: Buffer.from(ics, "utf8").toString("base64"),
        contentType: "text/calendar; method=REQUEST",
      },
    ],
  });
}

/** Heads-up to the office, so a booking is not something you find out about later. */
export async function sendBookingNotification(b: BookingMail): Promise<SendResult> {
  const to = process.env.BOOKING_NOTIFY_EMAIL;
  if (!to) return { sent: false, skipped: "BOOKING_NOTIFY_EMAIL not set" };

  const rows: [string, string][] = [
    ["When", `${b.summary} (${b.zone})`],
    ["Name", b.fullName],
    ["Email", b.email],
    ["Phone", b.phone || "—"],
    ["About", b.topic || "—"],
  ];

  return send({
    to,
    replyTo: b.email,
    subject: `New call booked — ${b.fullName}, ${b.summary}`,
    html: shell(
      "New call booked",
      rows,
      b.message ? `<strong>They wrote:</strong><br>${esc(b.message)}` : "No message left.",
    ),
    text: [
      `New call booked.`,
      ``,
      ...rows.map(([k, v]) => `${k}: ${v}`),
      ``,
      b.message ? `They wrote: ${b.message}` : "No message left.",
    ].join("\n"),
  });
}
