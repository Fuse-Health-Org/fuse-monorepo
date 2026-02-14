const fs = require('fs')
const path = require('path')

const ensureDevMiddlewareManifest = () => {
  if (process.env.NODE_ENV === 'production') return

  const manifestPath = path.join(__dirname, '.next', 'server', 'middleware-manifest.json')
  const manifestDir = path.dirname(manifestPath)

  try {
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true })
    }

    if (!fs.existsSync(manifestPath)) {
      const emptyManifest = {
        version: 2,
        sortedMiddlewareList: [],
        clientInfo: {},
        middleware: {},
        edgeFunctions: {},
        functions: {},
      }
      fs.writeFileSync(manifestPath, JSON.stringify(emptyManifest))
    }
  } catch (error) {
    console.warn('⚠️ Unable to ensure middleware manifest exists:', error)
  }
}

ensureDevMiddlewareManifest()

/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },
  webpack: (config, { dev, isServer }) => {
    if (dev && isServer) {
      ensureDevMiddlewareManifest()
    }

    return config
  },
}

module.exports = nextConfig