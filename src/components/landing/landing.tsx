import { Certainty } from "./certainty";
import { FinalCta, Footer } from "./closing";
import { Cta } from "./cta";
import { Hero } from "./hero";
import { LandingMotion } from "./motion";
import { LandingNav } from "./nav";
import { Pwa } from "./pwa";
import { Showcase } from "./showcase";
import { Steps } from "./steps";
import { Timi } from "./timi";

/** The public landing page. The route file only wraps this, so it can move between paths. */
export function Landing() {
  return (
    <LandingMotion>
      <div className="relative min-h-dvh overflow-x-clip">
        <LandingNav>
          <Cta variant="nav" />
        </LandingNav>
        <main>
          <Hero cta={<Cta variant="hero" className="justify-center lg:justify-start" />} />
          <Certainty />
          <Steps />
          <Showcase />
          <Timi />
          <Pwa />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </LandingMotion>
  );
}
