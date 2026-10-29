// OUTSNIPE: the page. Polls the relay's launches; creators schedule a pre-signed pump.fun launch on their durable
// nonce; buyers take one of four seats with a buy signed now on theirs. At launch time the relay sends the launch and
// the seats as one Jito bundle, so they land in the coin's first block.
import { seatTx, tokensFor, TIPS, LAUNCH_TIP } from './seat.js'
const $ = (id) => document.getElementById(id)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const Q = new URLSearchParams(location.search)
const RELAY = Q.get('relay') || 'https://outsnipe-relay.vetted-relay.workers.dev'
const get = (p, q = '') => fetch(Q.get('relay') ? `${RELAY}/v1/${p}?${q}` : `/api/r?path=${p}&${q}`, { cache: 'no-store' }).then((r) => r.json())
const post = (p, b) => fetch(`${RELAY}/v1/${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json())
const rpc = async (method, params) => { const r = await post('rpc', { method, params }); if (r.error) throw new Error(r.error); return r.result }
const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? Math.floor(s) + 's' : s < 3600 ? Math.floor(s / 60) + 'm' : Math.floor(s / 3600) + 'h' }
let toastT; const toast = (m, bad) => { const t = $('toast'); t.textContent = m; t.className = 'toast on' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(() => (t.className = 'toast'), 5200) }
const hhmm = (ms) => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') }
const left = (ms) => { const s = Math.max(0, Math.floor((ms - Date.now()) / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m` : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }
const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n))
// a wallet's colour: two greens from its address
function av(w) { let h = 0; for (const c of String(w)) h = (h * 31 + c.charCodeAt(0)) >>> 0; const a = 120 + (h % 60), b = 140 + ((h >> 8) % 70); return `background:linear-gradient(135deg,hsl(${a} 70% 52%),hsl(${b} 60% 22%))` }

// ---------------------------------------------------------------- the board
let st = null, sol = 0
const mcf = (mc) => { const v = sol ? mc * sol : mc; return (sol ? '$' : '') + fmt(v) + (sol ? '' : ' SOL') }
async function pull() {
  try { st = await get('launches'); sol = st.sol || sol; paint() } catch { $('liveDot').className = 'off'; $('liveTxt').textContent = 'reconnecting' }
}
function seatsHtml(L) {
  const out = []
  for (let i = 0; i < 4; i++) {
    const s = L.seats[i]
    out.push(s ? `<div class="st"><span class="av" style="${av(s.wallet)}"></span><b>${s.sol} SOL</b><span>${esc(s.wallet)}</span></div>` : `<div class="st open"><span class="av"></span><b>open</b><span>seat ${i + 1}</span></div>`)
  }
  return out.join('')
}
function paint() {
  $('liveDot').className = st.live ? '' : 'off'; $('liveTxt').textContent = st.live ? 'watching pump.fun' : 'reconnecting'
  if (st.hour) { $('sN').textContent = fmt(st.hour.launches); $('sS').textContent = fmt(st.hour.sniped); $('sV').textContent = fmt(st.hour.snipeSol) }
  const B = st.boarding
  $('boardMeta').textContent = B.length ? `${B.length} boarding · ${B.reduce((a, L) => a + 4 - L.seats.length, 0)} open seats` : ''
  $('board').innerHTML = B.length ? B.map((L) => `<div class="card" data-id="${esc(L.id)}">
      <div class="hd">${L.image ? `<img src="${esc(L.image)}" alt="" loading="lazy">` : '<span class="ph"></span>'}<div><div class="tk">$${esc(L.symbol)}</div><div class="nm">${esc(L.name)}</div></div>
      <div class="when"><b class="cd" data-at="${L.at}">${left(L.at)}</b><span>${L.full ? 'or when full' : 'launches ' + hhmm(L.at)}</span></div></div>
      ${L.desc ? `<div class="ds">${esc(L.desc)}</div>` : ''}
      <div class="seats">${seatsHtml(L)}</div>
      <div class="ft"><span>dev ${esc(L.dev)}${L.buy ? ` · ${L.buy} SOL` : ''}</span><span>ahead of next seat: ${L.ahead.toFixed(2)} SOL</span></div>
      ${L.seats.length < 4 ? `<button class="go seatb" data-id="${esc(L.id)}">Take seat ${L.seats.length + 1} of 4</button>` : '<button class="go" disabled>Seats full · launching</button>'}
    </div>`).join('')
    : '<div class="empty">Nothing boarding right now. Schedule a launch and its four seats open here.</div>'
  $('board').querySelectorAll('.seatb').forEach((b) => (b.onclick = () => openSeat(b.dataset.id)))
  $('landList').innerHTML = st.launched.length ? st.launched.map((r) => {
    const tags = r.failed ? `<i class="drop">${esc(r.failed)}</i>` : [`<i>launch · block 0</i>`, ...(r.seats || []).map((s) => s.dropped ? `<i class="drop">${esc(s.wallet)} dropped</i>` : s.block0 ? `<i>${esc(s.wallet)} · block 0</i>` : `<i class="late">${esc(s.wallet)} · +${s.slot && r.slot ? s.slot - r.slot : '?'} slot</i>`)].join('')
    return `<a class="rw" href="${r.failed ? '#' : 'https://pump.fun/coin/' + esc(r.mint)}" target="_blank" rel="noopener"><span class="t">${hhmm(r.at)}</span>${r.image ? `<img src="${esc(r.image)}" alt="">` : '<span class="ph"></span>'}
      <div><span class="tk">$${esc(r.symbol)}</span> <span class="nm">${esc(r.name)}</span><div class="ds">${r.failed ? 'did not launch' : r.bundled ? 'one bundle: launch + ' + (r.seats || []).filter((s) => s.block0).length + ' seats' : 'launched alone, seats right after'}</div></div>
      <div class="blk blkc">${tags}</div><span class="mono up">${r.live ? mcf(r.live.mc) : '—'}</span><span class="mono dim hm">${r.live ? (r.live.done ? 'graduated' : 'curve ' + r.live.prog + '%') : ''}</span></a>`
  }).join('') : '<div class="empty">No launches yet. The first one lands here with every seat\'s block.</div>'
  heroSeats()
}
setInterval(() => { document.querySelectorAll('.cd').forEach((e) => { const at = +e.dataset.at; e.textContent = left(at); e.classList.toggle('soon', at - Date.now() < 60_000) }) }, 500)
pull(); setInterval(pull, 4000)

// ---------------------------------------------------------------- wallet, nonce accounts
const W3 = () => import('https://esm.sh/@solana/web3.js@1.98.0?bundle')
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s) }
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
let wallet = null
async function connectWallet() {
  if (wallet) return wallet
  const p = window.phantom?.solana || window.solflare || window.backpack
  if (!p) throw new Error('no Solana wallet found. Install Phantom, Solflare or Backpack.')
  const r = await p.connect(); wallet = { p, pk: (r?.publicKey || p.publicKey).toString() }
  return wallet
}
async function confirm(sig) {
  for (let i = 0; i < 40; i++) {
    const r = await rpc('getSignatureStatuses', [[sig]]); const s = r?.value?.[0]
    if (s?.err) throw new Error('the transaction failed on-chain')
    if (s && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized')) return
    await new Promise((ok) => setTimeout(ok, 1500))
  }
  throw new Error('not confirmed in time, try again')
}
// a nonce account at an address made from the wallet and a seed: created once, reused every time
async function ensureNonce(W, seed, note) {
  const owner = new W.PublicKey(wallet.pk)
  const noncePk = await W.PublicKey.createWithSeed(owner, seed, W.SystemProgram.programId)
  let acc = await rpc('getAccountInfo', [noncePk.toBase58(), { encoding: 'base64', commitment: 'confirmed' }])
  if (!acc?.value) {
    note('sign once to create your nonce account (about 0.0015 SOL of rent, yours to reclaim)…')
    const rent = await rpc('getMinimumBalanceForRentExemption', [W.NONCE_ACCOUNT_LENGTH])
    const bh = (await rpc('getLatestBlockhash', [{ commitment: 'confirmed' }])).value.blockhash
    const t = new W.Transaction({ feePayer: owner, recentBlockhash: bh }).add(...W.SystemProgram.createNonceAccount({ fromPubkey: owner, noncePubkey: noncePk, basePubkey: owner, seed, authorizedPubkey: owner, lamports: rent }).instructions)
    const signed = await wallet.p.signTransaction(t)
    const s = await post('send', { tx: b64(signed.serialize()) }); if (s.error) throw new Error(s.error)
    note('creating the nonce account…'); await confirm(s.signature)
    acc = await rpc('getAccountInfo', [noncePk.toBase58(), { encoding: 'base64', commitment: 'confirmed' }])
  }
  return { noncePk, nonce: W.NonceAccount.fromAccountData(unb64(acc.value.data[0])).nonce }
}
const mark = (id, s, t) => { const i = $(id); i.className = s; i.textContent = s === 'ok' ? '✓' : s === 'no' ? '✕' : '○'; if (t) $(id + 't').textContent = t }
document.querySelectorAll('[data-x]').forEach((b) => (b.onclick = () => b.closest('.sheet').classList.remove('on')))
addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.sheet').forEach((s) => s.classList.remove('on')) })

// ---------------------------------------------------------------- taking a seat
let seatId = null
function openSeat(id) {
  const L = st?.boarding.find((x) => x.id === id); if (!L) return
  seatId = id
  $('sTitle').textContent = `Seat ${L.seats.length + 1} of 4`
  $('sCoin').innerHTML = `${L.image ? `<img src="${esc(L.image)}" alt="">` : ''}<div><b>$${esc(L.symbol)}</b><div class="dim small">${esc(L.name)} · launches ${L.full ? 'at ' + hhmm(L.at) + ' or when full' : 'at ' + hhmm(L.at)}</div></div>`
  quote(); $('sheetS').classList.add('on')
}
function quote() {
  const L = st?.boarding.find((x) => x.id === seatId); if (!L) return
  const amt = Math.min(1, Math.max(0.05, +$('sAmt').value || 0))
  const tok = Number(tokensFor(amt * 1e9, L.ahead * 1e9)) / 1e6, pct = (tok / 1e9) * 100
  $('sQuote').innerHTML = `${L.ahead.toFixed(2)} SOL goes in ahead of you (the dev and earlier seats). <b>${amt} SOL</b> gets about <b>${fmt(tok)}</b> $${esc(L.symbol)} (${pct.toFixed(2)}% of supply), at the coin's first-block price. You accept no less than 85% of that.`
}
$('sAmt').oninput = quote
$('sAmts').querySelectorAll('button').forEach((b) => (b.onclick = () => { $('sAmt').value = b.dataset.v; quote() }))
$('sGo').onclick = async () => {
  const b = $('sGo'), note = (t) => ($('sNote').textContent = t)
  if (!wallet) { try { await connectWallet(); mark('qW', 'ok', `wallet ${wallet.pk.slice(0, 4)}…${wallet.pk.slice(-4)}`); b.textContent = 'Sign my seat' } catch (e) { toast(String(e.message || e), true) } return }
  const L = st?.boarding.find((x) => x.id === seatId); if (!L) return toast('that launch is gone', true)
  const amt = +$('sAmt').value
  if (!(amt >= 0.05 && amt <= 1)) return toast('a seat is 0.05 to 1 SOL', true)
  b.disabled = true
  try {
    const W = await W3()
    const { noncePk, nonce } = await ensureNonce(W, 'outsnipe-seat', note)
    mark('qN', 'ok', `seat nonce ${noncePk.toBase58().slice(0, 4)}…${noncePk.toBase58().slice(-4)}`)
    const fresh = (await get('launches')).boarding.find((x) => x.id === seatId) || L
    const { tx } = seatTx(W, { mint: fresh.mint, user: wallet.pk, spend: Math.round(amt * 1e9), ahead: Math.round(fresh.ahead * 1e9), noncePubkey: noncePk.toBase58(), nonce })
    note('sign your seat. it is only sent at launch, inside the launch bundle')
    const signed = await wallet.p.signTransaction(tx)
    mark('qS', 'ok', 'seat signed')
    const r = await post('seat', { id: seatId, tx: b64(signed.serialize()) })
    if (r.error) throw new Error(r.error)
    toast(`You're in seat ${r.seats.length} of $${r.symbol}. It lands in block zero at ${hhmm(r.at)}.`); $('sheetS').classList.remove('on'); pull()
  } catch (e) { toast(String(e.message || e).slice(0, 220), true) }
  note('Your buy is only sent at launch, inside the launch bundle.'); b.disabled = false
}

// ---------------------------------------------------------------- scheduling a launch
const sheetL = $('sheetL')
;[$('bLaunch'), $('bLaunch2')].forEach((b) => (b.onclick = () => { fillTimes(); sheetL.classList.add('on') }))
function fillTimes() {
  const q = 15 * 60_000, first = Math.ceil((Date.now() + 3 * 60_000) / q) * q, opts = []
  for (let t = first; t <= Date.now() + 24 * 3600_000; t += q) { const m = Math.round((t - Date.now()) / 60_000); if (opts.length < 12 || new Date(t).getMinutes() === 0) opts.push(`<option value="${t}">${hhmm(t)} · in ${m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + ' min'}</option>`) }
  $('fAt').innerHTML = opts.join(''); if ($('fAt').options.length > 2) $('fAt').selectedIndex = 2
}
let img = null, imgHash = ''
$('fImg').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return
  imgHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await f.arrayBuffer()))).map((x) => x.toString(16).padStart(2, '0')).join('')
  const bmp = await createImageBitmap(f), side = Math.min(bmp.width, bmp.height), size = Math.min(1000, side)
  const cv = document.createElement('canvas'); cv.width = cv.height = size
  cv.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size)
  img = cv.toDataURL('image/webp', 0.9); $('fPrev').src = img; $('fPrev').style.display = 'block'
}
$('fGo').onclick = async () => {
  const b = $('fGo'), note = (t) => ($('fNote').textContent = t)
  if (!wallet) { try { await connectWallet(); mark('kW', 'ok', `dev wallet ${wallet.pk.slice(0, 4)}…${wallet.pk.slice(-4)}`); b.textContent = 'Sign and schedule' } catch (e) { toast(String(e.message || e), true) } return }
  const name = $('fName').value.trim(), symbol = $('fSym').value.trim().replace(/^\$+/, ''), at = +$('fAt').value
  if (!name || !symbol || !img) return toast('name, ticker and a picture, please', true)
  if (!(at > Date.now() + 60_000)) { fillTimes(); return toast('pick a launch time', true) }
  b.disabled = true
  try {
    const W = await W3(), owner = new W.PublicKey(wallet.pk)
    note('checking for copies…')
    const v = await get('vamp', `name=${encodeURIComponent(name)}&symbol=${encodeURIComponent(symbol)}&img=${imgHash}`)
    if ((v.hits || []).length) { mark('kC', 'no', `$${v.hits[0].symbol} launched ${ago(v.hits[0].at)} ago. no copies`); throw new Error('that ticker or name is taken this hour') }
    if (v.image) { mark('kC', 'no', `that picture belongs to $${v.image.symbol}`); throw new Error('that picture is already in use') }
    mark('kC', 'ok', 'ticker, name and picture are original')
    const { noncePk, nonce } = await ensureNonce(W, 'outsnipe', note)
    mark('kN', 'ok', `nonce account ${noncePk.toBase58().slice(0, 4)}…${noncePk.toBase58().slice(-4)}`)
    note('building your launch…')
    const up = await post('upload', { name, symbol, description: $('fDesc').value, image: img, imgHash, twitter: $('fX').value, website: $('fWeb').value })
    if (up.error) throw new Error(up.error)
    const mint = W.Keypair.generate(), buy = Math.max(0, +$('fBuy').value || 0)
    const r = await fetch('https://pumpportal.fun/api/trade-local', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ publicKey: wallet.pk, action: 'create', tokenMetadata: { name, symbol, uri: up.uri }, mint: mint.publicKey.toBase58(), denominatedInSol: 'true', amount: buy, slippage: 15, priorityFee: 0.0005, pool: 'pump' }) })
    if (r.status !== 200) throw new Error('could not build the launch (' + r.status + ')')
    const built = W.VersionedTransaction.deserialize(new Uint8Array(await r.arrayBuffer()))
    const luts = await Promise.all(built.message.addressTableLookups.map(async (l) => {
      const a = await rpc('getAccountInfo', [l.accountKey.toBase58(), { encoding: 'base64' }])
      return new W.AddressLookupTableAccount({ key: l.accountKey, state: W.AddressLookupTableAccount.deserialize(unb64(a.value.data[0])) })
    }))
    const msg = W.TransactionMessage.decompile(built.message, { addressLookupTableAccounts: luts })
    msg.instructions.unshift(W.SystemProgram.nonceAdvance({ noncePubkey: noncePk, authorizedPubkey: owner }))
    msg.instructions.push(W.SystemProgram.transfer({ fromPubkey: owner, toPubkey: new W.PublicKey(TIPS[mint.publicKey.toBytes()[0] % 8]), lamports: LAUNCH_TIP }))   // pays for the bundle
    msg.recentBlockhash = nonce
    const tx = new W.VersionedTransaction(msg.compileToV0Message(luts))
    tx.sign([mint])
    note('sign your launch. it is only sent at launch time')
    const signed = await wallet.p.signTransaction(tx)
    mark('kS', 'ok', 'launch signed')
    note('checking it would land…')
    const sub = await post('submit', { tx: b64(signed.serialize()), mint: mint.publicKey.toBase58(), name, symbol, desc: $('fDesc').value, image: up.image, uri: up.uri, buy, at, full: $('fFull').checked })
    if (sub.error) throw new Error(sub.error)
    toast(`$${symbol} is boarding. Four seats are open until ${hhmm(at)}. Share the page.`); sheetL.classList.remove('on'); pull()
  } catch (e) { toast(String(e.message || e).slice(0, 220), true) }
  note('Two signatures the first time (the nonce account, then the launch), one after that.'); b.disabled = false
}

// ---------------------------------------------------------------- the hero: four seats go in with the launch, the bots arrive a block late
const stage = $('stage'), net = $('net'), nctx = net.getContext('2d'), ret = $('ret'), outNode = $('outNode')
const SW = 1120, SH = 380, IN = [430, 190], OUTA = [700, 190], OUT = [880, 190]
const SEAT_AT = [[150, 64], [112, 152], [118, 238], [160, 324]], BOT_AT = [[1030, 62], [1048, 318]]
Object.assign(outNode.style, { left: OUT[0] + 'px', top: OUT[1] + 'px' })
const BOT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#ff7a6e" stroke-width="2"><rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/></svg>'
const seatEls = SEAT_AT.map(([x, y]) => { const el = document.createElement('div'); el.className = 'node seat open'; Object.assign(el.style, { left: x + 'px', top: y + 'px' }); stage.appendChild(el); return el })
const botEls = BOT_AT.map(([x, y], i) => { const el = document.createElement('div'); el.className = 'node bot'; Object.assign(el.style, { left: x + 'px', top: y + 'px' }); el.innerHTML = `<span class="av">${BOT_SVG}</span><div><b>sniper bot</b><span>lands in block ${i + 1}</span></div>`; stage.appendChild(el); return el })
const tag = (cls, txt, x, y) => { const el = document.createElement('div'); el.className = 'tag ' + cls; el.textContent = txt; Object.assign(el.style, { left: x + 'px', top: y + 'px' }); stage.appendChild(el); return el }
const tag0 = tag('b0', 'BLOCK 0', OUT[0], OUT[1] - 46), tag1s = BOT_AT.map(([x, y]) => tag('b1', 'BLOCK 1', x, y + (y < SH / 2 ? 34 : -34)))
function heroSeats() {
  // the launch with the most seats taken (else four open seats)
  const L = (st?.boarding || []).slice().sort((a, b) => b.seats.length - a.seats.length)[0]
  seatEls.forEach((el, i) => {
    const s = L?.seats[i]
    el.className = 'node seat' + (s ? ' lit' : ' open')
    el.innerHTML = s ? `<span class="av" style="${av(s.wallet)}"></span><div><b>seat ${i + 1} · ${s.sol} SOL</b><span>${esc(s.wallet)}${L ? ' · $' + esc(L.symbol) : ''}</span></div>`
      : `<span class="av"></span><div><b>seat ${i + 1}</b><span>${L ? 'open · $' + esc(L.symbol) : 'open · 0.05 to 1 SOL'}</span></div>`
  })
  $('outTxt').textContent = L ? `$${L.symbol} · block 0 at ${hhmm(L.at)}` : 'block 0 · launch + 4 seats'
}
heroSeats()
function fitStage() {
  const s = Math.min(1, (innerWidth - 16) / SW); stage.style.transform = `scale(${s})`; stage.style.marginBottom = `${-(1 - s) * SH}px`
  const d = devicePixelRatio || 1; net.width = SW * d; net.height = SH * d; nctx.setTransform(d, 0, 0, d, 0, 0)
}
addEventListener('resize', fitStage); fitStage()
const bez = (p0, c1, c2, p1, t) => { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0], u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1]] }
const curve = (a, b) => { const mx = (a[0] + b[0]) / 2; return [a, [mx, a[1]], [mx, b[1]], b] }
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - (1 - x) ** 3)
const PERIOD = 4600
let lastCycle = -1
function draw(now) {
  nctx.clearRect(0, 0, SW, SH)
  const t = now % PERIOD, cyc = Math.floor(now / PERIOD)
  const glow = (x, y, r, col) => { const g = nctx.createRadialGradient(x, y, 0, x, y, r * 5); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); nctx.fillStyle = g; nctx.beginPath(); nctx.arc(x, y, r * 5, 0, 7); nctx.fill(); nctx.fillStyle = '#fff'; nctx.beginPath(); nctx.arc(x, y, r * 0.6, 0, 7); nctx.fill() }
  const line = (c, col, w, dash) => { nctx.setLineDash(dash || []); nctx.strokeStyle = col; nctx.lineWidth = w; nctx.beginPath(); nctx.moveTo(...c[0]); nctx.bezierCurveTo(...c[1], ...c[2], ...c[3]); nctx.stroke(); nctx.setLineDash([]) }
  // seats -> reticle (0 .. 1300 ms, all arrive together)
  for (let i = 0; i < 4; i++) {
    const [x, y] = SEAT_AT[i], c = curve([x + 78, y], IN), lit = seatEls[i].classList.contains('lit')
    line(c, lit ? 'rgba(33,228,107,.42)' : 'rgba(33,228,107,.2)', 1.3)
    const k = ease(t / 1300); if (t < 1300) glow(...bez(...c, k), 2.4, 'rgba(33,228,107,.6)')
  }
  // reticle -> pump.fun (1300 .. 1900): block 0
  const o = curve(OUTA, [OUT[0] - 80, OUT[1]])
  const firing = t > 1300 && t < 3600
  line(o, firing ? 'rgba(33,228,107,.85)' : 'rgba(33,228,107,.35)', firing ? 2.2 : 1.5)
  if (t >= 1300 && t < 1900) glow(...bez(...o, ease((t - 1300) / 600)), 3.6, 'rgba(33,228,107,.75)')
  // bots -> pump.fun, dashed, arriving a block later (1900 .. 2700)
  BOT_AT.forEach(([x, y], i) => {
    const up = y < SH / 2, ex = OUT[0] + 46, a = [x - 92, y], b = [ex, OUT[1] + (up ? -30 : 30)]
    const c = [a, [ex + 10, y], [ex, y + (up ? 40 : -40)], b]   // left, then an elbow down (or up) into the pump.fun tile
    line(c, 'rgba(255,90,78,.32)', 1.2, [4, 5])
    if (t >= 1900 && t < 2700) glow(...bez(...c, ease((t - 1900) / 800)), 2.4, 'rgba(255,90,78,.65)')
  })
  if (cyc !== lastCycle && t > 1300) { lastCycle = cyc; ret.classList.remove('hit'); void ret.offsetWidth; ret.classList.add('hit') }
  outNode.classList.toggle('fire', firing); tag0.classList.toggle('on', t > 1850 && t < 4200)
  tag1s.forEach((e) => e.classList.toggle('on', t > 2650 && t < 4200)); botEls.forEach((e) => e.classList.toggle('late', t > 2650 && t < 4200))
  requestAnimationFrame(draw)
}
requestAnimationFrame(draw)
