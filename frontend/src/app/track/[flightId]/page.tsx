import { DEMO_FLIGHTS } from "@/features/flight-tracking";
import TrackFlightPageClient from "./TrackFlightPageClient";

export function generateStaticParams() {
  return DEMO_FLIGHTS.map((f) => ({ flightId: f.id }));
}

export default function TrackFlightPage({
  params,
}: {
  params: { flightId: string };
}) {
  return <TrackFlightPageClient flightId={params.flightId} />;
}
