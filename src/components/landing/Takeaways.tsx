import { Container } from "@/components/ui/Container";
import { illuminateContent } from "@/content/illuminate";
export function Takeaways(){return <section className="landing-section takeaways" aria-labelledby="takeaways-title"><Container><p className="text-eyebrow">What you&apos;ll leave with</p><h2 id="takeaways-title">A clearer way to think, map and explain.</h2><ol>{illuminateContent.participantValue.map((item)=><li key={item.key}><h3>{item.title}</h3><p>{item.description}</p></li>)}</ol></Container></section>}
