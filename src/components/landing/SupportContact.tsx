import { Container } from "@/components/ui/Container";
import { event } from "@/config/event";

export function SupportContact() {
  return (
    <section id="contact" className="landing-section landing-support" aria-labelledby="support-title">
      <Container>
        <div className="support-panel">
          <div>
            <p className="text-eyebrow">Need help?</p>
            <h2 id="support-title">Still have a question?</h2>
          </div>
          <p>
            Contact the {event.contacts.organizer.value} for registration or payment support at{" "}
            <a className="underline" href={`mailto:${event.contacts.support.value}`}>{event.contacts.support.value}</a>.
          </p>
        </div>
      </Container>
    </section>
  );
}
