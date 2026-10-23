# Loom2hand website

A fast, single-page shop for Loom2hand (towels, kerchiefs, jute bags). Customers add products to a cart and send the order to your WhatsApp. No server, no database, no monthly fees.

## Folder layout

```
loom2hand/
├── products.xlsx        ← your master sheet: stock, buying rates, names, settings
├── images/TW-01/…       ← cleaned product photos, one folder per product (SKU)
├── photo-originals/     ← the supplier's original photos (backup)
├── logo-full.svg        ← full logo for print / social media
├── tools/build.py       ← turns the Excel + photos into the website
├── tools/clean_photos.py← optional: cleans a new raw photo (removes backdrop)
└── site/                ← THE WEBSITE – upload this folder to go live
```

## Before going live

1. Open `products.xlsx` → **Settings** sheet → put your real **WhatsApp number** (e.g. `919876543210`), phone, email and location.
2. Check stock quantities on the **Products** sheet (they are set to 50 as a placeholder).
3. Run the build (below) and upload `site/`.

## Everyday updates

1. Edit `products.xlsx` (stock, rates, Active/Featured, new rows) and save.
2. New product? Create `images/<SKU>/` and drop photos named `01.jpg`, `02.jpg`… To show design choices, name them `01_pink.jpg`, `02_blue-check.jpg`.
3. Run:
   ```
   pip install openpyxl pillow      # first time only
   python tools/build.py
   ```
4. Upload the `site/` folder again.

### Pricing rule (Settings sheet)
- Selling price = buy rate × 1.5 (50% markup), rounded **up** to end in 9.
- Struck-through MRP = selling price ÷ 0.75, rounded to end in 9, so it shows about **25% off**.
- Change *Markup %* or *Display discount %* on the Settings sheet and rebuild, and every price updates.
- Buying rates are **never** written into the website files.

## Publishing (GitHub Pages)

This folder is a git repo. Every push to `main` runs `.github/workflows/pages.yml`, which publishes the `site/` folder to GitHub Pages.
`products.xlsx` (buying rates) and `photo-originals/` are in `.gitignore` and are never uploaded.

Update routine: edit Excel / photos → `python3 tools/build.py` → commit and push in GitHub Desktop → site updates in about a minute.

## Other hosting (free options)

- **Netlify Drop** (easiest): go to app.netlify.com/drop and drag the `site` folder in. You get a link right away and can add your own domain (e.g. loom2hand.in) later.
- **Cloudflare Pages**: create a project, choose "Direct upload" and upload `site/`.
- **GitHub Pages**: push `site/` to a repo and enable Pages.

## Speed
Code is about 20 KB gzipped and each product photo is about 8 KB (480 px WebP, 960 px on zoom). Photos load lazily as customers scroll. There is no framework, no tracking script and no external CDN.

## Order emails with PDF (one-time set-up, about 10 minutes)

Every order is emailed as a PDF to you and to the customer (if they type an email), and saved in a Google Sheet called **Loom2hand Orders**. It runs free on your own Gmail through Google Apps Script. The website keeps working by WhatsApp alone until this is set up.

1. Sign in to Google as **loom2hand@gmail.com** and open https://script.google.com → **New project**.
2. Delete the sample code, paste everything from `tools/order-email.gs`, and click **Save**. Name the project "Loom2hand Orders".
3. Pick **testOrder** in the function list at the top and click **Run**. Allow the permissions it asks for (Advanced → Go to Loom2hand Orders → Allow). You should get a test email with a PDF, and a new "Loom2hand Orders" sheet in your Google Drive.
4. Click **Deploy → New deployment** → gear icon → **Web app**. Set *Execute as*: **Me**, *Who has access*: **Anyone**. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
5. Paste that URL into `products.xlsx` → Settings → **Order email script URL**, run `python3 tools/build.py`, then commit and push.

If you change the script later, use **Deploy → Manage deployments → Edit → Version: New version** so the URL stays the same.

Notes:
- Prices in the email are checked again against the live website, so a customer cannot change them.
- Gmail allows about 100 emails a day on a free account, which is about 50 orders a day.
- If an email ever fails, you get an email with the error and the order details.
