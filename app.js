/* ================================================
   app.js — Skyvane Weather App
   Sections:
     1. State          — single source of truth
     2. DOM refs       — all getElementById calls in one place
     3. Theme          — toggle + localStorage persistence
     4. UI helpers     — show/hide sections
     5. API            — geocoding + forecast fetch (M2)
     6. Render         — populate DOM with data (M3, M4)
     7. Events         — search, clear, keyboard
     8. Init           — runs on page load
   ================================================ */


/* ================================================
   1. STATE
   One object holds everything the app knows.
   Never read data from the DOM — read it from here.
   ================================================ */
   const AppState = {
    theme:   'dark',   // 'dark' | 'light'
    city:    null,     // last searched city name string
    weather: null,     // raw API response object
  };
  
  
  /* ================================================
     2. DOM REFS
     Grab every element once, use the variable everywhere.
     If an ID ever changes in HTML, fix it only here.
     ================================================ */
  const DOM = {
    html:            document.documentElement,
    themeToggle:     document.getElementById('themeToggle'),
  
    searchInput:     document.getElementById('searchInput'),
    searchBtn:       document.getElementById('searchBtn'),
  
    errorBanner:     document.getElementById('errorBanner'),
    errorMsg:        document.getElementById('errorMsg'),
  
    loadingOverlay:  document.getElementById('loadingOverlay'),
    emptyState:      document.getElementById('emptyState'),
  
    weatherCard:     document.getElementById('weatherCard'),
    cityName:        document.getElementById('cityName'),
    cityMeta:        document.getElementById('cityMeta'),
    clearCityBtn:    document.getElementById('clearCityBtn'),
    conditionIcon:   document.getElementById('conditionIcon'),
    conditionLabel:  document.getElementById('conditionLabel'),
    tempDisplay:     document.getElementById('tempDisplay'),
    humidityVal:     document.getElementById('humidityVal'),
    windVal:         document.getElementById('windVal'),
    pressureVal:     document.getElementById('pressureVal'),
  
    forecastSection: document.getElementById('forecastSection'),
    forecastStrip:   document.getElementById('forecastStrip'),
  
    insightsSection: document.getElementById('insightsSection'),
    insightsPanel:   document.getElementById('insightsPanel'),
  };
  
  
  /* ================================================
     3. THEME
     Reads from localStorage on load.
     Writes back on every toggle.
     ================================================ */
  const THEME_KEY = 'skyvane_theme';
  
  function applyTheme(theme) {
    AppState.theme = theme;
    DOM.html.setAttribute('data-theme', theme);
    DOM.themeToggle.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    );
    localStorage.setItem(THEME_KEY, theme);
  }
  
  function toggleTheme() {
    applyTheme(AppState.theme === 'dark' ? 'light' : 'dark');
  }
  
  DOM.themeToggle.addEventListener('click', toggleTheme);
  
  
  /* ================================================
     4. UI HELPERS
     Four states the app can be in:
       empty   — no city searched yet
       loading — API call in flight
       error   — API returned nothing / network fail
       weather — data ready, show everything
     ================================================ */
  function showEmpty() {
    DOM.emptyState.style.display      = 'flex';
    DOM.loadingOverlay.style.display  = 'none';
    DOM.weatherCard.style.display     = 'none';
    DOM.forecastSection.style.display = 'none';
    DOM.insightsSection.style.display = 'none';
  }
  
  function showLoading() {
    DOM.loadingOverlay.style.display  = 'flex';
    DOM.emptyState.style.display      = 'none';
    DOM.weatherCard.style.display     = 'none';
    DOM.errorBanner.style.display     = 'none';
    DOM.searchBtn.disabled            = true;
  }
  
  function showError(message) {
    DOM.loadingOverlay.style.display  = 'none';
    DOM.emptyState.style.display      = 'flex';
    DOM.errorBanner.style.display     = 'flex';
    DOM.errorMsg.textContent          = message;
    DOM.searchBtn.disabled            = false;
  }
  
  function showWeather() {
    DOM.emptyState.style.display      = 'none';
    DOM.loadingOverlay.style.display  = 'none';
    DOM.errorBanner.style.display     = 'none';
    DOM.weatherCard.style.display     = 'block';
    DOM.forecastSection.style.display = 'block';
    DOM.insightsSection.style.display = 'block';
    DOM.searchBtn.disabled            = false;
  }
  
  
  /* ================================================
     5. API
     Two-step process:
       Step 1 — Geocoding API  : city name → lat, lon, country
       Step 2 — Forecast API   : lat/lon   → full weather data
  
     fetchWeather(cityQuery) is the single public function.
     Everything else here is a private helper.
     ================================================ */
  
  const GEO_URL      = 'https://geocoding-api.open-meteo.com/v1/search';
  const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
  
  // What we ask the Forecast API to return
  // (keeping this in one place makes M3/M4 additions easy)
  const FORECAST_PARAMS = [
    'temperature_2m',
    'relative_humidity_2m',
    'weather_code',
    'wind_speed_10m',
    'surface_pressure',
  ].join(',');
  
  const HOURLY_PARAMS = [
    'temperature_2m',
    'weather_code',
  ].join(',');
  
  const DAILY_PARAMS = [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
  ].join(',');
  
  // ---- Step 1: city name → coordinates ----
  async function geocodeCity(cityQuery) {
    const url = `${GEO_URL}?name=${encodeURIComponent(cityQuery)}&count=1&language=en&format=json`;
    const res  = await fetch(url);
  
    if (!res.ok) throw new Error('Geocoding network error');
  
    const data = await res.json();
  
    // API returns empty results array when city isn't found
    if (!data.results || data.results.length === 0) {
      throw new Error(`No city found for "${cityQuery}". Check the spelling and try again.`);
    }
  
    const { name, country, latitude, longitude } = data.results[0];
    return { name, country, lat: latitude, lon: longitude };
  }
  
  // ---- Step 2: coordinates → weather data ----
  async function fetchForecastData(lat, lon) {
    const url = new URL(FORECAST_URL);
    url.searchParams.set('latitude',           lat);
    url.searchParams.set('longitude',          lon);
    url.searchParams.set('current',            FORECAST_PARAMS);
    url.searchParams.set('hourly',             HOURLY_PARAMS);
    url.searchParams.set('daily',              DAILY_PARAMS);
    url.searchParams.set('timezone',           'auto');
    url.searchParams.set('forecast_days',      '5');
  
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather data network error');
  
    return res.json();
  }
  
  // ---- Main entry point called by the search handler ----
  async function fetchWeather(cityQuery) {
    showLoading();
  
    try {
      // Step 1 — resolve city to coordinates
      const { name, country, lat, lon } = await geocodeCity(cityQuery);
  
      // Step 2 — fetch weather for those coordinates
      const weatherData = await fetchForecastData(lat, lon);
  
      // Save everything to AppState
      AppState.city    = { name, country, lat, lon };
      AppState.weather = weatherData;
  
      console.log('[M2] City resolved:', AppState.city);
      console.log('[M2] Weather data:', AppState.weather);
  
      // M3 will call renderWeatherCard() here
      // M4 will call renderForecastStrip() and renderInsightsPanel() here
      showWeather();
  
    } catch (err) {
      console.error('[M2] fetchWeather error:', err.message);
      showError(err.message);
    }
  }
  
  
  /* ================================================
     6. RENDER  (filled in M3 and M4)
     Each render function takes data from AppState
     and updates exactly its own DOM section.
     ================================================ */
  
  // M3 — fills the current weather card
  function renderWeatherCard() {
    // Implementation in M3
  }
  
  // M4 — fills the 5-day forecast strip
  function renderForecastStrip() {
    // Implementation in M4
  }
  
  // M4 — fills the hourly insights panel
  function renderInsightsPanel() {
    // Implementation in M4
  }
  
  
  /* ================================================
     7. EVENTS
     ================================================ */
  
  // Search triggered by button click or Enter key
  function handleSearch() {
    const query = DOM.searchInput.value.trim();
    if (!query) return;
    fetchWeather(query);
  }
  
  DOM.searchBtn.addEventListener('click', handleSearch);
  
  DOM.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
    // Clear error banner as user starts retyping
    if (DOM.errorBanner.style.display === 'flex') {
      DOM.errorBanner.style.display = 'none';
    }
  });
  
  // Clear button — resets to empty state (M5 adds localStorage clear)
  DOM.clearCityBtn.addEventListener('click', () => {
    AppState.city    = null;
    AppState.weather = null;
    DOM.searchInput.value = '';
    showEmpty();
    // M5: localStorage.removeItem(CITY_KEY);
  });
  
  
  /* ================================================
     8. INIT
     Runs once when the page loads.
     ================================================ */
  function init() {
    // Restore saved theme (default: dark)
    const savedTheme = localStorage.getItem(THEME_KEY);
    applyTheme(savedTheme === 'light' ? 'light' : 'dark');
  
    // M5 will add: auto-load last searched city from localStorage
  
    showEmpty();
  }
  
  init();