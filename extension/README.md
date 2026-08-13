# yom companion

Marks the shopping page. Reformation still has an authored interview story. Other shops use the page + a shared brain on youryom.com.

## Load

1. `chrome://extensions` → Load unpacked → `~/Desktop/yom/extension`
2. Reload after pulls
3. Click the yom icon

Triple-click the character to reset.

## Shared API key (every user)

The key does **not** go in the extension. Anyone could unpack it.

It lives as a Vercel env var. The extension calls `https://youryom.com/api/yom-advise`. Every install uses that.

1. In the Vercel project for youryom.com, add **one** of:
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
2. Deploy (Anthropic is used if both are set)
3. Reload the extension

Local override in the popup is optional, for your own testing only.

```bash
# Vercel dashboard → Settings → Environment Variables
# or:
npx vercel env add ANTHROPIC_API_KEY
npx vercel --prod
```

## Test another website

1. Open Aritzia / SSENSE / etc.
2. Popup → **use this tab** if yom didn’t appear
3. Click yom → pick an occasion + budget
4. Pause on products. Open a PDP.

## Interview path (Reformation, hardcoded)

1. **just browsing** → **no budget**
2. Pause → closet / reviews / green
3. Open a green dress → **Sofia's wedding**
4. **look into this** → length + alterations
5. Add to bag → budget → pairing → shoes → cart
