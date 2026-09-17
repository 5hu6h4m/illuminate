import { Container } from "@/components/ui/Container";
import { illuminateContent } from "@/content/illuminate";

export function RegistrationProcess() {
  const process = illuminateContent.registrationProcess;

  return (
    <section id="registration-process" className="landing-section registration-process" aria-labelledby="registration-process-title">
      <Container>
        <div className="registration-process__intro">
          <p className="text-eyebrow">Registration and payment</p>
          <h2 id="registration-process-title">{process.title}</h2>
          <p>{process.description}</p>
        </div>

        <ol className="registration-process__steps">
          {process.steps.map((step, index) => (
            <li key={step.key} className={`registration-process__step registration-process__step--${step.owner.toLowerCase().replace(/[^a-z]/g, "-")}`}>
              <span className="registration-process__number">0{index + 1}</span>
              <div>
                <p className="registration-process__owner">{step.owner}</p>
                <h3>{step.label}</h3>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="registration-process__notes">
          <p><strong>Payment details submitted is not the same as registration confirmed.</strong> {process.pendingMessage}</p>
          <p>{process.confirmationMessage}</p>
          <p>{process.resubmissionMessage}</p>
        </div>
      </Container>
    </section>
  );
}
