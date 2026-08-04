import http from 'k6/http'
import { check, sleep } from 'k6'

export let options = {
  vus: __ENV.VUS ? parseInt(__ENV.VUS) : 10,
  duration: __ENV.DURATION || '30s',
}

export default function () {
  const url = __ENV.BASE_URL || 'http://localhost:3000'
  const payload = JSON.stringify({ pickup: { lat: -1.95, lng: 30.06 }, dropoff: { lat: -1.94, lng: 30.07 } })
  const params = { headers: { 'Content-Type': 'application/json' } }
  const res = http.post(url + '/rides', payload, params)
  check(res, { 'status is 201': (r) => r.status === 201 || r.status === 200 })
  sleep(1)
}
