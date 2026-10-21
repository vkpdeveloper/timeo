import { Cta } from "./cta";
import { Hero } from "./hero";
import { LandingNav } from "./nav";
import { LandingMotion } from "./reveal";
import { Features, FinalCta, Footer, HowItWorks, WhyFocus } from "./sections";
import "./landing.css";

/** The public landing page. The route file only wraps this, so it can move between paths. */
export function Landing() {
  return (
    <LandingMotion>
      <div className="min-h-dvh overflow-x-clip bg-bg">
        <LandingNav>
          <Cta variant="nav" />
        </LandingNav>
        <main>
          <Hero />
          <WhyFocus />
          <Features />
          <HowItWorks />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </LandingMotion>
  );
}
