import { Container } from "@/components/ui/Container";
import { getPublishableCurriculum } from "@/content/illuminate";

export function LearningMap() {
  const curriculum = getPublishableCurriculum();
  return <section className="landing-section learning-map" aria-labelledby="learning-map-title"><Container><p className="text-eyebrow">Now that you&apos;ve seen how the thinking connects</p><h2 id="learning-map-title">What you&apos;ll actually learn</h2><p className="learning-map__intro">Here&apos;s what Illuminate helps you explore, step by step.</p><ol>{curriculum.map((module, index) => <li key={module.key}><span>0{index + 1}</span><div><h3>{module.title}</h3><small>{module.officialTopic}</small><p>{module.description}</p></div></li>)}</ol></Container></section>;
}
