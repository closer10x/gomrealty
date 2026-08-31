import type { Metadata } from "next";
import CancelBooking from "@/components/CancelBooking";

export const metadata: Metadata = {
  title: "Cancel your call",
  robots: { index: false, follow: false },
};

export default async function CancelPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <section className="page-intro" style={{ maxWidth: 640, borderBottom: "none" }}>
      <div className="eyebrow">YOUR CALL</div>
      <CancelBooking token={token} />
    </section>
  );
}
