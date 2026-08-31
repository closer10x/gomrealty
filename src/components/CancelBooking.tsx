"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Cancellation is a deliberate two-step: the link only opens this page, and
 * nothing changes until the person confirms. Mail clients and security
 * scanners routinely pre-fetch links, and a GET that cancelled on load would
 * let a scanner silently drop someone's appointment.
 */
export default function CancelBooking({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function cancel() {
    setState("working");
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok) {
        setState("done");
        setMessage(data.summary ?? "");
      } else {
        setState("error");
        setMessage(data.error ?? "Could not cancel that call.");
      }
    } catch {
      setState("error");
      setMessage("Network problem — please try again, or call us on 832.514.7301.");
    }
  }

  if (state === "done") {
    return (
      <>
        <h1 className="display page-title" style={{ fontSize: 40 }}>
          That call is cancelled
        </h1>
        <p className="page-lede">
          {message ? `We've released ${message}. ` : ""}
          Nothing else to do — you can book another time whenever you&rsquo;re ready.
        </p>
        <Link href="/book" className="btn-cta" style={{ marginTop: 28 }}>
          Book another time
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="display page-title" style={{ fontSize: 40 }}>
        Cancel your call?
      </h1>
      <p className="page-lede">
        This releases your slot so someone else can take it. If you&rsquo;d rather move it than drop
        it, call us on <a href="tel:8325147301">832.514.7301</a> and we&rsquo;ll find another time.
      </p>

      {state === "error" && <p className="form-error" style={{ marginTop: 18 }}>{message}</p>}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
        <button
          type="button"
          className="btn-cta"
          onClick={() => void cancel()}
          disabled={state === "working"}
        >
          {state === "working" ? "Cancelling…" : "Yes, cancel it"}
        </button>
        <Link href="/" className="btn-ghost" style={{ flex: "none", padding: "17px 30px" }}>
          Keep my call
        </Link>
      </div>
    </>
  );
}
