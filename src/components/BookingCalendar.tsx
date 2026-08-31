"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { INTENTS, type Intent } from "@/lib/content";
import {
  OFFICE_TZ,
  addDays,
  dayKey,
  formatDayLong,
  formatTime,
  formatZoneAbbr,
  parseDayKey,
} from "@/lib/booking";

type Slot = { start: string; end: string; available: boolean };
type Errors = Partial<Record<"fullName" | "email" | "start", string>>;

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

const monthOf = (key: string) => key.slice(0, 7);
const monthLabel = (month: string) =>
  MONTH_LABEL.format(new Date(`${month}-01T00:00:00Z`));

export default function BookingCalendar() {
  const pathname = usePathname();

  // Rendered on the client only, so "today" is the visitor's today.
  const [today, setToday] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [days, setDays] = useState<Record<string, number>>({});
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [degraded, setDegraded] = useState(false);

  const [topic, setTopic] = useState<Intent>("Buying");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [confirmed, setConfirmed] = useState<{ summary: string; start: string } | null>(null);

  const slotReq = useRef(0);
  const monthReq = useRef(0);

  useEffect(() => {
    const key = dayKey(new Date());
    setToday(key);
    setMonth(monthOf(key));
  }, []);

  /* ---------------- availability ---------------- */

  useEffect(() => {
    if (!month) return;
    const seq = ++monthReq.current;
    setLoadingMonth(true);

    fetch(`/api/bookings/availability?month=${month}`)
      .then((r) => r.json())
      .then((data) => {
        if (seq !== monthReq.current) return;
        setDays(data.days ?? {});
        setDegraded(Boolean(data.degraded));
      })
      .catch(() => {
        if (seq === monthReq.current) setDegraded(true);
      })
      .finally(() => {
        if (seq === monthReq.current) setLoadingMonth(false);
      });
  }, [month]);

  const loadSlots = useCallback((day: string) => {
    const seq = ++slotReq.current;
    setLoadingSlots(true);
    setSlots([]);

    fetch(`/api/bookings/availability?date=${day}`)
      .then((r) => r.json())
      .then((data) => {
        if (seq !== slotReq.current) return;
        setSlots(data.slots ?? []);
        setDegraded(Boolean(data.degraded));
      })
      .catch(() => {
        if (seq === slotReq.current) setSlots([]);
      })
      .finally(() => {
        if (seq === slotReq.current) setLoadingSlots(false);
      });
  }, []);

  function pickDay(day: string) {
    setSelectedDay(day);
    setSelectedSlot(null);
    setFormError("");
    loadSlots(day);
  }

  /* ---------------- month grid ---------------- */

  const grid = useMemo(() => {
    if (!month) return [];
    const first = `${month}-01`;
    const p = parseDayKey(first);
    if (!p) return [];

    const lead = new Date(Date.UTC(p.year, p.month - 1, 1)).getUTCDay();
    const count = new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();

    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let i = 0; i < count; i++) cells.push(addDays(first, i));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  // Only step back to a month that still has bookable days in it.
  const canGoBack = Boolean(today && month && month > monthOf(today));

  /* ---------------- submit ---------------- */

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state !== "idle") return;
    if (!selectedSlot) {
      setErrors({ start: "Pick a time first" });
      return;
    }

    const fd = new FormData(e.currentTarget);
    setState("sending");
    setErrors({});
    setFormError("");

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          start: selectedSlot,
          topic,
          fullName: fd.get("fullName"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          message: fd.get("message"),
          company: fd.get("company"), // honeypot
          visitorTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          sourcePath: pathname,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setConfirmed({ summary: data.summary ?? "", start: data.start ?? selectedSlot });
        setState("done");
        return;
      }

      setState("idle");
      if (res.status === 422 && data.errors) {
        setErrors(data.errors as Errors);
      } else if (res.status === 409) {
        // Someone else won the race — refresh the day so the grid tells the truth.
        setFormError(data.error ?? "That time just went. Pick another.");
        setSelectedSlot(null);
        if (selectedDay) loadSlots(selectedDay);
      } else {
        setFormError(data.error ?? "Something went wrong. Please call us instead.");
      }
    } catch {
      setState("idle");
      setFormError("Network problem — please try again or give us a call.");
    }
  }

  /* ---------------- render ---------------- */

  if (state === "done" && confirmed) {
    const visitorTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return (
      <div className="booking-done" role="status">
        <div className="booking-check" aria-hidden />
        <h2 className="display h3">You&rsquo;re on the calendar</h2>
        <p className="booking-done-when">{confirmed.summary}</p>
        <p className="booking-done-sub">
          {formatZoneAbbr(confirmed.start)} — Houston time.
          {visitorTz && visitorTz !== OFFICE_TZ && (
            <> That&rsquo;s {formatTime(confirmed.start, visitorTz)} where you are.</>
          )}
        </p>
        <p className="booking-done-sub">
          We&rsquo;ll call the number you gave us. If something changes, reply to the email or
          call <a href="tel:8325147301">832.514.7301</a>.
        </p>
      </div>
    );
  }

  const openCount = selectedDay ? slots.filter((s) => s.available).length : 0;

  return (
    <div className="booking">
      <div className="booking-cal">
        <div className="booking-cal-head">
          <button
            type="button"
            className="booking-nav"
            onClick={() => month && setMonth(addDays(`${month}-01`, -1).slice(0, 7))}
            disabled={!canGoBack}
            aria-label="Previous month"
          >
            ‹
          </button>
          <div className="booking-month" aria-live="polite">
            {month ? monthLabel(month) : " "}
          </div>
          <button
            type="button"
            className="booking-nav"
            onClick={() => month && setMonth(addDays(`${month}-01`, 32).slice(0, 7))}
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        <div className="booking-weekdays" aria-hidden>
          {WEEKDAYS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        <div className="booking-grid" role="grid" aria-label="Choose a date">
          {grid.map((day, i) => {
            if (!day) return <span key={`pad-${i}`} className="booking-cell empty" />;
            const open = (days[day] ?? 0) > 0;
            return (
              <button
                key={day}
                type="button"
                className="booking-cell"
                disabled={!open || loadingMonth}
                aria-current={day === selectedDay ? "date" : undefined}
                aria-label={`${formatDayLong(day)}${open ? `, ${days[day]} times open` : ", unavailable"}`}
                onClick={() => pickDay(day)}
              >
                {Number(day.slice(-2))}
                {open && <span className="booking-dot" aria-hidden />}
              </button>
            );
          })}
        </div>

        {degraded && (
          <p className="booking-degraded">
            Live availability is down right now. Please call{" "}
            <a href="tel:8325147301">832.514.7301</a>.
          </p>
        )}
      </div>

      <div className="booking-panel">
        {!selectedDay && (
          <div className="booking-empty">
            <div className="eyebrow">STEP 1</div>
            <p>Pick a day with a dot under it. Thirty minutes, on the phone, no script.</p>
          </div>
        )}

        {selectedDay && (
          <>
            <div className="booking-when">
              <div className="eyebrow">STEP 2</div>
              <h3 className="booking-day">{formatDayLong(selectedDay)}</h3>
              <p className="booking-tz">
                Times in Houston{slots[0] ? ` (${formatZoneAbbr(slots[0].start)})` : ""}
              </p>
            </div>

            {loadingSlots ? (
              <p className="booking-note">Loading times…</p>
            ) : openCount === 0 ? (
              <p className="booking-note">Nothing left that day. Try another.</p>
            ) : (
              <div className="booking-slots" role="group" aria-label="Choose a time">
                {slots.map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    className="booking-slot"
                    disabled={!s.available}
                    aria-pressed={selectedSlot === s.start}
                    onClick={() => {
                      setSelectedSlot(s.start);
                      setErrors((e) => ({ ...e, start: undefined }));
                    }}
                  >
                    {formatTime(s.start)}
                  </button>
                ))}
              </div>
            )}
            {errors.start && <p className="field-err">{errors.start}</p>}

            {selectedSlot && (
              <form className="form booking-form" onSubmit={onSubmit} noValidate>
                <div className="eyebrow">STEP 3</div>

                <input
                  name="fullName"
                  className="field"
                  placeholder="Full name"
                  aria-label="Full name"
                  aria-invalid={Boolean(errors.fullName)}
                  autoComplete="name"
                  required
                />
                {errors.fullName && <p className="field-err">{errors.fullName}</p>}

                <input
                  name="email"
                  type="email"
                  className="field"
                  placeholder="Email"
                  aria-label="Email"
                  aria-invalid={Boolean(errors.email)}
                  autoComplete="email"
                  required
                />
                {errors.email && <p className="field-err">{errors.email}</p>}

                <input
                  name="phone"
                  type="tel"
                  className="field"
                  placeholder="Phone — the number we should call"
                  aria-label="Phone"
                  autoComplete="tel"
                />

                <div className="intent-row" role="group" aria-label="What are you working on?">
                  {INTENTS.map((label) => (
                    <button
                      key={label}
                      type="button"
                      className="intent"
                      aria-pressed={topic === label}
                      onClick={() => setTopic(label)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <textarea
                  name="message"
                  className="field"
                  rows={3}
                  placeholder="Anything we should look at before the call?"
                  aria-label="Message"
                />

                {/* Honeypot — hidden from people, tempting to bots. */}
                <input
                  name="company"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden
                  style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
                />

                {formError && <p className="form-error">{formError}</p>}

                <button type="submit" className="form-submit" disabled={state !== "idle"}>
                  {state === "sending"
                    ? "Booking…"
                    : `Book ${formatTime(selectedSlot)} on ${formatDayLong(selectedDay).replace(/,.*$/, "")}`}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
