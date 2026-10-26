const weatherPlanner = (() => {
  const status = document.querySelector("#weatherStatus");
  const current = document.querySelector("#currentWeather");
  const detail = document.querySelector("#nightWeather");
  const refresh = document.querySelector("#refreshWeather");
  let locationKey = "";
  let selectedDate = "";
  let data = null;
  let controller;
  let timer;
  let revision = 0;
  let state = "loading";
  let astro = [];
  let kp = [];
  let astronomyStatus = "Loading";
  let kpStatus = "Loading";
  const localStamp = (seconds) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {timeZone: data.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).formatToParts(new Date(seconds * 1000)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };

  const display = (value, unit) => Number.isFinite(value) ? `${Math.round(value)}${unit}` : "Unavailable";
  function metric(label, value) {
    const cell = document.createElement("div");
    const name = document.createElement("span");
    const number = document.createElement("strong");
    name.textContent = label;
    number.textContent = value;
    cell.append(name, number);
    return cell;
  }

  function renderNight() {
    detail.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = `${selectedDate} night forecast`;
    detail.append(heading);
    const note = document.createElement("p");
    detail.append(note);
    if (!data) {
      note.textContent = state === "loading" ? "Loading forecast for this location..." : "Weather unavailable. Refresh to retry.";
      return;
    }
    const nextDate = new Date(`${selectedDate}T00:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const start = `${selectedDate}T18:00`;
    const end = `${nextDate.toISOString().slice(0, 10)}T06:00`;
    const hourly = data.hourly;
    const indexes = hourly.time.reduce((result, seconds, index) => {
      const time = localStamp(seconds);
      if (time >= start && time <= end) result.push(index);
      return result;
    }, []);
    if (!indexes.length || localStamp(hourly.time[indexes[0]]) > start || localStamp(hourly.time[indexes[indexes.length - 1]]) < end) {
      note.textContent = "A complete night forecast is not available for this date. Forecasts cover the next 7 days; later dates remain astronomical estimates.";
      return;
    }
    note.textContent = `18:00 to 06:00 in ${data.timezone}. 7Timer: ${astronomyStatus}. NOAA Kp: ${kpStatus}. Missing dates are not extrapolated.`;
    const wrapper = document.createElement("div");
    wrapper.className = "weather-table-wrap";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("aria-label", "Hourly night weather");
    const table = document.createElement("table");
    table.className = "observing-table";
    table.innerHTML = "<thead><tr><th scope='col'>Time</th><th scope='col'>Wind<br>km/h</th><th scope='col'>Wind Chill<br>C</th><th scope='col'>Dew Point<br>C</th><th scope='col'>Precip Prob<br>%</th><th scope='col'>Cloud Cover<br>%</th><th scope='col'>Visibility<br>km</th><th scope='col'>Seeing<br>arcsec</th><th scope='col'>Transparency<br>mag/airmass</th><th scope='col'>Moonlight</th><th scope='col'>Planets</th><th scope='col'>Kp<br>0-9</th></tr></thead>";
    const body = document.createElement("tbody");
    for (const i of indexes) {
      const row = document.createElement("tr");
      const time = hourly.time[i] * 1000;
      const astroHour = observing.astroAt(astro, time);
      const kpHour = observing.kpAt(kp, time);
      const [lat, lon] = locationKey.split(",").map(Number);
      const sky = observing.sky(time, lat, lon);
      const values = [localStamp(hourly.time[i]).slice(11), display(hourly.wind_speed_10m[i], ""), observing.windChill(hourly.temperature_2m[i], hourly.wind_speed_10m[i]), display(hourly.dew_point_2m?.[i], ""), display(hourly.precipitation_probability[i], ""), display(hourly.cloud_cover[i], ""), Number.isFinite(hourly.visibility?.[i]) ? (hourly.visibility[i] / 1000).toFixed(1) : "Unavailable", observing.category(astroHour?.seeing, "seeing"), observing.category(astroHour?.transparency, "transparency"), sky.moon, sky.planets, kpHour ? `${kpHour.value.toFixed(2)} (${kpHour.kind})` : "Unavailable"];
      for (const value of values) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      body.append(row);
    }
    table.append(body);
    wrapper.append(table);
    detail.append(wrapper);
    const guide = document.createElement("details");
    guide.className = "parameter-guide";
    guide.innerHTML = "<summary>Sources &amp; parameter definitions</summary><dl><dt>Wind chill</dt><dd>Calculated from temperature and wind, only at 10 C or colder with wind above 4.8 km/h.</dd><dt>Seeing</dt><dd>7Timer modeled star-image blur in arcseconds. Lower is better; nearest 3-hour forecast sample within its available horizon.</dd><dt>Transparency</dt><dd>7Timer atmospheric extinction in magnitudes per airmass. Lower is clearer, not a percentage.</dd><dt>Visibility</dt><dd>Horizontal weather visibility; this is different from astronomical transparency.</dd><dt>Moonlight</dt><dd>Calculated illuminated fraction and altitude, not measured sky brightness.</dd><dt>Planets</dt><dd>Mercury through Saturn above the horizon, with altitude. Daylight, clouds, and terrain may still prevent viewing.</dd><dt>Kp</dt><dd>NOAA global geomagnetic index, not a local stargazing score. Observed, estimated, and predicted values are labeled; each covers a 3-hour interval.</dd></dl>";
    detail.append(guide);
    if (!astro.length && astronomyStatus === "Unavailable") {
      const forecast = document.createElement("details");
      forecast.className = "parameter-guide";
      const summary = document.createElement("summary");
      summary.textContent = "Seeing & transparency: official forecast chart";
      const explanation = document.createElement("p");
      explanation.textContent = "7Timer does not allow direct browser data access. Its chart shows the latest available forecast, not necessarily the selected calendar date. Check the chart's dates and labeled timezone.";
      const [lat, lon] = locationKey.split(",");
      const url = `https://www.7timer.info/bin/astro.php?${new URLSearchParams({lat,lon,ac:"0",lang:"en",unit:"metric",output:"internal",tzshift:"0"})}`;
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Open the full 7Timer forecast chart";
      const chart = document.createElement("img");
      chart.src = url;
      chart.loading = "lazy";
      chart.alt = "7Timer forecast chart including seeing and transparency";
      chart.style.cssText = "display:block;max-width:100%;height:auto;margin-top:12px";
      forecast.append(summary, explanation, link, chart);
      detail.append(forecast);
    }
  }

  async function fetchSupplement(url, type, requestRevision) {
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(15000)});
      if (!response.ok) throw Error("Source unavailable");
      const result = await response.json();
      if (requestRevision !== revision) return;
      if (type === "astro") {
        astro = observing.astroRows(result);
        astronomyStatus = astro.length ? `forecast issued ${result.init.slice(0,4)}-${result.init.slice(4,6)}-${result.init.slice(6,8)} ${result.init.slice(8)}:00 UTC` : "Unavailable";
      } else { kp = observing.kpRows(result); kpStatus = kp.length ? "3-hour data loaded" : "Unavailable"; }
    } catch {
      if (requestRevision !== revision) return;
      if (type === "astro") astronomyStatus = "Unavailable";
      else kpStatus = "Unavailable";
    }
    if (requestRevision === revision) renderNight();
  }

  async function fetchWeather() {
    const requestRevision = ++revision;
    controller?.abort();
    controller = new AbortController();
    const requestController = controller;
    const timeout = setTimeout(() => requestController.abort(), 15000);
    state = "loading";
    data = null;
    astro = [];
    kp = [];
    astronomyStatus = "Loading";
    kpStatus = "Loading";
    current.replaceChildren();
    status.textContent = "Loading weather for selected coordinates...";
    refresh.disabled = true;
    renderNight();
    try {
      const [latitude, longitude] = locationKey.split(",");
      fetchSupplement(`https://www.7timer.info/bin/astro.php?${new URLSearchParams({lat:latitude,lon:longitude,ac:"0",unit:"metric",output:"json",tzshift:"0"})}`, "astro", requestRevision);
      fetchSupplement("https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json", "kp", requestRevision);
      const params = new URLSearchParams({latitude, longitude, timezone: "auto", timeformat: "unixtime", forecast_days: "7", current: "temperature_2m,cloud_cover,wind_speed_10m,relative_humidity_2m", hourly: "temperature_2m,dew_point_2m,visibility,cloud_cover,precipitation_probability,wind_speed_10m"});
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {signal: requestController.signal});
      if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
      const result = await response.json();
      if (requestRevision !== revision) return;
      if (!result.current || !Array.isArray(result.hourly?.time) || !["temperature_2m", "cloud_cover", "precipitation_probability", "wind_speed_10m"].every(key => Array.isArray(result.hourly[key]) && result.hourly[key].length === result.hourly.time.length)) throw new Error("Incomplete weather response");
      data = result;
      state = "ready";
      status.textContent = `Conditions at ${localStamp(data.current.time).replace("T", " ")} (${data.timezone}). Retrieved ${new Date().toLocaleTimeString()}.`;
      current.append(metric("Temperature", display(data.current.temperature_2m, " C")), metric("Cloud cover", display(data.current.cloud_cover, "%")), metric("Wind", display(data.current.wind_speed_10m, " km/h")), metric("Humidity", display(data.current.relative_humidity_2m, "%")));
      renderNight();
    } catch (error) {
      if (requestRevision !== revision) return;
      state = "error";
      status.textContent = "Could not load weather. Check your connection and refresh to retry.";
      renderNight();
    } finally {
      clearTimeout(timeout);
      if (requestRevision === revision) refresh.disabled = false;
    }
  }

  refresh.addEventListener("click", () => { clearTimeout(timer); fetchWeather(); });
  return {
    setLocation(lat, lon) {
      const key = `${lat},${lon}`;
      if (key === locationKey) return;
      locationKey = key;
      ++revision;
      controller?.abort();
      clearTimeout(timer);
      data = null;
      state = "loading";
      current.replaceChildren();
      status.textContent = "Loading weather for selected coordinates...";
      renderNight();
      timer = setTimeout(fetchWeather, 450);
    },
    selectDate(date) { selectedDate = date; renderNight(); }
  };
})();
