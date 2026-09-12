import { SiteHeader } from "@/components/SiteHeader";
import { SocialRail } from "@/components/SocialRail";
import { Hero } from "@/components/Hero";
import { AboutSection, StructureSection, GuidelinesSection } from "@/components/OfficialSections";
import { BenefitCards } from "@/components/BenefitCards";
import { EarlyBirdBand } from "@/components/EarlyBirdBand";
import { FlowSteps } from "@/components/FlowSteps";
import { SiteFooter } from "@/components/SiteFooter";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <SocialRail />
      <main>
        <Hero />
        <AboutSection />
        <StructureSection />
        <GuidelinesSection />
        <BenefitCards />
        <EarlyBirdBand />
        <FlowSteps />
      </main>
      <SiteFooter />
    </>
  );
}
