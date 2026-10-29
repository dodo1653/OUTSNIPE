# OUTSNIPE

**The public launch bundle for pump.fun.** A creator schedules a coin's launch; four buyers take seats. At launch time the launch and the four seats go out as one Jito bundle, in that order, all or nothing, so the seats land in the same block the coin is created, before any sniper bot can see it.

## How it works

1. **Schedule.** The creator's wallet signs the coin's pump.fun launch (built by PumpPortal's `trade-local`, `create`) against a **durable nonce** it owns (seed `outsnipe`), plus a 0.0005 SOL Jito tip. The relay simulates it (signature checked) and keeps it until launch time (15-minute slots, up to 24 h ahead, or early when all four seats fill).
2. **Seats.** A buyer signs a pump.fun `buy_exact_quote_in_v3` of the coin before it exists (`seat.js`): every account it needs follows from the mint and the buyer (bonding curve PDA, Token-2022 ATAs, wSOL ATAs, user volume accumulator, fee config, a buyback fee recipient). It runs on the buyer's own durable nonce (seed `outsnipe-seat`), creates their token account first, and tips Jito 0.00002 SOL. The relay checks the signature, that the transaction only advances the nonce / sets compute budget / creates the ATA / buys this coin / tips, that the nonce account matches, and the buyer's balance. 0.05 to 1 SOL a seat; one pending seat per wallet.
3. **Block zero.** At launch the relay re-checks every seat (nonce unchanged, SOL still there, drops the rest), then sends `[launch, seat 1..4]` as one bundle to six Jito block engines every second for about 8 s. If it lands, everything is in the coin's first block. If not, the launch goes alone over RPC and the seats are sent right after; the board records the slot each seat landed in.

Copies of anything launched on pump.fun in the last hour (name, ticker, picture) are refused at scheduling and again at launch.

## Layout

| Path | What |
|---|---|
| `index.html`, `os.css`, `os.js` | the site (static, no build) |
| `seat.js` | builds a seat (shared by the page and the tests) |
| `api/r.js` | Vercel edge proxy to the relay with short CDN caching |
| `relay/` | Cloudflare Worker + Durable Object: pump.fun log feed, anti-vamp, metadata hosting, `launches.js` (scheduling, seats, the bundle) |
| `brand/reticle.py` | Blender: coin image (`still`), hero cutout (`cutout`), film frames (`turn`) |
| `brand/og.html` | the share image |
| `promo/film.html`, `promo/music.mjs` | the 10 s film (rendered with `pitwall/render_film.sh`) |

## Deploy

```
cd relay && npm install && npx wrangler deploy
npx wrangler secret put RPC_URL      # a Helius (or other) RPC URL that accepts Workers
```
Then import the repo on Vercel (Root Directory empty).

## Local

```
RPC_URL=<rpc> node relay/dev.mjs           # relay on :8794
python -m http.server 8802                  # open http://127.0.0.1:8802/?relay=http://127.0.0.1:8794
```

OUTSNIPE is independent and not affiliated with pump.fun or Jito. Memecoins are extremely risky.
