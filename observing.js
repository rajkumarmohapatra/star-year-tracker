/* Shared, pure calculations used by the hourly observing table and tests. */
const observing = (() => {
  const seeing = ["<0.5", "0.5-0.75", "0.75-1", "1-1.25", "1.25-1.5", "1.5-2", "2-2.5", ">2.5"];
  const transparency = ["<0.3", "0.3-0.4", "0.4-0.5", "0.5-0.6", "0.6-0.7", "0.7-0.85", "0.85-1", ">1"];
  function windChill(temp, wind) {
    if (!Number.isFinite(temp) || !Number.isFinite(wind)) return "Unavailable";
    if (temp > 10 || wind <= 4.8) return "Not applicable";
    return `${(13.12 + 0.6215 * temp - 11.37 * wind ** 0.16 + 0.3965 * temp * wind ** 0.16).toFixed(1)} C`;
  }
  function astroRows(data) {
    if (!/^\d{10}$/.test(data?.init) || !Array.isArray(data.dataseries)) return [];
    const s = data.init;
    const init = Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10));
    return data.dataseries.filter(row => Number.isFinite(row.timepoint)).map(row => ({...row, time: init + row.timepoint * 3600000}));
  }
  function astroAt(rows, time) {
    // Forecast samples are every 3 hours; never extrapolate outside their horizon.
    if (!rows.length || time < rows[0].time || time > rows[rows.length - 1].time) return null;
    return rows.reduce((best, row) => Math.abs(row.time - time) < Math.abs(best.time - time) ? row : best);
  }
  function kpRows(data) {
    if (!Array.isArray(data)) return [];
    const entries = Array.isArray(data[0]) ? data.slice(1).map(row => Object.fromEntries(data[0].map((key, i) => [key, row[i]]))) : data;
    return entries.map(row => ({time: Date.parse(`${String(row.time_tag).replace(" ", "T").replace(/Z$/, "")}Z`), value: row.kp == null || row.kp === "" ? NaN : Number(row.kp), kind: row.observed || "forecast"})).filter(row => Number.isFinite(row.time) && row.value >= 0 && row.value <= 9);
  }
  function kpAt(rows, time) { return rows.find(row => time >= row.time && time < row.time + 10800000); }
  function category(value, type) { return Number.isInteger(value) && value >= 1 && value <= 8 ? (type === "seeing" ? seeing : transparency)[value - 1] : "Unavailable"; }
  function sky(time, lat, lon) {
    if (typeof Astronomy === "undefined") return {moon: "Unavailable", planets: "Unavailable"};
    const date = new Date(time);
    const observer = new Astronomy.Observer(lat, lon, 0);
    function altitude(body) {
      const eq = Astronomy.Equator(body, date, observer, true, true);
      return Astronomy.Horizon(date, observer, eq.ra, eq.dec, "normal").altitude;
    }
    const illumination = Math.round(Astronomy.Illumination("Moon", date).phase_fraction * 100);
    const moonAltitude = altitude("Moon");
    const planets = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"].map(name => ({name, altitude: altitude(name)})).filter(p => p.altitude > 0).map(p => `${p.name} ${Math.round(p.altitude)} deg`);
    return {moon: `${illumination}% lit / ${moonAltitude > 0 ? `${Math.round(moonAltitude)} deg up` : "below horizon"}`, planets: planets.join(", ") || "None above horizon"};
  }
  return {windChill, astroRows, astroAt, kpRows, kpAt, category, sky};
})();
if (typeof module !== "undefined") module.exports = observing;
