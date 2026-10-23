/**
 * Loom2hand – order emails with PDF  (Google Apps Script web app)
 *
 * What it does for every order placed on the website:
 *   1. Re-checks every price against the live website catalogue (so nobody can fake prices)
 *   2. Saves the order in a Google Sheet called "Loom2hand Orders" (created automatically)
 *   3. Makes a PDF of the order
 *   4. Emails the PDF to you (OWNER_EMAIL) and to the customer (if they gave an email)
 *
 * Set-up: see "Order emails" in README.md. Deploy while signed in as loom2hand@gmail.com.
 */

var OWNER_EMAIL = 'loom2hand@gmail.com';
var SITE_URL    = 'https://loom2hand.github.io/loom2hand/';   // trailing slash
var SHOP        = 'Loom2hand';
var TAGLINE     = 'Quality You Can Trust';
var PHONE       = '+91 98945 61604';
var ADDRESS     = 'Attayampatti, Salem, Tamil Nadu';

/* ------------------------------------------------------------------ */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var o = JSON.parse(e.postData.contents);
    if (o.website) return out_({ ok: true });                       // honeypot – bots fill it
    var err = validate_(o);
    if (err) return out_({ ok: false, error: err });

    var cache = CacheService.getScriptCache();
    if (cache.get('id_' + o.id)) return out_({ ok: true, dup: true }); // same order sent twice
    var key = 'ph_' + o.customer.phone, n = +(cache.get(key) || 0);
    if (n >= 5) return out_({ ok: false, error: 'Too many orders, please message us on WhatsApp.' });

    var order = price_(o);
    lock.waitLock(20000);
    save_(order);
    lock.releaseLock();

    var pdf = pdf_(order);
    var subject = SHOP + ' order ' + order.id + ' – ' + money_(order.total) + (order.shipping === null ? ' + shipping' : '');

    // 1) customer copy first, so a problem here is recorded and shown in your email
    var custStatus = 'No email given';
    if (order.customer.email) {
      try {
        MailApp.sendEmail({
          to: order.customer.email,
          replyTo: OWNER_EMAIL,
          subject: subject,
          body: textMail_(order),
          htmlBody: customerMail_(order),
          attachments: [pdf],
          name: SHOP
        });
        custStatus = 'Sent to ' + order.customer.email;
      } catch (ce) {
        custStatus = 'FAILED to ' + order.customer.email + ': ' + (ce && ce.message || ce);
      }
    }
    order.custStatus = custStatus;
    try { setStatus_(order.id, custStatus); } catch (se) {}

    // 2) your copy
    MailApp.sendEmail({
      to: OWNER_EMAIL,
      replyTo: order.customer.email || OWNER_EMAIL,
      subject: 'New order ' + order.id + ' – ' + order.customer.name + ' – ' + money_(order.total),
      body: textMail_(order) + '\nCustomer copy: ' + custStatus,
      htmlBody: ownerMail_(order),
      attachments: [pdf],
      name: SHOP + ' Website'
    });
    cache.put('id_' + o.id, '1', 21600);
    cache.put(key, String(n + 1), 600);
    return out_({ ok: true, id: order.id });
  } catch (x) {
    try { MailApp.sendEmail(OWNER_EMAIL, SHOP + ' website: order email failed', String(x && x.stack || x) + '\n\n' + (e && e.postData ? e.postData.contents : '')); } catch (y) {}
    return out_({ ok: false, error: 'server' });
  }
}

function doGet() { return out_({ ok: true, service: SHOP + ' orders' }); }

/* ---------------- checks & pricing ---------------- */

function validate_(o) {
  if (!o || !/^L2H-\d{6}-\d{4}$/.test(o.id || '')) return 'bad id';
  var c = o.customer || {};
  if (!c.name || String(c.name).length > 80) return 'name';
  if (!/^[6-9]\d{9}$/.test(c.phone || '')) return 'phone';
  if (!/^\d{6}$/.test(c.pin || '')) return 'pin';
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) return 'email';
  if (!o.items || !o.items.length || o.items.length > 60) return 'items';
  for (var i = 0; i < o.items.length; i++) {
    var q = o.items[i].qty;
    if (!(q >= 1 && q <= 500 && q === Math.floor(q))) return 'qty';
  }
  return '';
}

function catalogue_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('cat');
  if (hit) return JSON.parse(hit);
  var js = UrlFetchApp.fetch(SITE_URL + 'assets/products.js?t=' + Date.now(), { muteHttpExceptions: true }).getContentText();
  var data = JSON.parse(js.replace(/^\s*window\.L2H\s*=\s*/, '').replace(/;\s*$/, ''));
  var map = { _s: data.settings };
  data.products.forEach(function (p) { map[p.sku] = { name: p.name, price: p.price, mrp: p.mrp, size: p.size, cat: p.cat }; });
  try { cache.put('cat', JSON.stringify(map), 600); } catch (e) {}
  return map;
}

function price_(o) {
  var cat = catalogue_(), S = cat._s || {}, sub = 0, mrp = 0, n = 0, lines = [];
  o.items.forEach(function (it) {
    var p = cat[it.sku];
    if (!p) throw new Error('Unknown product ' + it.sku);
    sub += p.price * it.qty; mrp += p.mrp * it.qty; n += it.qty;
    lines.push({ sku: it.sku, name: p.name, size: p.size, design: String(it.design || '').slice(0, 40), qty: it.qty, price: p.price, mrp: p.mrp, amount: p.price * it.qty });
  });
  var ship = null;
  if (S.freeAbove > 0 && sub >= S.freeAbove) ship = 0; else if (S.shipFee > 0) ship = S.shipFee;
  var c = o.customer;
  return {
    id: o.id, date: new Date(), items: lines, count: n, subtotal: sub, mrp: mrp, saved: mrp - sub,
    shipping: ship, total: sub + (ship || 0),
    customer: { name: clean_(c.name, 80), phone: c.phone, email: clean_(c.email, 120), addr: clean_(c.addr, 300), city: clean_(c.city, 60), pin: c.pin, note: clean_(c.note, 300) }
  };
}

/* ---------------- sheet ---------------- */

function book_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('SHEET_ID'), ss;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('Loom2hand Orders');
    var o = ss.getSheets()[0].setName('Orders');
    o.appendRow(['Order ID', 'Date', 'Status', 'Customer', 'Mobile', 'Email', 'Address', 'City', 'Pincode', 'Items', 'Subtotal', 'Shipping', 'Total', 'Note', 'Customer email']);
    o.getRange(1, 1, 1, 15).setFontWeight('bold').setBackground('#2E6B34').setFontColor('#ffffff'); o.setFrozenRows(1);
    var l = ss.insertSheet('Order lines');
    l.appendRow(['Order ID', 'Date', 'SKU', 'Product', 'Size', 'Design', 'Qty', 'Price', 'Amount']);
    l.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#2E6B34').setFontColor('#ffffff'); l.setFrozenRows(1);
    props.setProperty('SHEET_ID', ss.getId());
  }
  return ss;
}

function setStatus_(id, status) {
  var sh = book_().getSheetByName('Orders'), last = sh.getLastRow();
  if (sh.getRange(1, 15).getValue() !== 'Customer email') sh.getRange(1, 15).setValue('Customer email').setFontWeight('bold');
  var ids = sh.getRange(Math.max(2, last - 50), 1, Math.min(51, last - 1), 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) if (ids[i][0] === id) { sh.getRange(Math.max(2, last - 50) + i, 15).setValue(status); return; }
}

function textMail_(o) {
  var L = [SHOP + ' order ' + o.id, ''];
  o.items.forEach(function (i, k) { L.push((k + 1) + '. ' + i.name + (i.design ? ' (' + i.design + ')' : '') + ' – ' + i.qty + ' x ' + money_(i.price) + ' = ' + money_(i.amount)); });
  L.push('', 'Total: ' + money_(o.total) + (o.shipping === null ? ' + shipping' : ''), '', 'Deliver to: ' + o.customer.name + ', ' + o.customer.addr + ', ' + o.customer.city + ' - ' + o.customer.pin + ', ' + o.customer.phone,
    '', 'The PDF copy is attached. We will confirm stock, shipping and payment on WhatsApp ' + PHONE + '.');
  return L.join('\n');
}

function save_(o) {
  var ss = book_(), c = o.customer;
  ss.getSheetByName('Orders').appendRow([o.id, o.date, 'New', c.name, "'" + c.phone, c.email, c.addr, c.city, "'" + c.pin, o.count, o.subtotal, o.shipping === null ? 'To confirm' : o.shipping, o.total, c.note]);
  var rows = o.items.map(function (i) { return [o.id, o.date, i.sku, i.name, i.size, i.design, i.qty, i.price, i.amount]; });
  var l = ss.getSheetByName('Order lines');
  l.getRange(l.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
}

/* ---------------- PDF ---------------- */

function pdf_(o) {
  var c = o.customer, d = Utilities.formatDate(o.date, 'Asia/Kolkata', 'dd MMM yyyy, hh:mm a');
  var rows = o.items.map(function (i, k) {
    return '<tr><td>' + (k + 1) + '</td><td><b>' + h_(i.name) + '</b><br><span class="m">' + h_(i.sku) + ' · ' + h_(i.size) + (i.design ? ' · Design: ' + h_(i.design) : '') + '</span></td>' +
      '<td class="r">' + i.qty + '</td><td class="r">' + money_(i.price) + '<br><span class="m s">' + money_(i.mrp) + '</span></td><td class="r"><b>' + money_(i.amount) + '</b></td></tr>';
  }).join('');
  var html =
    '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;color:#2A2320;font-size:12px;margin:28px}' +
    '.top{border-bottom:4px solid #2E6B34;padding-bottom:10px;margin-bottom:16px}' +
    '.brand{font-size:28px;font-weight:bold;color:#2E6B34}.brand span{color:#E9A825}.tag{color:#7A4A26;font-size:12px}' +
    '.meta{float:right;text-align:right;font-size:12px}.meta b{font-size:16px;color:#2E6B34}' +
    'h3{color:#2E6B34;margin:16px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:1px}' +
    'table{width:100%;border-collapse:collapse}th{background:#2E6B34;color:#fff;text-align:left;padding:7px;font-size:11px}' +
    'td{padding:7px;border-bottom:1px solid #ECE4D6;vertical-align:top}.r{text-align:right}.m{color:#6E655C;font-size:10px}.s{text-decoration:line-through}' +
    '.tot{width:46%;margin-left:54%;margin-top:10px}.tot td{border:0;padding:4px 7px}.g{color:#2E6B34}.big td{font-size:15px;font-weight:bold;border-top:2px solid #2E6B34}' +
    '.box{background:#FBF7EF;border:1px solid #ECE4D6;padding:10px;border-radius:6px}.foot{margin-top:22px;color:#6E655C;font-size:10px;border-top:1px solid #ECE4D6;padding-top:8px}' +
    '</style></head><body>' +
    '<div class="top"><div class="meta">ORDER<br><b>' + o.id + '</b><br>' + d + '</div>' +
    '<div class="brand">Loom<span>2</span>hand</div><div class="tag">' + TAGLINE + ' · 100% cotton, straight from the loom</div></div>' +
    '<h3>Deliver to</h3><div class="box"><b>' + h_(c.name) + '</b><br>' + h_(c.addr) + '<br>' + h_(c.city) + ' – ' + c.pin + '<br>Mobile: ' + c.phone + (c.email ? ' · ' + h_(c.email) : '') + '</div>' +
    '<h3>Items</h3><table><tr><th>#</th><th>Product</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr>' + rows + '</table>' +
    '<table class="tot"><tr><td>MRP total (' + o.count + ' pcs)</td><td class="r">' + money_(o.mrp) + '</td></tr>' +
    '<tr class="g"><td>Discount</td><td class="r">– ' + money_(o.saved) + '</td></tr>' +
    '<tr><td>Subtotal</td><td class="r">' + money_(o.subtotal) + '</td></tr>' +
    '<tr><td>Shipping</td><td class="r">' + (o.shipping === null ? 'Confirmed on WhatsApp' : o.shipping === 0 ? 'Free' : money_(o.shipping)) + '</td></tr>' +
    '<tr class="big"><td>Total' + (o.shipping === null ? ' (+ shipping)' : '') + '</td><td class="r">' + money_(o.total) + '</td></tr></table>' +
    (c.note ? '<h3>Note</h3><div class="box">' + h_(c.note) + '</div>' : '') +
    '<div class="foot">This is an order request. We will confirm stock, shipping and payment on WhatsApp before dispatch. ' +
    'Questions? WhatsApp ' + PHONE + ' · ' + OWNER_EMAIL + ' · ' + ADDRESS + '</div></body></html>';
  return Utilities.newBlob(html, MimeType.HTML, 'x.html').getAs(MimeType.PDF).setName(SHOP + '-' + o.id + '.pdf');
}

/* ---------------- email bodies ---------------- */

function itemsList_(o) {
  return '<ul>' + o.items.map(function (i) { return '<li>' + h_(i.name) + (i.design ? ' (' + h_(i.design) + ')' : '') + ' – ' + i.qty + ' × ' + money_(i.price) + ' = <b>' + money_(i.amount) + '</b></li>'; }).join('') + '</ul>';
}

function customerMail_(o) {
  return '<div style="font-family:Arial,sans-serif;color:#2A2320;max-width:560px">' +
    '<h2 style="color:#2E6B34;margin:0">Thank you, ' + h_(o.customer.name) + '!</h2>' +
    '<p>We have received your order <b>' + o.id + '</b>. The PDF copy is attached.</p>' + itemsList_(o) +
    '<p><b>Total: ' + money_(o.total) + (o.shipping === null ? ' + shipping' : '') + '</b></p>' +
    '<p>We will message you on WhatsApp to confirm stock, shipping and payment before we dispatch.</p>' +
    '<p style="color:#6E655C">' + SHOP + ' · ' + TAGLINE + '<br>WhatsApp ' + PHONE + ' · ' + SITE_URL + '</p></div>';
}

function ownerMail_(o) {
  var c = o.customer, wa = 'https://wa.me/91' + c.phone + '?text=' + encodeURIComponent('Hi ' + c.name + ', thank you for your Loom2hand order ' + o.id + '. ');
  return '<div style="font-family:Arial,sans-serif;color:#2A2320;max-width:560px">' +
    '<h2 style="color:#2E6B34;margin:0">New order ' + o.id + '</h2>' +
    '<p><b>' + h_(c.name) + '</b> · ' + c.phone + (c.email ? ' · ' + h_(c.email) : '') + '<br>' + h_(c.addr) + ', ' + h_(c.city) + ' – ' + c.pin + '</p>' +
    itemsList_(o) + '<p><b>Total: ' + money_(o.total) + (o.shipping === null ? ' + shipping' : '') + '</b></p>' +
    (c.note ? '<p>Note: ' + h_(c.note) + '</p>' : '') +
    '<p><b>Customer copy:</b> ' + h_(o.custStatus || '') + '</p>' +
    '<p><a href="' + wa + '" style="background:#1FA855;color:#fff;padding:10px 16px;border-radius:20px;text-decoration:none">Reply on WhatsApp</a></p>' +
    '<p style="color:#6E655C">Saved in your "Loom2hand Orders" Google Sheet.</p></div>';
}

/* ---------------- helpers ---------------- */

function money_(n) { return 'Rs. ' + Math.round(n).toLocaleString('en-IN'); }
function h_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function clean_(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim().slice(0, n); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Run this once from the editor to grant permissions and send yourself a sample PDF. */
function testOrder() {
  var cat = catalogue_(), sku = Object.keys(cat).filter(function (k) { return k !== '_s'; })[0];
  var r = doPost({ postData: { contents: JSON.stringify({ id: 'L2H-000000-' + (1000 + Math.floor(Math.random() * 9000)), items: [{ sku: sku, qty: 2 }],
    customer: { name: 'Test Customer', phone: '9894561604', email: OWNER_EMAIL, addr: '12 Main Road', city: 'Salem', pin: '636001', note: 'Test order – ignore' } }) } });
  Logger.log(r.getContent());
}
