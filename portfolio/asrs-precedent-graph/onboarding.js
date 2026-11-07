/* A guided search on the live interface; no sample reports or simulated results. */
(function (root) {
  "use strict";
  const STORAGE_KEY = "aviation-search-tutorial-v1";
  const steps = [
    {target: "#search-mode", title: "Choose how to search", next: "Describe an incident",
      text: "You’re a safety investigator looking for earlier incidents. Meaning finds similar situations, even with different wording. Keywords matches all your words. Tap this button to switch. Meaning downloads a search model on first use."},
    {target: "#omni", title: "What happened?", next: "See matching reports",
      text: "Describe an incident in the search box, such as “windshear during landing”. For Keywords, try a short term like “windshear”. You can use your own incident or the example below."},
    {target: "#palette [data-report]", title: "Open a search result", next: "Choose the highlighted report",
      text: "Tap the highlighted report to open it. Each result shows its source, date and a summary excerpt. Meaning results rank closest first; a similarity score is not a probability. Outside this guide, factor rows add filters instead."},
    {target: "#insp .ai-summary, #insp .ihead", title: "Read the report", next: "Check the original text",
      text: "This AI summary is a starting point for reading the report. The details panel also identifies its source, date and aircraft, with the source synopsis or probable cause when available. Compare those accounts before drawing conclusions."},
    {target: "#insp details.narr > summary", title: "Check the evidence", next: "Find related reports",
      text: "Tap this heading to load the original narrative or investigation text. Use it to check the summary and understand the incident in context. Scroll within the report panel to read more."},
    {target: "#cv", title: "Read the t-SNE map", next: "Explore one report’s links",
      text: "Each dot is a report. Nearby dots tend to describe similar situations: t-SNE compresses narrative embeddings into a 2D map. Colours follow the key; region labels name common factors and may repeat. Axes are not geography, time or severity; distant gaps are not reliable scores. Pan and pinch to explore themes, then tap a report to check its evidence."},
    {target: "#v-focus", title: "Follow the next lead", next: "Open Focus graph",
      text: "Focus places this report at the centre of its related reports and shared factors. Follow a neighbour to continue your investigation. Similarity suggests a lead; it does not establish the same incident or a cause."},
    {target: "#cv", title: "Use Focus to investigate why", next: "Finish tutorial",
      text: "The centre is your report. Other circles are related reports; squares are shared factors. Solid lines join reports and factors; dashed lines show text similarity. Positions arrange connections, unlike t-SNE. Follow neighbours or inspect factors to investigate patterns. Adjust link weights in Explore. Return to Map for context. Treat links as leads, not proof of incident identity or causality."}
  ];

  function hasSeen() {
    try { return !!window.localStorage.getItem(STORAGE_KEY); } catch (_) { return false; }
  }
  function remember() {
    try { window.localStorage.setItem(STORAGE_KEY, "seen"); } catch (_) { /* The guide still works in private storage. */ }
  }

  function mount(api) {
    const $ = s => document.querySelector(s);
    const welcome = document.createElement("dialog");
    welcome.className = "tutorial-welcome";
    welcome.setAttribute("aria-labelledby", "tutorial-welcome-title");
    welcome.innerHTML = `<p class="tutorial-eyebrow">Aviation Precedent Explorer · quick start</p>
      <h2 id="tutorial-welcome-title">Your first investigation<br>starts here.</h2>
      <p>Step into a safety investigator’s workflow: search for an incident, read the evidence and follow related reports.</p>
      <ol><li>Describe what happened</li><li>Find and read a report</li><li>Use the map and Focus to follow leads</li></ol>
      <p class="tutorial-note">A short, hands-on guide using the real search. You can leave at any time.</p>
      <button type="button" class="tutorial-primary" data-start>Start tutorial <span aria-hidden="true">→</span></button>
      <button type="button" class="tutorial-secondary" data-skip>Skip to website</button>`;
    document.body.append(welcome);
    const layer = document.createElement("div");
    layer.className = "tutorial-layer";
    layer.hidden = true;
    layer.innerHTML = `<div class="tutorial-shade"></div><div class="tutorial-shade"></div>
      <div class="tutorial-shade"></div><div class="tutorial-shade"></div>
      <div class="tutorial-spotlight" aria-hidden="true"></div>
      <section class="tutorial-card" role="region" aria-labelledby="tutorial-title">
        <div class="tutorial-meta"><span class="tutorial-eyebrow" id="tutorial-progress"></span><button type="button" data-exit>Exit tutorial</button></div>
        <div class="tutorial-copy" aria-live="polite" aria-atomic="true"><h2 id="tutorial-title" tabindex="-1"></h2><p id="tutorial-text"></p></div>
        <button type="button" class="tutorial-example" data-example>Try “windshear” in Keywords ↗</button>
        <div class="tutorial-actions"><button type="button" class="tutorial-back" data-back>Back</button><button type="button" class="tutorial-primary" data-next></button></div>
      </section>`;
    document.body.append(layer);
    const card = layer.querySelector(".tutorial-card");
    const next = layer.querySelector("[data-next]");
    const example = layer.querySelector("[data-example]");
    const restart = $("#restart-tutorial");
    let index = -1, active = false, frame = 0, previousFocus = null, inertNodes = [];

    function unlock() {
      inertNodes.forEach(node => { node.inert = false; });
      inertNodes = [];
    }
    function lockExcept(target) {
      unlock();
      // Leave the live target and tutorial accessible, including to screen readers.
      function visit(parent) {
        for (const node of parent.children) {
          if (node === layer || node === welcome || node === target || node.inert ||
              /^(SCRIPT|STYLE|LINK)$/.test(node.tagName)) continue;
          if (target && node.contains(target)) visit(node);
          else { node.inert = true; inertNodes.push(node); }
        }
      }
      visit(document.body);
    }
    function currentTarget() {
      if (index === 3) return $("#insp .ai-summary") || $("#insp .ihead");
      if (index === 4 && $("#insp details.narr")?.open) return $("#insp details.narr");
      if (index === 2) return $(steps[index].target) || $("#palette .semantic-status") || $("#palette .hint") || $("#q");
      return steps[index] ? $(steps[index].target) : null;
    }
    function bounds(x, y, w, h) { return `left:${x}px;top:${y}px;width:${Math.max(0, w)}px;height:${Math.max(0, h)}px`; }
    function position() {
      frame = 0;
      if (!active) return;
      const v = window.visualViewport;
      const width = v?.width || innerWidth, height = v?.height || innerHeight;
      const ox = v?.offsetLeft || 0, oy = v?.offsetTop || 0;
      document.body.classList.toggle("tutorial-compact", height < 500 && index < 3);
      const target = currentTarget();
      const b = target === $("#cv") ? api.diagramBounds() : target?.getBoundingClientRect();
      // Clamp a moving/scrolling target to the visible viewport, including the phone keyboard.
      const x = b ? Math.max(ox + 4, b.left - 5) : ox + width / 2;
      const y = b ? Math.max(oy + 4, Math.min(oy + height - 8, b.top - 5)) : oy + 8;
      const right = b ? Math.min(ox + width - 4, Math.max(x + 4, b.right + 5)) : x;
      const bottom = b ? Math.min(oy + height - 4, Math.max(y + 4, b.bottom + 5)) : y;
      const spotlight = layer.querySelector(".tutorial-spotlight");
      spotlight.hidden = !b;
      spotlight.style.cssText = bounds(x, y, right - x, bottom - y);
      const shades = layer.querySelectorAll(".tutorial-shade");
      const rectangles = b ? [[ox, oy, width, y - oy], [ox, y, x - ox, bottom - y],
        [right, y, ox + width - right, bottom - y], [ox, bottom, width, oy + height - bottom]]
        : [[ox, oy, width, height], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
      rectangles.forEach((r, i) => { shades[i].style.cssText = bounds(...r); });
      const below = oy + height - bottom - 24, above = y - oy - 24;
      const down = !b || below >= Math.min(260, card.scrollHeight) || below >= above;
      const available = b ? (down ? below : above) : height - 32;
      card.style.width = `${Math.min(380, width - 24)}px`;
      card.style.maxHeight = `${Math.max(100, available)}px`;
      card.style.left = `${Math.max(ox + 12, Math.min(x, ox + width - card.offsetWidth - 12))}px`;
      card.style.top = `${!b ? oy + Math.max(16, (height - card.offsetHeight) / 2)
        : down ? bottom + 12 : y - card.offsetHeight - 12}px`;
      card.classList.toggle("points-up", !!b && down);
      card.classList.toggle("points-down", !!b && !down);
      card.style.setProperty("--arrow-x", `${Math.max(22, Math.min(card.offsetWidth - 22,
        (x + right) / 2 - parseFloat(card.style.left)))}px`);
      if (index === 2) {
        const hasReport = !!$("#palette [data-report]");
        $("#tutorial-title").textContent = hasReport ? steps[2].title : "Waiting for a matching report";
        $("#tutorial-text").textContent = hasReport ? steps[2].text
          : "Check the highlighted search status. Meaning search may need time to download its model. If there are no matches, use Back to shorten your query, change modes or try the Keywords example.";
      }
      next.disabled = index === 1 ? !$("#q").value.trim() : index === 2;
      lockExcept(target);
    }
    function schedule() { if (active && !frame) frame = requestAnimationFrame(position); }
    function show(i) {
      unlock();
      index = i;
      const done = i === steps.length;
      const step = steps[i];
      $("#tutorial-title").textContent = done ? "Keep following the evidence." : step.title;
      $("#tutorial-text").textContent = done
        ? "You’ve searched for an incident, checked a report, read the t-SNE map and explored Focus connections. Use Explore to narrow by source, date or place. The ⓘ guide beside the view buttons can restart this tutorial whenever you need it."
        : step.text;
      if (api.mobile.matches) $("#tutorial-text").textContent = $("#tutorial-text").textContent.replace(/Explore/g, "Filters");
      $("#tutorial-progress").textContent = done ? "Ready to investigate" : `Search workflow · ${i + 1} of ${steps.length}`;
      next.textContent = done ? "Continue exploring" : step.next;
      layer.querySelector("[data-back]").hidden = i === 0 || done;
      example.hidden = i !== 1;
      if (i === 2) { $("#q").blur(); api.search(); }
      else { api.closePalette(); $("#q").blur(); }
      if (i === 3 || i === 4) api.inspect();
      if (i === 5) api.map();
      if (i === 7) api.focus();
      const target = currentTarget();
      target?.scrollIntoView({block: "nearest", behavior: "instant"});
      card.scrollTop = 0;
      card.querySelector(".tutorial-copy").scrollTop = 0;
      position();
      $("#tutorial-title").focus({preventScroll: true});
      schedule();
    }
    function start() {
      previousFocus = document.activeElement;
      if (welcome.open) welcome.close();
      $("#map-guide").close();
      api.prepare();
      active = true;
      layer.hidden = false;
      document.body.classList.add("tutorial-running");
      show(0);
    }
    function finish() {
      active = false;
      unlock();
      layer.hidden = true;
      welcome.close();
      document.body.classList.remove("tutorial-running", "tutorial-compact");
      api.closePalette();
      remember();
      const focus = previousFocus?.isConnected && !previousFocus.closest("dialog") ? previousFocus : $("#map-info");
      focus?.focus({preventScroll: true});
    }
    next.onclick = () => {
      if (next.disabled) return;
      if (index === steps.length) finish();
      else show(index + 1);
    };
    example.onclick = () => {
      api.keywords();
      $("#q").value = "windshear";
      $("#q").focus();
      $("#q").dispatchEvent(new Event("input", {bubbles: true}));
      schedule();
    };
    layer.querySelector("[data-back]").onclick = () => show(index - 1);
    layer.querySelector("[data-exit]").onclick = finish;
    welcome.querySelector("[data-start]").onclick = start;
    welcome.querySelector("[data-skip]").onclick = finish;
    welcome.addEventListener("cancel", e => { e.preventDefault(); finish(); });
    // Capture Escape before the app's search shortcut can clear the selected report.
    document.addEventListener("keydown", e => {
      if (!active) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); finish(); }
      else if (e.key === "Tab") {
        const target = currentTarget();
        const selector = 'button:not(:disabled), input, select, summary, a[href], [tabindex="0"]';
        const controls = [...(target ? [target, ...target.querySelectorAll(selector)] : []), ...card.querySelectorAll(selector)]
          .filter(el => el.matches(selector) && !el.closest("[inert]") && el.getClientRects().length);
        if (!controls.length) return;
        const at = controls.indexOf(document.activeElement);
        if (at < 0 || (!e.shiftKey && at === controls.length - 1) || (e.shiftKey && at === 0)) {
          e.preventDefault(); controls[e.shiftKey ? controls.length - 1 : 0].focus();
        }
      } else if ((e.key === "/" && !/INPUT|TEXTAREA/.test(e.target.tagName)) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault(); e.stopImmediatePropagation();
      }
    }, true);
    $("#q").addEventListener("input", schedule);
    document.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    // Search results and the inspector are rendered asynchronously by the main app.
    new MutationObserver(schedule).observe($("#palette"), {childList: true, subtree: true});
    $("#insp").addEventListener("toggle", e => {
      if (active && index === 4 && e.target.matches("details.narr")) {
        if (e.target.open) e.target.scrollIntoView({block: "start", behavior: "instant"});
        schedule();
      }
    }, true);
    new MutationObserver(() => {
      if (active && index === 4 && $("#insp details.narr")?.open) {
        $("#insp details.narr").scrollIntoView({block: "start", behavior: "instant"});
      }
      schedule();
    }).observe($("#insp"), {childList: true, subtree: true});
    api.mobile.addEventListener("change", schedule);
    restart.disabled = false;
    restart.onclick = start;
    if (api.mobile.matches && !hasSeen()) welcome.showModal();
    return {
      keepPalette: () => active && index === 2,
      reportSelected() {
        if (active && index === 2) show(3);
        else if (active && (index === 5 || index === 7)) { api.peek(); schedule(); }
      }
    };
  }
  root.SearchTutorial = {mount};
})(window);
