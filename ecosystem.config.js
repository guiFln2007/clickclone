module.exports = {
  apps: [{
    name: 'clickclone',
    script: 'server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
