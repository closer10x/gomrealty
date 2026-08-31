"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import BookingCalendar from "./BookingCalendar";

type Props = {
  /** Trigger label. */
  children: React.ReactNode;
  className?: string;
};

/**
 * "Schedule a call" opens the calendar in place rather than navigating away.
 *
 * Built on the native <dialog> for the backdrop and inert background, but the
 * open/closed state lives in React and every dismissal path funnels through
 * `closeDialog`. The obvious alternative — letting the dialog's own `close`
 * event drive state — is not dependable: some engines do not fire it, and a
 * missed event would strand the body scroll lock with no way to release it.
 * Driving state ourselves means the DOM and React cannot disagree.
 *
 * /book still exists as a real page, for direct links and for anyone arriving
 * without JS.
 */
export default function BookingDialog({ children, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const closeDialog = useCallback(() => {
    setOpen(false);
    if (ref.current?.open) ref.current.close();
  }, []);

  const openDialog = useCallback(() => {
    setOpen(true);
    if (!ref.current?.open) ref.current?.showModal();
  }, []);

  // Esc, handled here rather than left to the platform, so it takes the same
  // path as the close button and the backdrop.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDialog();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeDialog]);

  // If a browser *does* dismiss the dialog natively, catch up rather than
  // leaving React thinking it is still open.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClose = () => setOpen(false);
    const onCancel = (e: Event) => {
      e.preventDefault();
      closeDialog();
    };
    el.addEventListener("close", onClose);
    el.addEventListener("cancel", onCancel);
    return () => {
      el.removeEventListener("close", onClose);
      el.removeEventListener("cancel", onCancel);
    };
  }, [closeDialog]);

  // A modal <dialog> makes the page inert but does not stop it scrolling
  // underneath. Tied to `open`, so the lock is released on every close path.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button type="button" className={className} onClick={openDialog}>
        {children}
      </button>

      <dialog
        ref={ref}
        className="booking-modal"
        aria-label="Book a call"
        // Clicking the backdrop lands on the dialog element itself; clicks on
        // the content bubble from a child, so this closes only on the backdrop.
        onClick={(e) => {
          if (e.target === ref.current) closeDialog();
        }}
      >
        {/* Unmounted while closed, so reopening starts at step 1 rather than on
            a stale confirmation from the last booking. */}
        {open && (
          <div className="booking-modal-inner">
            <div className="booking-modal-head">
              <div>
                <div className="eyebrow">SCHEDULE</div>
                <h2 className="display booking-modal-title">Book a call</h2>
              </div>
              <button
                type="button"
                className="booking-close"
                onClick={closeDialog}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="booking-modal-sub">
              30 minutes on the phone is usually enough to tell you where you stand. No script,
              no pressure.
            </p>
            <BookingCalendar />
          </div>
        )}
      </dialog>
    </>
  );
}
