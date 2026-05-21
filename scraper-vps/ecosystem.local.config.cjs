module.exports = {
  apps: [
    {
      name: 'ratoads-scraper-local',
      script: 'index.js',
      cwd: 'C:\\Users\\Pichau\\Trabalho\\ratoads\\app\\scraper-vps',
      env: {
        PORT: 3099,
        SCRAPER_SECRET: 'rato2026scraper',
        CHROMIUM_PATH: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        PROXY_URL: '',
      },
    },
    {
      name: 'cloudflared-tunnel',
      script: 'C:\\Users\\Pichau\\Trabalho\\ratoads\\app\\scraper-vps\\cloudflared.exe',
      args: 'tunnel run ratoads-scraper-win',
      autorestart: true,
    },
  ],
}
