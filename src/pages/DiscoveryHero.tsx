import type { ReactNode } from 'react';

export function DiscoveryHero({ children }: { children: ReactNode }) {
  return (
    <section className="hero" aria-labelledby="discovery-title">
      <div className="hero-inner">
        <div className="goal-main">
          <h1 id="discovery-title">What would you like to do with AI?</h1>
          <p className="hero-lede">
            Tell us what you're working on in your own words. We'll help you
            find a few useful videos.
          </p>
          {children}
        </div>
        <aside className="inspiration" aria-labelledby="inspiration-title">
          <h2 id="inspiration-title">See AI at work in nonprofits.</h2>
          <p>Practical demos from people doing work like yours.</p>
        </aside>
      </div>
    </section>
  );
}
