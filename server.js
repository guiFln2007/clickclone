const path = require('path')

process.env.NODE_ENV = 'production'

const hostname = '0.0.0.0'
const port = process.env.PORT || 3000

process.env.HOSTNAME = hostname
process.env.PORT = String(port)

// Importa o servidor standalone gerado pelo Next.js build
require('./.next/standalone/server.js')
