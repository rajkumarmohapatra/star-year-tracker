(() => {
  const input = document.querySelector("#placeSearch");
  const results = document.querySelector("#placeResults");
  const status = document.querySelector("#placeStatus");
  let timer;
  let controller;
  let revision = 0;
  function cancel() {
    ++revision;
    clearTimeout(timer);
    controller?.abort();
    results.replaceChildren();
  }
  async function search() {
    const query = input.value.trim();
    if (query.length < 2) { status.textContent = "Enter at least 2 characters."; return; }
    const request = ++revision;
    controller?.abort();
    controller = new AbortController();
    const active = controller;
    const timeout = setTimeout(() => active.abort(), 12000);
    status.textContent = "Searching places...";
    try {
      const params = new URLSearchParams({name: query, count: "6", language: "en", format: "json"});
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {signal: active.signal});
      if (!response.ok) throw Error("Search failed");
      const data = await response.json();
      if (request !== revision) return;
      results.replaceChildren();
      const matches = (data.results || []).filter(place => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
      status.textContent = matches.length ? "Select a matching place below." : "No matching places. Try a nearby city or enter coordinates.";
      for (const place of matches) {
        const label = [...new Set([place.name, place.admin1, place.country].filter(Boolean))].join(", ");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => {
          cancel();
          controls.lat.value = place.latitude;
          controls.lon.value = place.longitude;
          controls.preset.value = "custom";
          placeName = label;
          input.value = label;
          status.textContent = `${label} selected`;
          buildYear();
          input.focus();
        });
        results.append(button);
      }
    } catch {
      if (request === revision) status.textContent = "Search unavailable. Try again or enter coordinates.";
    } finally { clearTimeout(timeout); }
  }
  input.addEventListener("input", () => { cancel(); status.textContent = "Select a search result to change location."; timer = setTimeout(search, 350); });
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); clearTimeout(timer); search(); }
    if (event.key === "Escape") { cancel(); input.value = placeName; status.textContent = `${placeName || "Coordinates"} selected`; }
    if (event.key === "ArrowDown") { event.preventDefault(); results.querySelector("button")?.focus(); }
  });
  for (const element of [controls.lat, controls.lon, controls.preset, controls.reset, controls.useLocation]) {
    element.addEventListener(element.tagName === "BUTTON" ? "click" : "input", cancel);
  }
})();
