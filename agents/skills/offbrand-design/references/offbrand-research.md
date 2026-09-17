# Research: OFF+BRAND's composition, interaction, and motion method

This document is the evidence ledger behind [`../SKILL.md`](../SKILL.md). It separates what the sources explicitly support from the design inferences SnapWorth adopts.

All descriptions are paraphrased and summarized from the linked sources. Content was rephrased for compliance with licensing restrictions. No external source code, assets, layout, mark, motion sequence, or distinctive trade dress is reproduced.

## Research method and limits

The expanded review covered:

- the [OFF+BRAND homepage](https://www.itsoffbrand.com);
- ten requested studio case studies: Microsoft Windows, Vizcom, Steven.com, Lando Norris, Trevor Noah, Aether 1, The Online School, Tillman Fiber, Bella, and Webflow.com;
- award/gallery records from Awwwards;
- a Communication Arts technical interview;
- DesignRush editorial/jury summaries.

The studio pages were inspected through their published, extractable case-study text. The award/editorial pages added descriptions and scoring, but this pass did not use a frame-by-frame interaction recording or inspect private/source implementation. Therefore:

- **Sourced fact** below means the linked source states or independently describes it.
- **Observation** means a pattern supported across multiple source descriptions.
- **SnapWorth inference** means original guidance derived from that pattern. It is not presented as a factual claim about OFF+BRAND's implementation.

Claims such as exact mask shapes, crop ratios, stagger intervals, easing curves, shared-element mechanics, and card recipes are intentionally absent from the sourced-fact sections because the reviewed sources do not establish them. Those specifics are SnapWorth's own system in [`motion-language.md`](motion-language.md) and [`../SKILL.md`](../SKILL.md).

## Studio position and recurring process

The [studio homepage](https://www.itsoffbrand.com) presents OFF+BRAND as a founder-led creative and technology studio spanning brand identity, digital experience, WebGL/VR, UX/UI, app development, art direction, and product design. The homepage frames emotional impact and technical innovation together and foregrounds a portfolio where design, development, and 3D repeatedly overlap.

Across the case studies, the recurring process is:

1. State a large question or business objective.
2. Find a tension in the subject: innovation/trust, automation/humanity, heritage/youth, density/lightness, richness/performance.
3. Build a visual and interaction system around that tension.
4. Sequence the experience so visuals, copy, interaction, and motion hand off meaning.
5. Protect clarity, responsiveness, and performance as the expressive layer becomes richer.

That sequence—not WebGL—is the transferable method.

## Primary case studies

### [Microsoft Windows](https://www.itsoffbrand.com/our-work/microsoft-windows): expressive modules inside a scalable system

**Sourced facts**

- The project created a reusable component ecosystem used for an immersive homepage and ten additional pages.
- Components were intended to support multiple internal teams and changing product requirements.
- The case study describes both immersive storytelling modules and flexible everyday content modules in the same system.
- Consistency, accessibility, speed, and mobile-first 3D delivery are named constraints.

**Observation**

Craft does not require one-off pages. A reusable system can contain both expressive and utilitarian modules if their roles and constraints are explicit.

**SnapWorth inference**

Use named composition and motion recipes in shared components. Do not let art direction migrate into route-specific raw styles. Expressiveness should be a capability of the system, not an exception to it.

### [Vizcom](https://www.itsoffbrand.com/our-work/vizcom): transformation as explanation

**Sourced facts**

- The objective was to make audience, purpose, and value understandable within the opening seconds.
- The hero is described as a short story that shows sketch, transformation, and iteration.
- Motion demonstrates change while copy establishes context.
- The broader site is described as one continuous story using 3D, WebGL, Rive, GSAP, copy, and interaction together.
- Each page follows a show/explain/invite logic rather than relying on one visual technique.

**Observation**

Motion is strongest when it proves a transformation and hands attention from context to outcome. Copy and movement are peers.

**SnapWorth inference**

Capture → saved → analyzing → estimate should read as one continuous causal sequence. The same photo persists, status copy names each state, and the result emerges from the photo context rather than appearing as an unrelated panel.

### [Steven.com](https://www.itsoffbrand.com/our-work/steven-com): exploration with a clear fallback structure

**Sourced facts**

- The site represents multiple business pillars inside a navigable 3D environment.
- Pillars occupy distinct spaces connected by hand-drawn lines and color-coded routes.
- The study attributes cinematic scroll and responsive hover behavior to GSAP-powered interactions.
- Bold editorial typography is paired with hand-crafted illustration to balance automation and humanity.
- Below the immersive hero, content becomes clear and structured; responsive layouts retain ambition on mobile.
- Performance work includes optimized assets, lazy loading, and streamlined code.

**Observation**

Expressive navigation remains useful when users can understand the structure without the expressive layer. Spatial cues can reinforce relationships, but a clear content model does the actual wayfinding.

**SnapWorth inference**

Use subtle spatial continuity for card → detail and sheet relationships, while keeping URLs, headings, focus order, and static structure sufficient on their own. Never make parallax or hover a navigation requirement.

### [Lando Norris](https://www.itsoffbrand.com/our-work/lando-norris): motion derived from subject

**Sourced facts**

- The studio describes speed-inspired animation, sharp transitions, responsive interactions, cinematic scrolling, and media exploration.
- The visual system balances racing heritage with a younger, playful personality through typography, color, and 3D/WebGL.
- Fast load, smooth scroll, asset optimization, lazy loading, and immediate interaction are treated as part of the experience.
- The [Awwwards record](https://www.awwwards.com/sites/lando-norris) identifies it as a Site of the Day and reports high animation/transition scoring.
- A [DesignRush review](https://www.designrush.com/best-designs/websites/lando-norris-website-design) describes reactive animation, high-contrast racing imagery, and a modular separation between competition and cultural content.

**Observation**

A motion language feels coherent when velocity and transition character are derived from the subject, then repeated consistently within a modular system.

**SnapWorth inference**

SnapWorth motion should derive from its subject: capture, material evidence, provisional analysis, and value resolution. Its signature is a photo that settles, remains durable, is examined, and yields an explicitly provisional number—not generic springy UI.

### [Trevor Noah](https://www.itsoffbrand.com/our-work/trevor-noah): personality without interaction excess

**Sourced facts**

- The concept presents a series of mental snapshots in which fragmented ideas become complete ones.
- Assets remain flat 2D elements with a restrained peeling-photo effect to add depth without pulling focus from content.
- The experience has to organize a large body of shows, books, projects, and ventures while remaining approachable.
- A [DesignRush review](https://www.designrush.com/best-designs/websites/trevor-noah-website-design) describes a torn-paper collage hero, a numbered navigation structure, strong typographic/image composition, and restraint from unnecessary animation.

**Observation**

Art direction can be vivid while interaction remains simple. Flat imagery, a strong grid, and one tactile cue may create more personality than pervasive motion.

**SnapWorth inference**

Use photo crops, labels, borders, grouped planes, and limited overlap to make feeds expressive before adding animation. If the static frame has no point of view, motion will not fix it.

### [Aether 1](https://www.itsoffbrand.com/our-work/aether1): chaptered cinematic continuity under a performance ceiling

**Sourced facts**

- The fictional launch project combines real-time 3D, an AI guide, and a continuous cinematic experience.
- Visual direction uses a restrained dark palette, soft gradients, negative space, and a hero object suspended in light.
- The site is sequenced through four product chapters using camera paths and scene changes.
- The studio reports 60 fps particle fields on an iPhone SE 2020, a reduced-motion route, and simplified interaction calculations.
- The [Awwwards record](https://www.awwwards.com/sites/aether-1) identifies it as a Site of the Day and shows strong animation/transition and performance scoring. Its accessibility score is lower than its animation score, useful evidence that award recognition does not equal accessibility proof.
- In a [Communication Arts interview](https://www.commarts.com/webpicks/aether-1-earbuds), OFF+BRAND describes 3D assets, particle fields, custom scroll interactions, audio-reactive visuals, baked animation, simulated optical effects, downscaled computation, and a custom controller for reliable forward/backward scene states.

**Observation**

Cinematic craft depends on state control, sequencing, and simplification as much as visual richness. Continuity must work in both directions and under constrained hardware.

**SnapWorth inference**

Treat each UI transition as a state machine with cancellation and reversal behavior. Use one focal sequence for estimation, preserve a static/reduced path, and prefer baked/named recipes over many independently animated children.

### [The Online School](https://www.itsoffbrand.com/our-work/the-online-school): density made light

**Sourced facts**

- The visual direction aims to feel playful and trustworthy for audiences accustomed to traditional education.
- A vibrant palette and friendly type selection carry much of the identity.
- A restrained WebGL logo hover is described as a small interaction rather than a dominant experience.
- Playful brand elements are integrated into a dense information framework to avoid overload.
- The study reports conversion growth beyond its stated target.

**Observation**

Density is not solved by stripping away useful information. A clear framework plus occasional identity-rich moments can feel lighter than uniform card repetition.

**SnapWorth inference**

Feed and Marketplace should use stable scanning anchors, strong crop/value hierarchy, and one expressive interruption per viewport. Filters and metadata remain complete and predictable.

### [Tillman Fiber](https://www.itsoffbrand.com/our-work/tillman-fiber): one identity across audiences

**Sourced facts**

- The brand needed to address local government, business, homeowners, investors, and potential employees.
- The stated risk was becoming bland while serving a broad market.
- Light and dark modes are presented as an accessibility aid.

**Observation**

Role-specific information density can vary without creating separate visual identities.

**SnapWorth inference**

Owners, sellers, buyers, community members, and administrators share one token and motion system. Admin gets denser metadata, not a separate theme or more decorative motion.

### [Bella Kitchenware](https://www.itsoffbrand.com/our-work/bella): tangible product behavior

**Sourced facts**

- Product-specific 3D animation is used to reveal appliance design and function.
- The studio describes motion as a way to make products feel tangible and explorable.
- Above-the-fold WebGL is optimized for high-traffic e-commerce.
- The experience is described as mobile-first and performance-oriented.

**Observation**

Motion is informative when it helps users understand the object or its behavior. The interaction should feel related to what is being shown.

**SnapWorth inference**

Item-photo motion may reinforce capture, crop continuity, saving, and focus. It must not rotate, filter, or dramatize a photo in a way that changes the apparent item condition.

### [Webflow.com](https://www.itsoffbrand.com/our-work/webflow): product-centered prototyping

**Sourced facts**

- The product interface remains the center of the homepage concept.
- The team first narrowed a larger set of product ideas into selected visual concepts.
- Motion, design, 3D, and development were produced in parallel and integrated continuously.
- Early proofs of concept supported delivery under a tight deadline.

**Observation**

High-craft behavior needs early prototypes against real content and constraints. Motion cannot be handed off as final polish.

**SnapWorth inference**

Prototype the estimate sequence, reduced-motion parity, card/detail continuity, and vote/filter transitions before scaling the component library. Test interruption and low-power behavior in the prototype, not after visual approval.

## Independent-source takeaways

### Award records are signals, not conformance evidence

The Awwwards pages for [Aether 1](https://www.awwwards.com/sites/aether-1) and [Lando Norris](https://www.awwwards.com/sites/lando-norris) show that animation and transition craft were recognized by judges. They also score accessibility separately. This supports a review model where visual craft and accessibility are evaluated independently and both must pass.

SnapWorth must not infer WCAG conformance, keyboard quality, reduced-motion parity, or runtime performance from an award badge.

### Technical continuity is state management

The [Communication Arts Aether 1 interview](https://www.commarts.com/webpicks/aether-1-earbuds) is the strongest technical source in this pass. The studio reports that a custom controller was needed because earlier infinite-scroll approaches produced broken states and inconsistent transitions. That supports a general rule: transitions must have explicit forward, backward, cancel, and completed states.

SnapWorth does not need infinite scroll or WebGL to apply that lesson. It needs deterministic capture, estimation, vote, filter, message, route, and sheet transitions that can be interrupted without corrupting semantic state.

### Static structure carries personality

The DesignRush reviews of [Trevor Noah](https://www.designrush.com/best-designs/websites/trevor-noah-website-design) and [Lando Norris](https://www.designrush.com/best-designs/websites/lando-norris-website-design) independently emphasize visual identity, modular structure, imagery, typography, and restrained or reactive animation. This supports SnapWorth's priority order:

1. composition;
2. content hierarchy;
3. interaction state;
4. motion finish.

Do not reverse that order.

## Cross-case synthesis

### What the evidence supports

- One clear question or objective organizes the experience.
- Expressive and utilitarian modules can live in one component system.
- Editorial typography, imagery, negative space, and contrast establish personality before motion.
- Motion is tied to transformation, subject matter, product function, or narrative progression.
- Long experiences are sequenced into understandable beats or chapters.
- Hover and spatial interaction are treated as responsive enhancements, not replacements for content structure.
- Performance optimization, asset discipline, mobile adaptation, and reduced-motion paths are part of creative delivery.
- Dense information can feel light through hierarchy and selective brand moments.
- Rapid prototyping aligns visual, motion, engineering, and narrative decisions.

### What the evidence does not establish

The reviewed sources do **not** establish that OFF+BRAND uses a universal:

- easing curve or duration scale;
- reveal, clip, stagger, overshoot, or parallax recipe;
- grid, crop ratio, layer count, or card anatomy;
- shared-element transition implementation;
- React Native or Expo approach;
- accessibility-conformant pattern library;
- interaction that SnapWorth should reproduce.

Those details in the SnapWorth skill are original design decisions constrained by SnapWorth's product, architecture, and requirements.

## SnapWorth design inferences

The following are deliberate inferences, not sourced implementation claims:

1. **Art-directed system:** use scale contrast, grid-held asymmetry, crop families, negative space, and up to three semantic planes to avoid generic SaaS card composition.
2. **Task choreography:** structure each flow as orient → act → resolve → continue, with one focal handoff at a time.
3. **Continuity:** preserve photo identity across capture, History, card, and detail; preserve geometry from skeleton to content.
4. **Tiered motion:** permit short functional and artistic responses outside estimation while reserving prolonged/repeating motion for the estimation wait and reveal.
5. **Honest reveal:** never show an estimate value without its label, dashed boundary, and caption; never transform it into asking-price styling.
6. **Input parity:** hover can enrich but keyboard focus, touch, and static presentation retain all information and actions.
7. **Interruption:** latest valid intent wins; visual transitions stop without rolling semantic state backward.
8. **Reduced parity:** remove spatial/transform effects while preserving text, values, actions, focus, and announcements.
9. **Performance-first craft:** expressive moments are bounded, route-local, and tested against first-usable-page and estimate deadlines.
10. **Originality:** use SnapWorth's photo/durability/provisional-value subject matter; do not reproduce another site's composition or motion sequence.

## Source index

### Studio sources

- [OFF+BRAND homepage](https://www.itsoffbrand.com)
- [Microsoft Windows case study](https://www.itsoffbrand.com/our-work/microsoft-windows)
- [Vizcom case study](https://www.itsoffbrand.com/our-work/vizcom)
- [Steven.com case study](https://www.itsoffbrand.com/our-work/steven-com)
- [Lando Norris case study](https://www.itsoffbrand.com/our-work/lando-norris)
- [Trevor Noah case study](https://www.itsoffbrand.com/our-work/trevor-noah)
- [Aether 1 case study](https://www.itsoffbrand.com/our-work/aether1)
- [The Online School case study](https://www.itsoffbrand.com/our-work/the-online-school)
- [Tillman Fiber case study](https://www.itsoffbrand.com/our-work/tillman-fiber)
- [Bella Kitchenware case study](https://www.itsoffbrand.com/our-work/bella)
- [Webflow.com case study](https://www.itsoffbrand.com/our-work/webflow)

### Independent and technical sources

- [Aether 1 — Awwwards Site of the Day](https://www.awwwards.com/sites/aether-1)
- [Lando Norris — Awwwards Site of the Day](https://www.awwwards.com/sites/lando-norris)
- [Aether 1 Earbuds — Communication Arts](https://www.commarts.com/webpicks/aether-1-earbuds)
- [Lando Norris website review — DesignRush](https://www.designrush.com/best-designs/websites/lando-norris-website-design)
- [Trevor Noah website review — DesignRush](https://www.designrush.com/best-designs/websites/trevor-noah-website-design)
