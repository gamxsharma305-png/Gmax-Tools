# GMAX Tools — Expo + Full AdMob

## Ad Placement

| Ad Type | When |
|---------|------|
| **App Open Ad** | App open + return from background |
| **Rewarded Ad x2** | On Export / Download **and** on **Generate Premium Code** |
| **Banner Ad** | Fixed bottom under every tool |
| **Interstitial** | Every 5th tool open |

## GMAX Premium Code (Music app unlock)

1. Open tool **GMAX Premium Code** (Generators category).
2. Tap **Generate Code** → watch **2 rewarded ads**.
3. 12-digit code appears on screen (no AroLinks).
4. User pastes code in **GMAX Music** app → **24 hours** Premium.

API:
- Generate: `POST https://YOUR-VERCEL/api/generate-code`
- Verify (Music app): `POST https://YOUR-VERCEL/api/verify` body `{ code, deviceId }`

Update `assets/index.html` API base if your Vercel URL is not `gmax-premium-api.vercel.app`.

## Build from expo.dev (no computer needed)

1. Open https://expo.dev and login
2. Create project from this GitHub repo
3. Builds → Create a build → Android → production (AAB) or preview (APK)

## Package
`com.gmax.tools`

Replace Test AdMob IDs in App.tsx and app.json before production.
