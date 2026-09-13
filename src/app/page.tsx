import { SiteHeader } from "@/components/SiteHeader";
import { SocialRail } from "@/components/SocialRail";
import { AmbientBackdrop } from "@/components/AmbientBackdrop";
import { Hero } from "@/components/Hero";
import { AboutSection, StructureSection, GuidelinesSection } from "@/components/OfficialSections";
import { ImpactSection } from "@/components/ImpactSection";
import { BenefitCards } from "@/components/BenefitCards";
import { EarlyBirdBand } from "@/components/EarlyBirdBand";
import { FlowSteps } from "@/components/FlowSteps";
import { SiteFooter } from "@/components/SiteFooter";

export default function Home() {
  return (
    <>
      {/* fixed particle backdrop — z-0, behind everything, never intercepts input */}
      <AmbientBackdrop />
      {/* content layer above the backdrop */}
      <div className="relative z-10">
        <SiteHeader />
        <main>
          <Hero />
          <AboutSection />
          <ImpactSection />
          <StructureSection />
          <GuidelinesSection />
          <BenefitCards />
          <EarlyBirdBand />
          <FlowSteps />
        </main>
        <SiteFooter />
      </div>
      <SocialRail />
    </>
  );
}
