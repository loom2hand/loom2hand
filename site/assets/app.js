(function () {
  'use strict';
  var D = window.L2H || { settings: {}, products: [] };
  var S = D.settings, P = D.products;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var BY = {}; P.forEach(function (p, i) { p.i = i; BY[p.sku] = p; });
  var TAGS = [['', 'All'], ['White', 'White'], ['Colour', 'Colour'], ['Printed', 'Printed'], ['Checks', 'Checks'], ['Stripes', 'Stripes'], ['Kids', 'Kids Prints']];
  P.forEach(function (p) { if (p.tag && !TAGS.some(function (t) { return t[0] === p.tag; })) TAGS.push([p.tag, p.tag]); });
  var WEAVE = {
    'Matty': 'Fine matty weave in pure cotton – smooth on skin, absorbent and quick to dry. A classic everyday towel that gets softer with every wash.',
    'Dobby': 'Textured dobby weave with a woven border. Absorbent, hard-wearing and easy to wash – a reliable daily towel.',
    'Cooltex': 'Lightweight Cooltex weave that dries fast. Ideal for daily use, travel, gym and humid weather.',
    'Honeycomb': 'Honeycomb (waffle) texture that soaks up water quickly and airs out fast, so it stays fresh.',
    'Double Cloth': 'Two-layer double-cloth weave – thicker, extra soft and pre-finished to keep shrinkage low.',
    'Check': 'Bright yarn-dyed checks: the colour is woven into the yarn, so it stays vivid wash after wash.',
    'Stripe': 'Yarn-dyed stripes with a colourfast, zero-zero (no-shrink) finish. Light, absorbent and fast drying.',
    '2-Ply': 'Compact 2-ply cotton towel – handy for kids, hand towels, travel and the kitchen.'
  };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('l2h_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('l2h_' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var money = function (n) { return '₹' + Math.round(n).toLocaleString('en-IN'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var img = function (f) { return 'img/' + f; };
  var waLink = function (text) { return 'https://wa.me/' + (S.wa || '') + (text ? '?text=' + encodeURIComponent(text) : ''); };
  var low = S.lowStock || 10;

  var st = { cat: 'Towels', tag: '', size: '', sort: 'pop', q: '' };
  var cart = store.get('cart', []).filter(function (l) { return BY[l.sku]; });

  /* ---------- helpers ---------- */
  function stockOf(p) { return p.stock == null ? Infinity : p.stock; }
  function inCart(sku, d) { var l = cart.find(function (x) { return x.sku === sku && x.d === d; }); return l ? l.qty : 0; }
  function qtyTotalSku(sku) { return cart.reduce(function (a, l) { return a + (l.sku === sku ? l.qty : 0); }, 0); }
  function metaLine(p) { return [p.size, p.weave, p.gsm ? p.gsm + ' g' : ''].filter(Boolean).join(' · '); }
  function priceHtml(p) { return '<div class="price"><b>' + money(p.price) + '</b>' + (p.mrp > p.price ? '<s>' + money(p.mrp) + '</s><span class="off">' + p.off + '% off</span>' : '') + '</div>'; }
  function art(p, cls) { return '<svg class="art ' + (cls || '') + '" viewBox="0 0 200 200" role="img" aria-label="' + esc(p.name) + ' – photo coming soon"><use href="#' + (p.art || 'a-colour') + '"/></svg>'; }
  function notifyLink(p) { return waLink('Hi ' + (S.shop || 'Loom2hand') + ', please tell me when ' + p.name + ' [' + p.sku + '] is back in stock.'); }
  function toast(t) { var el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('show'); }, 1800); }

  /* ---------- cards ---------- */
  function card(p) {
    var s = stockOf(p), pill = '';
    if (s <= 0) pill = '<span class="tagpill out">Out of stock</span>';
    else if (s < low) pill = '<span class="tagpill alt">Only ' + s + ' left</span>';
    else if (p.featured) pill = '<span class="tagpill">Bestseller</span>';
    var multi = p.img.length > 1, q = multi ? 0 : inCart(p.sku, 0), a = p.img[0];
    var action;
    if (s <= 0) action = '<a class="btn btn-ghost add" href="' + notifyLink(p) + '" target="_blank" rel="noopener">Notify me</a>';
    else if (multi) action = '<button class="btn btn-primary add" data-open="' + p.sku + '">Choose design</button>';
    else if (q) action = '<div class="stepper"><button data-dec="' + p.sku + '" aria-label="Remove one">−</button><span>' + q + ' in cart</span><button data-inc="' + p.sku + '" aria-label="Add one">+</button></div>';
    else action = '<button class="btn btn-primary add" data-add="' + p.sku + '">Add to cart</button>';
    return '<article class="card' + (s <= 0 ? ' is-out' : '') + '" data-sku="' + p.sku + '">' +
      '<button class="card-img" data-open="' + p.sku + '" aria-label="View ' + esc(p.name) + '">' +
      (a ? '<img src="' + img(a.s) + '" srcset="' + img(a.s) + ' 480w,' + img(a.l) + ' 960w" sizes="(max-width:600px) 48vw,(max-width:1200px) 25vw,280px" width="480" height="480" loading="lazy" decoding="async" alt="' + esc(p.name) + '">' : art(p) + '<span class="soon-photo">Photo coming soon</span>') +
      pill + (multi ? '<span class="designs-n">' + p.img.length + ' designs</span>' : '') + '</button>' +
      '<div class="card-body"><h3 data-open="' + p.sku + '">' + esc(p.name) + '</h3><p class="meta">' + esc(metaLine(p)) + '</p>' + priceHtml(p) + action + '</div></article>';
  }

  function filtered() {
    var q = st.q.trim().toLowerCase().replace(/\s*[x×]\s*/g, 'x');
    var words = q ? q.split(/\s+/) : [];
    var list = P.filter(function (p) {
      if (p.cat !== st.cat) return false;
      if (st.tag && p.tag !== st.tag) return false;
      if (st.size && p.size !== st.size) return false;
      if (!words.length) return true;
      var hay = (p.name + ' ' + p.tag + ' ' + p.weave + ' ' + p.size.replace(/["\s]/g, '').replace('×', 'x') + ' ' + (p.gsm || '') + 'g ' + p.img.map(function (i) { return i.label; }).join(' ') + (p.tag === 'Kids' ? ' kids cartoon children' : '')).toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) > -1; });
    });
    var sorters = {
      pop: function (a, b) { return (b.featured - a.featured) || (b.img.length > 0) - (a.img.length > 0) || a.i - b.i; },
      lo: function (a, b) { return a.price - b.price; },
      hi: function (a, b) { return b.price - a.price; },
      off: function (a, b) { return b.off - a.off; }
    };
    return list.sort(function (a, b) { return ((stockOf(b) > 0) - (stockOf(a) > 0)) || sorters[st.sort](a, b); });
  }

  function renderChips() {
    var inCat = P.filter(function (p) { return p.cat === st.cat; });
    $('#chips').innerHTML = TAGS.map(function (t) {
      var n = t[0] ? inCat.filter(function (p) { return p.tag === t[0]; }).length : inCat.length;
      if (t[0] && !n) return '';
      return '<button class="chip' + (st.tag === t[0] ? ' on' : '') + '" role="tab" aria-selected="' + (st.tag === t[0]) + '" data-tag="' + t[0] + '">' + t[1] + '<small>' + n + '</small></button>';
    }).join('');
    var sizes = Array.from(new Set(inCat.map(function (p) { return p.size; }))).sort(function (a, b) { return parseFloat(a) - parseFloat(b) || a.localeCompare(b); });
    $('#size').innerHTML = '<option value="">All sizes</option>' + sizes.map(function (s) { return '<option' + (s === st.size ? ' selected' : '') + ' value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('');
  }

  function renderGrid() {
    var has = P.some(function (p) { return p.cat === st.cat; });
    $('#shopTitle').textContent = 'Shop ' + st.cat.toLowerCase();
    $$('.cat-tile').forEach(function (t) { t.classList.toggle('on', t.dataset.cat === st.cat); });
    $('#soon').hidden = has; $('.toolbar').hidden = !has; $('#chips').hidden = !has;
    if (!has) {
      $('#grid').innerHTML = ''; $('#empty').hidden = true; $('#resultCount').textContent = '';
      $('#soonTitle').textContent = st.cat + ' – coming soon';
      $('#soonWa').href = waLink('Hi Loom2hand, please let me know when ' + st.cat + ' are available.');
      return;
    }
    var list = filtered();
    $('#grid').innerHTML = list.map(card).join('');
    $('#empty').hidden = list.length > 0;
    $('#resultCount').textContent = list.length + ' item' + (list.length === 1 ? '' : 's');
  }

  function renderFeatured() {
    var inS = P.filter(function (p) { return stockOf(p) > 0 && p.img.length; });
    var f = inS.filter(function (p) { return p.featured; }).concat(inS.filter(function (p) { return !p.featured; })).slice(0, 8);
    if (!f.length) { $('#featured-wrap').hidden = true; return; }
    $('#featured').innerHTML = f.map(card).join('');
  }

  function refreshCards() { renderFeatured(); renderGrid(); }

  /* ---------- cart ---------- */
  function save() { store.set('cart', cart); }
  function add(sku, d, n) {
    var p = BY[sku]; if (!p) return;
    var room = stockOf(p) - qtyTotalSku(sku);
    if (room <= 0) { toast('No more stock for this item'); return; }
    n = Math.min(n, room);
    var l = cart.find(function (x) { return x.sku === sku && x.d === d; });
    if (l) l.qty += n; else cart.push({ sku: sku, d: d, qty: n });
    save(); updateBadge(true); refreshCards(); renderCart();
  }
  function setQty(sku, d, q) {
    var l = cart.find(function (x) { return x.sku === sku && x.d === d; }); if (!l) return;
    var p = BY[sku], other = qtyTotalSku(sku) - l.qty;
    l.qty = Math.max(0, Math.min(q, stockOf(p) - other));
    if (!l.qty) cart.splice(cart.indexOf(l), 1);
    save(); updateBadge(); refreshCards(); renderCart();
  }
  function totals() {
    var sub = 0, mrp = 0, n = 0;
    cart.forEach(function (l) { var p = BY[l.sku]; sub += p.price * l.qty; mrp += p.mrp * l.qty; n += l.qty; });
    var ship = null; // null = confirm on WhatsApp
    if (S.freeAbove > 0 && sub >= S.freeAbove) ship = 0;
    else if (S.shipFee > 0) ship = S.shipFee;
    return { sub: sub, mrp: mrp, n: n, ship: ship, total: sub + (ship || 0) };
  }
  function updateBadge(bump) {
    var n = totals().n, b = $('#cartCount');
    b.hidden = !n; b.textContent = n;
    if (bump) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  }
  function renderCart() {
    var t = totals();
    $('#cartEmpty').hidden = !!cart.length; $('#checkout').hidden = !cart.length;
    $('#cartItems').innerHTML = cart.map(function (l) {
      var p = BY[l.sku], im = p.img[l.d] || p.img[0];
      return '<div class="line">' + (im ? '<img src="' + img(im.s) + '" alt="" width="64" height="64" loading="lazy">' : art(p, 'line-art')) +
        '<div><h4>' + esc(p.name) + '</h4><p class="meta">' + esc(p.size) + (p.img.length > 1 ? ' · ' + esc(im.label) : '') + ' · ' + money(p.price) + '</p>' +
        '<div class="stepper"><button data-ldec="' + l.sku + '|' + l.d + '" aria-label="Remove one">−</button><span>' + l.qty + '</span><button data-linc="' + l.sku + '|' + l.d + '" aria-label="Add one">+</button></div></div>' +
        '<div class="amt">' + money(p.price * l.qty) + '<br><button class="rm" data-lrm="' + l.sku + '|' + l.d + '">Remove</button></div></div>';
    }).join('');
    if (!cart.length) return;
    var hint = '';
    if (S.freeAbove > 0 && t.sub < S.freeAbove) hint = '<span class="hint">Add ' + money(S.freeAbove - t.sub) + ' more for free shipping</span>';
    if (S.minOrder > 0 && t.sub < S.minOrder) hint += '<span class="hint">Minimum order is ' + money(S.minOrder) + '</span>';
    $('#cartSum').innerHTML =
      '<div><span>Items (' + t.n + ')</span><span>' + money(t.mrp) + '</span></div>' +
      '<div class="save"><span>Discount</span><span>−' + money(t.mrp - t.sub) + '</span></div>' +
      '<div><span>Shipping</span><span>' + (t.ship === null ? 'Confirmed on WhatsApp' : t.ship === 0 ? 'Free' : money(t.ship)) + '</span></div>' +
      '<div class="tot"><span>Total</span><span>' + money(t.total) + '</span></div>' + hint;
  }
  function openCart() {
    $('#orderDone').hidden = true;
    renderCart(); $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false'); $('#scrim').hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () { $('#cartClose').focus(); }, 50);
  }
  function closeCart() {
    $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true'); $('#scrim').hidden = true; document.body.style.overflow = '';
  }

  /* ---------- product detail ---------- */
  var cur = null, curD = 0;
  function openProduct(sku, push) {
    var p = BY[sku]; if (!p) return; cur = p; curD = 0;
    $('#pdTag').textContent = [p.cat === 'Towels' ? '' : p.cat, p.tag, '100% cotton'].filter(Boolean).join(' · ');
    $('#pdName').textContent = p.name;
    $('#pdPrice').innerHTML = priceHtml(p).replace('class="price"', 'class="price big"') + '<span class="muted small">Price per piece, inclusive of taxes</span>';
    var s = stockOf(p), el = $('#pdStock');
    el.className = 'stock' + (s <= 0 ? ' out' : s < low ? ' low' : '');
    el.textContent = s <= 0 ? 'Out of stock – tap below and we will message you when it is back' : s < low ? 'Only ' + s + ' left in stock' : 'In stock';
    var multi = p.img.length > 1;
    $('#pdDesignWrap').hidden = !multi;
    $('#pdThumbs').hidden = multi;
    $('#pdDesigns').innerHTML = p.img.map(function (im, i) { return '<button data-design="' + i + '" aria-label="' + esc(im.label) + '"><img src="' + img(im.s) + '" alt="" width="60" height="60" loading="lazy"></button>'; }).join('');
    $('#pdThumbs').innerHTML = '';
    var rows = [['Size', p.size + (p.sizeCm ? ' (' + p.sizeCm + ')' : '')], ['Weave', p.weave], ['Weight', p.gsm ? p.gsm + ' g per piece' : ''], ['Yarn count', p.yarn], ['Material', '100% cotton'], ['Product code', p.sku]];
    $('#pdSpecs').innerHTML = rows.filter(function (r) { return r[1]; }).map(function (r) { return '<tr><th>' + r[0] + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('');
    $('#pdDesc').textContent = p.desc || WEAVE[p.weave] || ({ Napkins: 'Soft, absorbent pure cotton napkin – handy for daily use, the kitchen, travel and school bags.', Towels: 'Pure cotton towel – absorbent, breathable and soft on skin. Gets softer with every wash.' })[p.cat] || '';
    $('#pdQty').value = 1; $('#pdQty').max = isFinite(s) ? Math.max(1, s) : 999;
    $('#pdAdd').hidden = s <= 0;
    $('#pdBuyNow').textContent = s <= 0 ? 'Notify me on WhatsApp' : 'Buy now on WhatsApp';
    $('.qty').hidden = s <= 0;
    pickDesign(0);
    var dlg = $('#pd');
    if (!dlg.open) { dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', ''); }
    dlg.scrollTop = 0; $('.pd-info').scrollTop = 0;
    if (push !== false) history.replaceState(null, '', '#p=' + encodeURIComponent(sku));
  }
  function pickDesign(i) {
    curD = i; var im = cur.img[i], big = $('#pdImg'), holder = $('#pdArt');
    big.hidden = !im; holder.hidden = !!im;
    if (!im) { holder.innerHTML = art(cur) + '<span class="soon-photo">Photo coming soon</span>'; return; }
    big.src = img(im.l); big.alt = cur.name + (cur.img.length > 1 ? ' – ' + im.label : '');
    $('#pdDesign').textContent = im.label;
    $$('#pdDesigns button').forEach(function (b, k) { b.classList.toggle('on', k === i); });
  }
  function closeProduct() {
    var dlg = $('#pd'); if (dlg.open) dlg.close ? dlg.close() : dlg.removeAttribute('open');
  }

  /* ---------- checkout ---------- */
  function newId() { var d = new Date(); return 'L2H-' + String(d.getFullYear()).slice(2) + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '-' + Math.floor(1000 + Math.random() * 9000); }
  function orderText(f, id) {
    var t = totals();
    var L = ['*New order – ' + (S.shop || 'Loom2hand') + '*', 'Order ID: ' + id, ''];
    cart.forEach(function (l, i) {
      var p = BY[l.sku], im = p.img[l.d] || p.img[0];
      L.push((i + 1) + '. ' + p.name + ' [' + p.sku + ']');
      L.push('   ' + p.size + (im && p.img.length > 1 ? ' | Design: ' + im.label : '') + ' | ' + l.qty + ' x ' + money(p.price) + ' = ' + money(l.qty * p.price));
    });
    L.push('', 'Items: ' + t.n + '   Subtotal: ' + money(t.sub) + ' (you save ' + money(t.mrp - t.sub) + ')');
    L.push('Shipping: ' + (t.ship === null ? 'please confirm' : t.ship === 0 ? 'Free' : money(t.ship)));
    L.push('*Total: ' + money(t.total) + (t.ship === null ? ' + shipping' : '') + '*', '');
    L.push('Name: ' + f.name, 'Mobile: ' + f.phone, 'Address: ' + f.addr, f.city + ' - ' + f.pin);
    if (f.email) L.push('Email: ' + f.email);
    if (f.note) L.push('Note: ' + f.note);
    return L.join('\n');
  }
  function submitOrder(e) {
    e.preventDefault();
    var fd = new FormData(e.target), f = {};
    ['name', 'phone', 'email', 'addr', 'city', 'pin', 'note', 'website'].forEach(function (k) { f[k] = String(fd.get(k) || '').trim(); });
    var err = '';
    var phone = f.phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
    if (!f.name) err = 'Please enter your name.';
    else if (!/^[6-9]\d{9}$/.test(phone)) err = 'Please enter a valid 10-digit mobile number.';
    else if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) err = 'Please check your email address.';
    else if (f.addr.length < 6) err = 'Please enter your full address.';
    else if (!f.city) err = 'Please enter your city.';
    else if (!/^\d{6}$/.test(f.pin)) err = 'Please enter a 6-digit pincode.';
    else if (S.minOrder > 0 && totals().sub < S.minOrder) err = 'Minimum order is ' + money(S.minOrder) + '.';
    $('#formErr').textContent = err;
    if (err) return;
    f.phone = phone;
    store.set('cust', { name: f.name, phone: f.phone, email: f.email, addr: f.addr, city: f.city, pin: f.pin });
    var id = newId(), t = totals();
    window.open(waLink(orderText(f, id)), '_blank', 'noopener');
    var mailed = sendOrderEmail(id, f);
    $('#doneId').textContent = id;
    $('#doneTotal').textContent = money(t.total) + (t.ship === null ? ' + shipping' : '');
    $('#doneMail').textContent = !mailed ? '' : f.email ? 'A PDF copy of your order is on its way to ' + f.email + '. If you don\'t see it in a few minutes, please check your Spam folder and mark it "Not spam".' : 'Add your email next time to get a PDF copy of your order.';
    $('#doneWa').href = waLink(orderText(f, id));
    cart = []; save(); updateBadge(); refreshCards(); renderCart();
    $('#cartEmpty').hidden = true; $('#orderDone').hidden = false;
    e.target.elements.note.value = '';
  }
  function sendOrderEmail(id, f) {
    if (!S.orderUrl) return false;
    var body = JSON.stringify({ id: id, website: f.website, customer: { name: f.name, phone: f.phone, email: f.email, addr: f.addr, city: f.city, pin: f.pin, note: f.note },
      items: cart.map(function (l) { var p = BY[l.sku], im = p.img[l.d]; return { sku: l.sku, qty: l.qty, design: im && p.img.length > 1 ? im.label : '' }; }) });
    try { fetch(S.orderUrl, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body }).catch(function () {}); return true; }
    catch (x) { try { return navigator.sendBeacon(S.orderUrl, new Blob([body], { type: 'text/plain' })); } catch (y) { return false; } }
  }
  function buyNow() {
    if (!cur) return;
    if (stockOf(cur) <= 0) { window.open(notifyLink(cur), '_blank', 'noopener'); return; }
    var q = Math.max(1, parseInt($('#pdQty').value, 10) || 1), im = cur.img[curD];
    var msg = 'Hi ' + (S.shop || 'Loom2hand') + ', I would like to order:\n' + cur.name + ' [' + cur.sku + ']\n' + cur.size + (cur.img.length > 1 ? ' | Design: ' + im.label : '') + '\nQty: ' + q + ' x ' + money(cur.price) + ' = ' + money(q * cur.price);
    window.open(waLink(msg), '_blank', 'noopener');
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open],[data-add],[data-inc],[data-dec],[data-tag],[data-cat],[data-cat-link],[data-design],[data-q],[data-linc],[data-ldec],[data-lrm],[data-close]');
    if (!t) return;
    var ds = t.dataset;
    if (ds.open) openProduct(ds.open);
    else if (ds.add) { add(ds.add, 0, 1); toast('Added to cart'); }
    else if (ds.inc) add(ds.inc, 0, 1);
    else if (ds.dec) setQty(ds.dec, 0, inCart(ds.dec, 0) - 1);
    else if (ds.tag !== undefined) { st.tag = ds.tag; renderChips(); renderGrid(); }
    else if (ds.cat || ds.catLink) { st.cat = ds.cat || ds.catLink; st.tag = ''; st.size = ''; renderChips(); renderGrid(); if (ds.cat) $('#shop').scrollIntoView({ behavior: 'smooth' }); }
    else if (ds.design) pickDesign(+ds.design);
    else if (ds.q) { var i = $('#pdQty'); i.value = Math.max(1, Math.min(+i.max || 999, (+i.value || 1) + +ds.q)); }
    else if (ds.linc || ds.ldec || ds.lrm) {
      var k = (ds.linc || ds.ldec || ds.lrm).split('|'), sku = k[0], d = +k[1];
      setQty(sku, d, ds.lrm ? 0 : inCart(sku, d) + (ds.linc ? 1 : -1));
    } else if (ds.close !== undefined) closeProduct();
  });
  $('#pd').addEventListener('close', function () { if (/^#p=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); });
  $('#pd').addEventListener('click', function (e) { if (e.target === this) closeProduct(); });
  $('#pdAdd').addEventListener('click', function () {
    add(cur.sku, curD, Math.max(1, parseInt($('#pdQty').value, 10) || 1));
    closeProduct(); openCart();
  });
  $('#pdBuyNow').addEventListener('click', buyNow);
  $$('[data-gift]').forEach(function (b) { b.addEventListener('click', function () { $('#gifts').scrollIntoView({ behavior: 'smooth' }); }); });
  $$('[data-occasion]').forEach(function (b) { b.addEventListener('click', function () { $('#giftOccasion').value = b.dataset.occasion; $('#giftForm').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function () { $('#giftForm [name=qty]').focus({ preventScroll: true }); }, 400); }); });
  $('#giftForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = {}; ['occasion', 'qty', 'budget', 'date', 'name', 'print', 'note'].forEach(function (k) { f[k] = String(e.target.elements[k].value || '').trim(); });
    if (!/^\d+$/.test(f.qty)) { $('#giftErr').textContent = 'Please enter how many gifts you need.'; return; }
    $('#giftErr').textContent = '';
    var d = f.date ? new Date(f.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    var L = ['*Gift enquiry – ' + (S.shop || 'Loom2hand') + '*', 'Occasion: ' + f.occasion, 'Quantity: ' + f.qty];
    if (f.budget) L.push('Budget per gift: ' + money(+f.budget.replace(/\D/g, '') || 0));
    if (d) L.push('Needed by: ' + d);
    if (f.print) L.push('Print: ' + f.print);
    if (f.note) L.push('Note: ' + f.note);
    if (f.name) L.push('Name: ' + f.name);
    window.open(waLink(L.join('\n')), '_blank', 'noopener');
    toast('Opening WhatsApp…');
  });
  $('#cartBtn').addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', closeCart);
  $('#scrim').addEventListener('click', closeCart);
  $('#doneShop').addEventListener('click', function () { closeCart(); $('#shop').scrollIntoView(); });
  $('#cartShop').addEventListener('click', function () { closeCart(); st.cat = 'Towels'; renderChips(); renderGrid(); $('#shop').scrollIntoView(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCart(); });
  $('#checkout').addEventListener('submit', submitOrder);
  var qt; $('#q').addEventListener('input', function () { clearTimeout(qt); var v = this.value; qt = setTimeout(function () { st.q = v; renderGrid(); }, 120); });
  $('#size').addEventListener('change', function () { st.size = this.value; renderGrid(); });
  $('#sort').addEventListener('change', function () { st.sort = this.value; renderGrid(); });
  $('#clearFilters').addEventListener('click', function () { st.q = ''; st.tag = ''; st.size = ''; $('#q').value = ''; renderChips(); renderGrid(); });
  $('#searchBtn').addEventListener('click', function () { $('#shop').scrollIntoView({ behavior: 'smooth' }); setTimeout(function () { $('#q').focus({ preventScroll: true }); }, 350); });
  window.addEventListener('hashchange', function () { var m = location.hash.match(/^#p=(.+)$/); if (m) openProduct(decodeURIComponent(m[1]), false); });

  /* ---------- init ---------- */
  (function init() {
    var towels = P.filter(function (p) { return p.cat === 'Towels'; }).length;
    $('#towelCount').textContent = towels + ' styles';
    ['Napkins', 'Jute Bags'].forEach(function (c) {
      var n = P.filter(function (p) { return p.cat === c; }).length;
      if (n) $('.cat-tile[data-cat="' + c + '"] small').textContent = n + ' styles';
    });
    var hi = 'Hi ' + (S.shop || 'Loom2hand') + ', ';
    $('#waFab').href = waLink(hi + 'I have a question.');
    $('#yr').textContent = new Date().getFullYear();
    var c = [];
    if (S.wa) c.push('<li><a href="' + waLink('') + '" target="_blank" rel="noopener">WhatsApp: ' + esc(S.phone || '+' + S.wa) + '</a></li>');
    if (S.phone) c.push('<li><a href="tel:' + esc(String(S.phone).replace(/\s/g, '')) + '">Call: ' + esc(S.phone) + '</a></li>');
    if (S.email) c.push('<li><a href="mailto:' + esc(S.email) + '">' + esc(S.email) + '</a></li>');
    if (S.instagram) c.push('<li><a href="' + esc(S.instagram) + '" target="_blank" rel="noopener">Instagram</a></li>');
    if (S.location) c.push('<li class="muted">' + esc(S.location) + '</li>');
    $('#contactList').innerHTML = c.join('');
    var cu = store.get('cust', null), form = $('#checkout');
    if (cu) Object.keys(cu).forEach(function (k) { if (form.elements[k]) form.elements[k].value = cu[k]; });
    renderChips(); refreshCards(); updateBadge();
    var m = location.hash.match(/^#p=(.+)$/); if (m) openProduct(decodeURIComponent(m[1]), false);
  })();
})();
