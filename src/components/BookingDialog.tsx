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
 * Built on the native <dialog> so focus trapping, Esc-to-close, inert
 * background and the backdrop come from the platform instead of being
 * reimplemented. /book still exists as a real page for direct links and for
 * anyone arriving without JS.
 */
export default function BookingDialog({ children, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    ref.current?.close();
  }, []);

  function openDialog() {
    setOpen(true);
    ref.current?.showModal();
  }

  // `close` fires for Esc as well as our own calls, so state stays in step
  // however the dialog was dismissed. Unmounting the calendar on close means
  // reopening starts from a clean step 1 rather than a stale confirmation.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClose = () => setOpen(false);
    el.addEventListener("close", onClose);
    return () => el.removeEventListener("close", onClose);
  }, []);

  // A modal <dialog> makes the page inert but does not stop it scrolling
  // underneath.
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
          if (e.target === ref.current) close();
        }}
      >
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
                onClick={close}
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
