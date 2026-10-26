const controls = {
  preset: document.querySelector("#preset"),
  lat: document.querySelector("#lat"),
  lon: document.querySelector("#lon"),
  year: document.querySelector("#year"),
  bortle: document.querySelector("#bortle"),
  threshold: document.querySelector("#threshold"),
  useLocation: document.querySelector("#useLocation"),
  reset: document.querySelector("#reset"),
  monthFocus: document.querySelector("#monthFocus")
};

const output = {
  bortle: document.querySelector("#bortleValue"),
  threshold: document.querySelector("#thresholdValue"),
  calendar: document.querySelector("#calendar"),
  selectedNight: document.querySelector("#selectedNight"),
  bestList: document.querySelector("#bestList"),
  heroScore: document.querySelector("#heroScore"),
  greatCount: document.querySelector("#greatCount"),
  goodCount: document.querySelector("#goodCount"),
  bestMonth: document.querySelector("#bestMonth"),
  longestRun: document.querySelector("#longestRun"),
  locationTitle: document.querySelector("#locationTitle")
};

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const shortMonths = monthNames.map((month) => month.slice(0, 3));
const dayMs = 86400000;
let nights = [];
let selectedIndex = 0;
let placeName = "Delhi, India";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toRad(deg) {
  return deg * Math.PI / 180;
}

function toDeg(rad) {
  return rad * 180 / Math.PI;
}

function dayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / dayMs);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function solarDeclination(day) {
  return 23.44 * Math.sin(toRad((360 / 365) * (day - 81)));
}

function daylightHours(lat, declination, sunAltitude = -0.83) {
  const latRad = toRad(lat);
  const decRad = toRad(declination);
  const altRad = toRad(sunAltitude);
  const cosHourAngle = (Math.sin(altRad) - Math.sin(latRad) * Math.sin(decRad)) / (Math.cos(latRad) * Math.cos(decRad));

  if (cosHourAngle <= -1) return 24;
  if (cosHourAngle >= 1) return 0;
  return (2 * toDeg(Math.acos(cosHourAngle))) / 15;
}

function moonAge(date) {
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const synodicMonth = 29.53058867;
  const days = (date.getTime() - knownNewMoon) / dayMs;
  return ((days % synodicMonth) + synodicMonth) % synodicMonth;
}

function circularDistance(a, b, period) {
  const diff = Math.abs(a - b) % period;
  return Math.min(diff, period - diff);
}

function overlapHours(startA, endA, startB, endB) {
  let total = 0;
  for (const offset of [-24, 0, 24]) {
    const start = Math.max(startA, startB + offset);
    const end = Math.min(endA, endB + offset);
    total += Math.max(0, end - start);
  }
  return total;
}

function getNightData(date, lat, lon, bortle) {
  const doy = dayOfYear(date);
  const declination = solarDeclination(doy);
  const civilDay = daylightHours(lat, declination, -0.83);
  const astroDay = daylightHours(lat, declination, -18);
  const night = clamp(24 - civilDay, 0, 24);
  const astroNight = clamp(24 - astroDay, 0, 24);
  const localSolarOffset = lon / 15;
  const sunset = 12 + civilDay / 2 - localSolarOffset;
  const sunrise = 12 - civilDay / 2 - localSolarOffset + 24;
  const age = moonAge(date);
  const illumination = (1 - Math.cos((2 * Math.PI * age) / 29.53058867)) / 2;
  const moonRise = 6 + (age / 29.53058867) * 24 - localSolarOffset;
  const moonSet = moonRise + 12.6;
  const darkStart = sunset + clamp((night - astroNight) / 2, 0.4, 1.8);
  const darkEnd = sunrise - clamp((night - astroNight) / 2, 0.4, 1.8);
  const moonOverlap = overlapHours(darkStart, darkEnd, moonRise, moonSet);
  const darkMoonless = clamp(astroNight - moonOverlap * (0.45 + illumination * 0.85), 0, astroNight);
  const darknessFactor = clamp(darkMoonless / 8.8, 0, 1);
  const moonFactor = clamp(1 - illumination * 0.82 - (moonOverlap / Math.max(astroNight, 1)) * 0.45, 0, 1);
  const latitudePenalty = Math.abs(lat) > 58 && astroNight < 2 ? 0.55 : 1;
  const lightPollution = clamp(1 - ((bortle - 1) / 8) * 0.52, 0.38, 1);
  const seasonal = clamp((night - 5.5) / 7, 0, 1);
  const score = Math.round(100 * latitudePenalty * lightPollution * (darknessFactor * 0.42 + moonFactor * 0.38 + seasonal * 0.2));
  const phaseDistance = circularDistance(age, 0, 29.53058867);

  return {
    date,
    doy,
    score: clamp(score, 0, 100),
    night,
    astroNight,
    moonAge: age,
    illumination,
    moonOverlap,
    darkMoonless,
    moonPhase: phaseDistance < 1.8 ? "New Moon" : age < 7.4 ? "Waxing Crescent" : age < 9.5 ? "First Quarter" : age < 14.8 ? "Waxing Gibbous" : age < 16.8 ? "Full Moon" : age < 22.1 ? "Waning Gibbous" : age < 24.3 ? "Last Quarter" : "Waning Crescent"
  };
}

function rating(score) {
  if (score >= 82) return "Great";
  if (score >= 65) return "Good";
  if (score >= 43) return "Fair";
  return "Poor";
}

function colorForScore(score) {
  if (score >= 82) return "#5df2c2";
  if (score >= 65) return "#8bd36f";
  if (score >= 43) return "#f5c45f";
  return "#f46f64";
}

function buildYear() {
  const lat = clamp(Number(controls.lat.value) || 0, -89, 89);
  const lon = clamp(Number(controls.lon.value) || 0, -180, 180);
  const year = clamp(Number(controls.year.value) || new Date().getFullYear(), 1900, 2100);
  const bortle = Number(controls.bortle.value);
  const start = Date.UTC(year, 0, 1);
  const days = (Date.UTC(year + 1, 0, 1) - start) / dayMs;
  nights = Array.from({ length: days }, (_, index) => getNightData(new Date(start + index * dayMs), lat, lon, bortle));
  selectedIndex = clamp(selectedIndex, 0, nights.length - 1);
  render();
  weatherPlanner.setLocation(lat, lon);
}

function render() {
  output.bortle.value = controls.bortle.value;
  output.threshold.value = controls.threshold.value;
  output.locationTitle.textContent = placeName || `${Number(controls.lat.value).toFixed(2)}, ${Number(controls.lon.value).toFixed(2)}`;
  if (document.activeElement !== document.querySelector("#placeSearch")) {
    document.querySelector("#placeSearch").value = placeName || "";
    document.querySelector("#placeStatus").textContent = `${output.locationTitle.textContent} selected`;
  }
  renderMonthOptions();
  renderStats();
  renderCalendar();
  renderNight(nights[selectedIndex]);
  renderBestList();
}

function renderMonthOptions() {
  const current = controls.monthFocus.value;
  controls.monthFocus.innerHTML = monthNames.map((name, index) => `<option value="${index}">${name}</option>`).join("");
  controls.monthFocus.value = current || "0";
}

function renderStats() {
  const great = nights.filter((night) => night.score >= 82).length;
  const good = nights.filter((night) => night.score >= 65).length;
  const monthScores = monthNames.map((_, month) => {
    const monthNights = nights.filter((night) => night.date.getUTCMonth() === month);
    return monthNights.reduce((sum, night) => sum + night.score, 0) / monthNights.length;
  });
  const bestMonthIndex = monthScores.indexOf(Math.max(...monthScores));
  let run = 0;
  let bestRun = 0;
  for (const night of nights) {
    run = night.score >= 65 ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
  }
  const best = nights.reduce((top, night) => night.score > top.score ? night : top, nights[0]);
  output.greatCount.textContent = great;
  output.goodCount.textContent = good;
  output.bestMonth.textContent = shortMonths[bestMonthIndex];
  output.longestRun.textContent = `${bestRun}d`;
  output.heroScore.textContent = best.score;
}

function renderCalendar() {
  const threshold = Number(controls.threshold.value);
  const grouped = monthNames.map((_, month) => nights.filter((night) => night.date.getUTCMonth() === month));
  output.calendar.innerHTML = grouped.map((monthNights, month) => {
    const days = monthNights.map((night) => {
      const index = nights.indexOf(night);
      const visible = night.score >= threshold;
      const selected = index === selectedIndex;
      const title = `${formatDate(night.date)}: ${rating(night.score)} (${night.score})`;
      return `<button class="day ${visible ? "" : "hidden"} ${selected ? "selected" : ""}" data-index="${index}" style="background:${colorForScore(night.score)}" title="${title}" aria-label="${title}">${night.date.getUTCDate()}</button>`;
    }).join("");
    return `<section class="month" id="month-${month}"><div class="month-name">${shortMonths[month]}</div><div class="days">${days}</div></section>`;
  }).join("");
}

function renderNight(night) {
  if (!night) return;
  weatherPlanner.selectDate(night.date.toISOString().slice(0, 10));
  output.selectedNight.innerHTML = `
    <strong>${formatDate(night.date)}</strong>
    <div class="meter" aria-label="Stargazing score"><span style="width:${night.score}%"></span></div>
    <div class="metrics">
      <div><span>Rating</span><b>${rating(night.score)} ${night.score}/100</b></div>
      <div><span>Astronomical dark</span><b>${night.astroNight.toFixed(1)} h</b></div>
      <div><span>Moonlight impact</span><b>${Math.round(night.illumination * 100)}%</b></div>
      <div><span>Moon phase</span><b>${night.moonPhase}</b></div>
      <div><span>Moon-free dark</span><b>${night.darkMoonless.toFixed(1)} h</b></div>
    </div>`;
}

function renderBestList() {
  const today = new Date();
  const year = Number(controls.year.value);
  const startIndex = today.getUTCFullYear() === year ? Math.max(0, dayOfYear(today) - 1) : 0;
  const best = nights
    .slice(startIndex)
    .filter((night) => night.score >= Number(controls.threshold.value))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  output.bestList.innerHTML = best.length ? best.map((night) => {
    const index = nights.indexOf(night);
    return `<button class="best-item" data-index="${index}" type="button">
      <span class="best-score">${night.score}</span>
      <span><b>${formatDate(night.date)}</b><p>${rating(night.score)} - ${night.moonPhase}, ${night.darkMoonless.toFixed(1)} h dark</p></span>
    </button>`;
  }).join("") : `<p class="subtitle">No nights pass this threshold. Lower the filter or try a darker Bortle value.</p>`;
}

function setSelected(index) {
  selectedIndex = Number(index);
  render();
}

function bindEvents() {
  for (const key of ["lat", "lon", "year", "bortle", "threshold"]) {
    controls[key].addEventListener("input", () => {
      if (key === "lat" || key === "lon") {
        placeName = "";
        controls.preset.value = "custom";
      }
      buildYear();
    });
  }

  controls.preset.addEventListener("change", () => {
    if (controls.preset.value === "custom") return;
    const [lat, lon, ...nameParts] = controls.preset.value.split(",");
    controls.lat.value = lat;
    controls.lon.value = lon;
    placeName = nameParts.join(",").trim();
    buildYear();
  });

  output.calendar.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-index]");
    if (button) setSelected(button.dataset.index);
  });

  output.bestList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-index]");
    if (button) setSelected(button.dataset.index);
  });

  controls.monthFocus.addEventListener("change", () => {
    document.querySelector(`#month-${controls.monthFocus.value}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  controls.useLocation.addEventListener("click", () => {
    if (!navigator.geolocation) return;
    controls.useLocation.textContent = "Locating...";
    navigator.geolocation.getCurrentPosition((position) => {
      controls.lat.value = position.coords.latitude.toFixed(4);
      controls.lon.value = position.coords.longitude.toFixed(4);
      placeName = "Current location";
      controls.preset.value = "custom";
      controls.useLocation.textContent = "Use my location";
      buildYear();
    }, () => {
      controls.useLocation.textContent = "Use my location";
    });
  });

  controls.reset.addEventListener("click", () => {
    controls.lat.value = "28.6139";
    controls.lon.value = "77.2090";
    controls.year.value = "2026";
    controls.bortle.value = "5";
    controls.threshold.value = "65";
    controls.preset.value = "28.6139,77.2090,Delhi, India";
    placeName = "Delhi, India";
    selectedIndex = 0;
    buildYear();
  });
}

function startSky() {
  const canvas = document.querySelector("#sky");
  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let stars = [];

  function resize() {
    width = canvas.width = Math.floor(window.innerWidth * devicePixelRatio);
    height = canvas.height = Math.floor(window.innerHeight * devicePixelRatio);
    stars = Array.from({ length: Math.floor(window.innerWidth * window.innerHeight / 4200) }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: (Math.random() * 1.4 + 0.35) * devicePixelRatio,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.012 + 0.004
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    for (const star of stars) {
      star.phase += star.speed;
      const alpha = 0.32 + Math.sin(star.phase) * 0.22;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  draw();
}

controls.year.value = new Date().getFullYear();
selectedIndex = dayOfYear(new Date()) - 1;
bindEvents();
buildYear();
startSky();
