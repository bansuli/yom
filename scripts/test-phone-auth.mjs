#!/usr/bin/env node
/**
 * Phone sign-in endpoint checks, no network and no Supabase project needed.
 *
 *   npm run test:phone
 *
 * Covers the guards that run before anything is sent: method, preflight, the
 * refusal when Supabase is unconfigured, and number/code validation. Sending a
 * real code needs an SMS provider in the Supabase dashboard — see docs/AUTH.md.
 */
import start from '../api/phone/start.js'
import verify from '../api/phone/verify.js'

function mockRes() {
  const r = { _status: 0, _body: null, _headers: {} }
  r.setHeader = (k, v) => { r._headers[k] = v }
  r.status = (s) => { r._status = s; return r }
  r.json = (b) => { r._body = b; return r }
  r.end = () => r
  return r
}
const call = async (h, req) => { const res = mockRes(); await h({ headers: {}, ...req }, res); return res }

let fail = 0
const check = (name, got, want) => {
  const ok = got === want
  if (!ok) fail++
  console.log(ok ? 'ok  ' : 'FAIL', name, '->', got, ok ? '' : `(want ${want})`)
}

// method guard
check('start GET rejected', (await call(start, { method: 'GET' }))._status, 405)
check('verify GET rejected', (await call(verify, { method: 'GET' }))._status, 405)

// preflight
check('start OPTIONS', (await call(start, { method: 'OPTIONS' }))._status, 204)

// Without SUPABASE_* set, both should refuse cleanly rather than throw.
const noEnv = await call(start, { method: 'POST', body: { phone: '+15551234567' } })
check('start without supabase env', noEnv._status, 503)
console.log('     message:', JSON.stringify(noEnv._body?.error))

// With env faked, validation should run before any network call.
process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_ANON_KEY = 'sb_publishable_test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test'

const bad = await call(start, { method: 'POST', body: { phone: '5551234567' } })
check('start rejects a number with no country code', bad._status, 400)
console.log('     message:', JSON.stringify(bad._body?.error))

const empty = await call(start, { method: 'POST', body: {} })
check('start rejects an empty number', empty._status, 400)

const noCode = await call(verify, { method: 'POST', body: { phone: '+15551234567' } })
check('verify rejects a missing code', noCode._status, 400)

const noPhone = await call(verify, { method: 'POST', body: { code: '123456' } })
check('verify rejects a missing number', noPhone._status, 400)

console.log(fail ? `\n${fail} failing` : '\nall pass')
process.exit(fail ? 1 : 0)
