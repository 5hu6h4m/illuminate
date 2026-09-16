import { getPublishableContent } from "@/content/content-types";
import { illuminateContent } from "@/content/illuminate";
export function IsThisForMe(){const items=getPublishableContent(illuminateContent.isThisForMe);return <section className="landing-section fit" aria-labelledby="fit-title"><div className="container"><p className="text-eyebrow">Is this for me?</p><h2 id="fit-title">You don&apos;t need to call yourself an entrepreneur to start learning like one.</h2><dl>{items.map((item)=><div key={item.key}><dt>{item.question}</dt><dd>{item.answer}</dd></div>)}</dl></div></section>}
