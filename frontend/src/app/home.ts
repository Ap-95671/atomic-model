/** Presentation shell; #home-scene receives the already mounted atomic viewer. */
export const homeMarkup=`
<main id="home-workspace" class="home-workspace" aria-label="Quantum Atom Lab overview" hidden>
 <section class="home-hero">
  <div class="hero-copy"><span class="eyebrow"><i class="status-dot"></i> A SMALL WINDOW INTO THE QUANTUM WORLD</span>
   <h1>Matter, made<br><em>understandable.</em></h1>
   <p>Go beyond the textbook. Explore atomic orbitals, build an intuition for bonding, and put quantum ideas to the test.</p>
   <div class="hero-actions"><a class="primary-link" href="#lab=atomic">Enter the laboratory <span aria-hidden="true">↗</span></a><button class="secondary" data-home-guide>Take a guided tour</button></div>
   <div class="hero-facts"><span><strong>118</strong> elements</span><span><strong>7</strong> laboratories</span><span><strong>3D</strong> interactive models</span></div>
  </div>
  <div class="hero-visual"><div class="hero-visual-header"><span>LIVE / HYDROGEN 1s</span><span>ψ → |ψ|²</span></div><div id="home-scene"></div><div class="hero-visual-footer"><span>A probability cloud. Each dot is a possible measurement.</span><span>Drag to explore ↗</span></div></div>
 </section>
 <section class="home-tools" aria-labelledby="tools-title"><div class="home-section-title"><div><span class="eyebrow">YOUR SCIENTIFIC TOOLKIT</span><h2 id="tools-title">Follow your curiosity.</h2></div><p>From the structure of an atom to the behavior of a quantum system. Choose a question and start exploring.</p></div>
 <div class="tool-cards">
  <a href="#lab=atomic" class="tool-card"><span class="tool-number">01 / ATOMIC</span><svg viewBox="0 0 260 110" aria-hidden="true"><circle cx="130" cy="55" r="38"/><circle cx="130" cy="55" r="25"/><circle cx="130" cy="55" r="11"/><path d="M67 55h126M130 6v98"/></svg><h3>Meet the elements <span>↗</span></h3><p>Reference configurations, occupied orbitals, and a full periodic table.</p><span class="tool-tag">Atomic Explorer</span></a>
  <a href="#lab=molecular" class="tool-card"><span class="tool-number">02 / MOLECULAR</span><svg viewBox="0 0 260 110" aria-hidden="true"><path d="M91 55h78" stroke-width="7"/><circle cx="83" cy="55" r="26"/><circle cx="177" cy="55" r="26"/><ellipse cx="130" cy="55" rx="99" ry="45" stroke-dasharray="3 5"/></svg><h3>See the bond <span>↗</span></h3><p>Explore molecular structures, bonding, and calculated molecular orbitals.</p><span class="tool-tag">Molecular Lab</span></a>
  <a href="#lab=spectroscopy" class="tool-card"><span class="tool-number">03 / SPECTROSCOPY</span><svg viewBox="0 0 260 110" aria-hidden="true"><path d="M36 84h188M36 58h188M36 28h188M36 16h188"/><path d="M145 28v56m-8-9 8 9 8-9" stroke-width="3"/><path d="M165 50q10-16 20 0t20 0t20 0"/></svg><h3>Read the light <span>↗</span></h3><p>Connect hydrogenic energy levels, selection rules, and spectral lines.</p><span class="tool-tag">Spectral Laboratory</span></a>
 </div></section>
 <section class="home-principles"><div><span class="eyebrow">BUILT FOR UNDERSTANDING</span><h2>Beautiful models.<br>Visible assumptions.</h2></div><div><h3>Know what you’re looking at.</h3><p>Every laboratory identifies its model, units, and limitations. A probability density is different from a classical trajectory. An illustrative orbital is different from a many-electron calculation.</p><a href="#lab=history">Explore the evolution of atomic theory ↗</a></div><div><h3>Make the experiment yours.</h3><p>Change a parameter. Inspect the result. Share the experiment URL, save a preset on your device, or export a figure for your next lesson.</p><a href="#lab=experiments">Try a quantum experiment ↗</a></div></section>
</main>`;
