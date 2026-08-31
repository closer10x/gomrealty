"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { INTENTS, type Intent } from "@/lib/content";

type Props = {
  kind: "contact" | "valuation";
  /** Valuation asks for the property address; contact asks for intent. */
  variant?: "default" | "valuation";
};

type Errors = Partial<Record<"fullName" | "email", string>>;

export default function LeadForm({ kind, variant = "default" }: Props) {
  const pathname = usePathname();
  const isValuation = variant === "valuation";

  const [intent, setIntent] = useState<Intent>("Buying");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state !== "idle") return;

    const fd = new FormData(e.currentTarget);
    setState("sending");
    setErrors({});
    setFormError("");

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          intent: isValuation ? "Selling" : intent,
          fullName: fd.get("fullName"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          propertyAddress: fd.get("propertyAddress"),
          message: fd.get("message"),
          company: fd.get("company"), // honeypot
          sourcePath: pathname,
        }),
      });

      if (res.ok) {
        setState("sent");
        return;
      }

      const data = await res.json().catch(() => ({}));
      setState("idle");
      if (res.status === 422 && data.errors) setErrors(data.errors as Errors);
      else setFormError(data.error ?? "Something went wrong. Please call us instead.");
    } catch {
      setState("idle");
      setFormError("Network problem — please try again or give us a call.");
    }
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
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
        placeholder="Phone"
        aria-label="Phone"
        autoComplete="tel"
      />

      {isValuation && (
        <input
          name="propertyAddress"
          className="field"
          placeholder="Property address"
          aria-label="Property address"
          autoComplete="street-address"
        />
      )}

      {!isValuation && (
        <div className="intent-row" role="group" aria-label="What are you working on?">
          {INTENTS.map((label) => (
            <button
              key={label}
              type="button"
              className="intent"
              aria-pressed={intent === label}
              onClick={() => setIntent(label)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <textarea
        name="message"
        className="field"
        rows={isValuation ? 3 : 4}
        placeholder={
          isValuation
            ? "Anything we should know? Timeline, updates, tenants."
            : "What are you working on?"
        }
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

      <button
        type="submit"
        className={isValuation ? "form-submit valuation" : "form-submit"}
        disabled={state !== "idle"}
      >
        {state === "sent" ? "Sent — we'll be in touch" : state === "sending" ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
