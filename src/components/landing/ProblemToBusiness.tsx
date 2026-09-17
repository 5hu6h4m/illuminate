import { Container } from "@/components/ui/Container";
import { canteenJourney } from "@/content/student-examples";

export function ProblemToBusiness() {
  return <section className="landing-section problem-business" aria-labelledby="problem-business-title"><Container><p className="text-eyebrow">An educational example</p><h2 id="problem-business-title">One problem. See how a business starts taking shape.</h2><p className="problem-business__intro">A canteen queue is more than an inconvenience. It can become a way to understand a problem, the people it affects, a possible solution and how that idea could work.</p><ol className="problem-business__steps">{canteenJourney.stages.map((stage, index) => <li key={stage.key}><span>0{index + 1}</span><h3>{stage.label}</h3><p>{stage.description}</p></li>)}</ol><p className="problem-business__note">{canteenJourney.notAWorkshopPromise} Illuminate introduces you to this way of thinking — from understanding a problem to shaping and communicating an idea.</p></Container></section>;
}
