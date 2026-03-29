import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '10mb' }
  },
  serverExternalPackages: ['@anthropic-ai/claude-agent-sdk', '@anthropic-ai/claude-code'],
}

export default nextConfig
