# Inject GMAX Premium Code into assets/index.html

`App.tsx` already handles `GENERATE_CODE` + 2 rewarded ads.

## 1. Add tool card (inside TOOLS array, before aidetect)

```js
{ id: "gmaxcode", cat: "gen", name: "GMAX Premium Code", desc: "Watch 2 rewarded ads and get a 12-digit unlock code for GMAX Music app — 24 hours Premium.", kw: "gmax premium unlock code music app reward ad key 24 hour" },
```

## 2. Add pane (before `</main>` of view-tool)

Copy from conversation file `gmaxcode-pane.html` or use the Generate Code UI section.

## 3. Add once("gmaxcode") init (near once("uuid"))

Calls `POST https://YOUR-VERCEL-URL/api/generate-code` after ads.

**Important:** Set API URL to your real Vercel domain in the once() handler.

## 4. Rebuild APK on expo.dev
