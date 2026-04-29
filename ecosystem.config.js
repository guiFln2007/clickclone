module.exports = {
  apps: [{
    name: 'ratoads',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
