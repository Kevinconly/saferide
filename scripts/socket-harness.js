#!/usr/bin/env node
const io = require('socket.io-client')
const argv = require('minimist')(process.argv.slice(2))
const URL = argv.url || 'http://localhost:3000'
const clients = parseInt(argv.clients || '10')
const rate = parseInt(argv.rate || '1') // messages per second per client

console.log(`Starting ${clients} socket.io clients to ${URL} at ${rate}/s each`)

for (let i=0;i<clients;i++) {
  const socket = io(URL, { transports: ['websocket'], reconnection: true })
  socket.on('connect', () => {
    console.log('client', i, 'connected', socket.id)
    setInterval(() => {
      socket.emit('driver:location', { lat: -1.95 + Math.random()*0.01, lng: 30.06 + Math.random()*0.01, timestamp: Date.now() })
    }, 1000 / rate)
  })
  socket.on('connect_error', (err) => console.error('connect_error', err.message))
}
