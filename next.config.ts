import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: ['clickclone.forbuy.shop'],
    }
  },
  serverExternalPackages: ['@anthropic-ai/claude-agent-sdk', '@anthropic-ai/claude-code'],
}

export default nextConfig
