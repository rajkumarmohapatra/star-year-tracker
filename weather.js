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
    const indexes = hourly.time.reduce((result, time, index) => {
      if (time >= start && time <= end) result.push(index);
      return result;
    }, []);
    if (indexes.length !== 13) {
      note.textContent = "A complete night forecast is not available for this date. Forecasts cover the next 7 days; later dates remain astronomical estimates.";
      return;
    }
    note.textContent = `18:00 to 06:00 in ${data.timezone}. Cloud cover is the percentage of sky covered by clouds.`;
    const wrapper = document.createElement("div");
    wrapper.className = "weather-table-wrap";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("aria-label", "Hourly night weather");
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th scope='col'>Time</th><th scope='col'>Cloud</th><th scope='col'>Rain chance</th><th scope='col'>Temp</th><th scope='col'>Wind</th></tr></thead>";
    const body = document.createElement("tbody");
    for (const i of indexes) {
      const row = document.createElement("tr");
      const values = [hourly.time[i].slice(11), display(hourly.cloud_cover[i], "%"), display(hourly.precipitation_probability[i], "%"), display(hourly.temperature_2m[i], " C"), display(hourly.wind_speed_10m[i], " km/h")];
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
  }

  async function fetchWeather() {
    const requestRevision = ++revision;
    controller?.abort();
    controller = new AbortController();
    const requestController = controller;
    const timeout = setTimeout(() => requestController.abort(), 15000);
    state = "loading";
    data = null;
    current.replaceChildren();
    status.textContent = "Loading weather for selected coordinates...";
    refresh.disabled = true;
    renderNight();
    try {
      const [latitude, longitude] = locationKey.split(",");
      const params = new URLSearchParams({latitude, longitude, timezone: "auto", forecast_days: "7", current: "temperature_2m,cloud_cover,wind_speed_10m,relative_humidity_2m", hourly: "temperature_2m,cloud_cover,precipitation_probability,wind_speed_10m"});
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {signal: requestController.signal});
      if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
      const result = await response.json();
      if (requestRevision !== revision) return;
      if (!result.current || !Array.isArray(result.hourly?.time) || !["temperature_2m", "cloud_cover", "precipitation_probability", "wind_speed_10m"].every(key => Array.isArray(result.hourly[key]) && result.hourly[key].length === result.hourly.time.length)) throw new Error("Incomplete weather response");
      data = result;
      state = "ready";
      status.textContent = `Conditions at ${data.current.time.replace("T", " ")} (${data.timezone}). Retrieved ${new Date().toLocaleTimeString()}.`;
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
