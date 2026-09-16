import { event, isConfirmedText } from "@/config/event";
import { illuminateContent } from "@/content/illuminate";

const pendingLabel = "To be announced";
const factValue = (fact: { value: string | null; confirmation: "confirmed" | "pending" | "unavailable" }) =>
  isConfirmedText(fact) ? fact.value : pendingLabel;
const formatAmount = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

export function EventDetails() {
  const facilitator = illuminateContent.speaker.name ?? pendingLabel;

  return (
    <section id="event-details" className="landing-section event-details" aria-labelledby="event-details-title">
      <div className="container">
        <div className="event-details__sheet">
          <header className="event-details__header">
            <p className="text-eyebrow">Event details</p>
            <h2 id="event-details-title">{event.identity.name} {event.identity.edition}</h2>
            <p>Confirmed information and the details still being finalised.</p>
          </header>

          <dl className="event-details__facts">
            <div><dt>Format</dt><dd>{factValue(event.format)}</dd></div>
            <div><dt>Host</dt><dd>{event.organizer.name}</dd></div>
            <div><dt>Eligibility</dt><dd>{factValue(event.registration.eligibility)}</dd></div>
            <div><dt>Early Bird</dt><dd>{formatAmount(event.fee.pricing.earlyBirdAmount)}</dd></div>
            <div><dt>Regular</dt><dd>{formatAmount(event.fee.pricing.regularAmount)}</dd></div>
            {isConfirmedText(event.registration.deadline) ? <div className="event-details__deadline"><dt>Registration deadline</dt><dd>{factValue(event.registration.deadline)}</dd></div> : null}
            <div><dt>Event date</dt><dd>{factValue(event.schedule.date)}</dd></div>
            <div><dt>Time</dt><dd>{factValue(event.schedule.time)}</dd></div>
            <div><dt>Venue</dt><dd>{factValue(event.schedule.venue)}</dd></div>
            <div><dt>Facilitator</dt><dd>{facilitator}</dd></div>
          </dl>
        </div>
      </div>
    </section>
  );
}
