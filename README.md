# Star Year Tracker

A standalone stargazing planner with a yearly calendar, location selection, approximate astronomical ratings, and live weather forecasts.

## Run

Open `index.html` in a modern browser. No build step or API key is required. Internet access is needed for weather. Browser location access requires permission and may require HTTPS or localhost.

## Features

- City presets, custom coordinates, and browser geolocation.
- Year calendar with individual night details and best-night suggestions.
- Approximate darkness, moon phase, and light-pollution estimates.
- Current temperature, cloud cover, humidity, and wind from Open-Meteo.
- Hourly cloud cover, rain probability, temperature, and wind for a selected night, from 18:00 to 06:00 in the location's timezone.
- Refresh, loading, and unavailable-weather states.

## Forecast limits

Weather covers the next seven days. A night requires a complete evening-to-morning forecast; dates outside that range show an unavailable message. Calendar ratings are approximate astronomical estimates and do not incorporate weather. Bortle level is manually selected, not measured automatically. The app is inspired by the stargazing planning concept and is not affiliated with Good To Stargaze.

Weather is model-based, not an on-site observation. Data comes from [Open-Meteo](https://open-meteo.com/) under its [attribution and service terms](https://open-meteo.com/en/terms). Review the provider's terms before commercial use.

## Files

- `index.html`: application interface.
- `styles.css`: desktop and mobile styling.
- `app.js`: astronomical estimates and calendar interactions.
- `weather.js`: weather requests and forecast display.

No secrets or credentials are needed. Selected coordinates are sent to Open-Meteo to retrieve forecasts.

## Static hosting

The app can be hosted on an HTTPS static host, including GitHub Pages. Keep the four application files together. Hosting setup is separate from uploading the source repository.
