module.exports = {
  apps: [{
    name: 'ratoads',
    script: 'server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
