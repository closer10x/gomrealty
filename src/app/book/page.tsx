import type { Metadata } from "next";
import BookingCalendar from "@/components/BookingCalendar";
import { SITE } from "@/lib/content";
import { SLOT_MINUTES } from "@/lib/booking";

export const metadata: Metadata = {
  title: "Book a call",
  description:
    "Pick a time that works and we'll call you. Thirty minutes on the phone is usually enough to tell you where you stand. Go M Realty, Houston TX.",
};

export default function BookPage() {
  return (
    <>
      <section className="page-intro">
        <div className="eyebrow">SCHEDULE</div>
        <h1 className="display page-title">Book a call</h1>
        <p className="page-lede">
          {SLOT_MINUTES} minutes on the phone is usually enough to tell you where you stand. No
          script, no pressure, and no obligation to list or buy anything afterwards.
        </p>
        <p className="page-lede booking-hours-note">
          {SITE.hours}. Prefer to just ring us? {SITE.phone} goes straight to a person.
        </p>
      </section>

      <section className="section booking-section">
        <BookingCalendar />
      </section>
    </>
  );
}
