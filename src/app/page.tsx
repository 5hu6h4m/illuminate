import { SiteHeader } from "@/components/SiteHeader";
import { Hero } from "@/components/Hero";
import { BenefitCards } from "@/components/BenefitCards";
import { EarlyBirdBand } from "@/components/EarlyBirdBand";
import { FlowSteps } from "@/components/FlowSteps";
import { SiteFooter } from "@/components/SiteFooter";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <BenefitCards />
        <EarlyBirdBand />
        <FlowSteps />
      </main>
      <SiteFooter />
    </>
  );
}
