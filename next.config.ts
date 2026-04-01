import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '10mb' }
  },
  httpAgentOptions: {
    keepAlive: true,
  },
}

export default nextConfig
