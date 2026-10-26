# Star Year Tracker

A standalone stargazing planner with a yearly calendar, location selection, approximate astronomical ratings, and live weather forecasts.

## Run

Open `index.html` in a modern browser. No build step or API key is required. Internet access is needed for weather. Browser location access requires permission and may require HTTPS or localhost.

## Features

- Typed city/postal-code search with matching places, city presets, custom coordinates, and browser geolocation.
- Year calendar with individual night details and best-night suggestions.
- Approximate darkness, moon phase, and light-pollution estimates.
- Current temperature, cloud cover, humidity, and wind from Open-Meteo.
- Hourly Wind, Wind Chill, Dew Point, Precip Prob, Cloud Cover, Visibility, Seeing, Transparency, Moonlight, Planets, and Kp for a selected night, from 18:00 to 06:00 in the location's timezone.
- Refresh, loading, and unavailable-weather states.

## Forecast limits

Weather covers the next seven days. A night requires a complete evening-to-morning forecast; dates outside that range show an unavailable message. Calendar ratings are approximate astronomical estimates and do not incorporate weather. Bortle level is manually selected, not measured automatically. The app is inspired by the stargazing planning concept and is not affiliated with Good To Stargaze.

Weather is model-based, not an on-site observation. Data comes from [Open-Meteo](https://open-meteo.com/) under its [attribution and service terms](https://open-meteo.com/en/terms). Review the provider's terms before commercial use.

## Files

- `index.html`: application interface.
- `styles.css`: desktop and mobile styling.
- `app.js`: astronomical estimates and calendar interactions.
- `weather.js`: weather requests and forecast display.

No secrets or credentials are needed for forecasts. Place searches are sent to Open-Meteo Geocoding; selected coordinates are sent to Open-Meteo and 7Timer for forecasts. Kp comes from NOAA SWPC. Moon illumination/altitude and planets above the horizon are calculated locally with the bundled MIT-licensed Astronomy Engine 2.1.19.

Seeing and transparency use 7Timer's nearest available 3-hour forecast sample. Kp has its own 3-hour forecast horizon and labels observed, estimated, and predicted values. Missing data is not extrapolated. Visibility is not astronomical transparency; moon illumination is not measured sky brightness; planets above the horizon are not guaranteed visible. Wind chill is only calculated at 10 C or colder and winds above 4.8 km/h.

Run `node observing.test.cjs` to check forecast matching, missing-data handling, wind chill, and astronomical calculations.

7Timer currently omits browser CORS headers. On static hosting, Seeing and Transparency table cells therefore remain unavailable; an expandable official forecast chart provides a fallback. Populating those table cells requires a trusted backend proxy. No third-party public proxy is used.

## Static hosting

The app can be hosted on an HTTPS static host, including GitHub Pages. Keep all HTML, CSS, and JavaScript files together. Hosting setup is separate from uploading the source repository.

## Community (setup pending)

Comments and Live Chat are implemented in `community.js`, with Google and email/password sign-in, verified-email posting, own-message deletion, and reporting. Shared messages require a configured Firebase project. Until configured, posting remains disabled. See [COMMUNITY-SETUP.md](COMMUNITY-SETUP.md) for activation, database rules, moderation, and verification steps.
