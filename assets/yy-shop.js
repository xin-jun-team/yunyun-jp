/* 云云代購 static shop engine — replaces WooCommerce cart/checkout/account/search ajax,
 * side-cart (xoo-wsc), mysticky contact form and the block price filter. Markup mirrors the originals. */
(function () {
  'use strict';
  var R = window.YY_ROOT || './';
  var D = window.YY_DATA || { products: {}, orders: {}, cats: {}, loop: {} };
  var D0 = { products: Object.assign({}, D.products), loop: Object.assign({}, D.loop), orders: JSON.parse(JSON.stringify(D.orders || {})) };
  var URL2ID = {}; Object.keys(D0.products).forEach(function (k) { URL2ID[D0.products[k].url] = k; });
  var C = window.YY_CONFIG || {};
  var SITE = new URL(R, location.href).href;
  var body = document.body;
  var qs = new URLSearchParams(location.search);
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var LS = {
    get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function amt(n) {
    return '<span class="woocommerce-Price-amount amount"><bdi><span class="woocommerce-Price-currencySymbol" translate="no" dir="auto">NT$</span>' + fmt(n) + '</bdi></span>';
  }
  function toRootRel(u) {
    if (!u) return '';
    var a = new URL(u, location.href).href;
    if (a.indexOf(SITE) === 0) a = a.slice(SITE.length);
    else a = a.replace(/^https?:\/\/yunyun-ec\.com\//, '');
    try { return decodeURI(a); } catch (e) { return a; }
  }
  function link(p) { p = String(p || '').replace(/["'<>\s]/g, encodeURIComponent); return /^(https?:|data:image\/)/.test(p) ? p : /^[a-z][a-z0-9+.-]*:/i.test(p) ? R : R + p; }
  function bodyId(prefix) { var m = body.className.match(new RegExp('\\b' + prefix + '(\\d+)\\b')); return m ? +m[1] : 0; }
  function zhDate(t) { var d = new Date(t); return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日'; }

  /* ================= cart store ================= */
  var CK = 'yy_cart_v1', CPK = 'yy_coupons_v1';
  function truePrice(i) {
    var st = stockOf(i.vid || i.pid);
    if (st && typeof st.price === 'number' && isFinite(st.price) && st.price >= 0) return st.price;
    var p = D.products[i.pid];
    if (p && i.vid) { var v = (p.vars || []).filter(function (x) { return String(x.id) === String(i.vid); })[0]; if (v && v.price >= 0) return +v.price; }
    if (p && !i.vid && p.price >= 0) return +p.price;
    return null;
  }
  function cart() {
    return (LS.get(CK, []) || []).filter(function (i) { return i && i.pid; }).map(function (i) {
      var tp = truePrice(i); i.price = tp !== null ? tp : Math.max(0, +i.price || 0);
      i.qty = Math.max(1, Math.min(999, i.qty | 0)); return i;
    });
  }
  function saveCart(c) { LS.set(CK, c); renderAll(); }
  function count(c) { return (c || cart()).reduce(function (s, i) { return s + i.qty; }, 0); }
  function subtotal(c) { return (c || cart()).reduce(function (s, i) { return s + i.qty * i.price; }, 0); }
  function itemTitle(i) { return i.name + (i.attrs && i.attrs.length ? ' - ' + i.attrs.map(function (a) { return a.value; }).join(', ') : ''); }
  function qtyInCart(id, exceptKey) { return cart().reduce(function (s, i) { return s + ((i.vid || i.pid) == id && i.key !== exceptKey ? i.qty : 0); }, 0); }
  function addItem(it) {
    var c = cart(), key = it.pid + '_' + (it.vid || 0) + '_' + (it.attrs || []).map(function (a) { return a.value; }).join('|');
    var bad = stockBlock(it, qtyInCart(it.vid || it.pid));
    if (bad) { alert(bad); return false; }
    var st = stockOf(it.vid || it.pid); if (st && st.price) it.price = st.price;
    var ex = c.filter(function (i) { return i.key === key; })[0];
    if (ex) ex.qty += it.qty; else { it.key = key; c.push(it); }
    saveCart(c);
    openSide();
    return true;
  }
  function setQty(key, q) {
    var c = cart(), cur = c.filter(function (i) { return i.key === key; })[0];
    if (cur && q > cur.qty) { var bad = stockBlock({ pid: cur.pid, vid: cur.vid, qty: q }, qtyInCart(cur.vid || cur.pid, key)); if (bad) { alert(bad); renderAll(); return; } }
    c = c.map(function (i) { if (i.key === key) i.qty = Math.max(0, q | 0); return i; }).filter(function (i) { return i.qty > 0; });
    saveCart(c);
  }

  /* coupons (yy-config.js, or the 折價券 sheet when gasUrl is set) */
  var CDK = 'yy_coupon_defs_v1';
  function coupons() { return LS.get(CPK, []); }
  function couponDef(code) {
    var m = C.coupons || {}, lc = String(code).toLowerCase();
    for (var k in m) if (k.toLowerCase() === lc) return { code: lc, d: m[k] };
    var g = LS.get(CDK, {}); if (g[lc]) return { code: lc, d: g[lc] };
    return null;
  }
  function discountOf(code, sub) {
    var c = couponDef(code); if (!c) return 0;
    if (c.d.min && sub < c.d.min) return 0;
    return Math.min(sub, c.d.type === 'percent' ? Math.round(sub * c.d.amount / 100) : c.d.amount);
  }
  function discounts(sub) { return coupons().map(function (k) { return { code: k, amount: discountOf(k, sub) }; }); }
  function applyCoupon(code) {
    code = String(code || '').trim();
    if (!code) return Promise.resolve({ err: '請輸入折價券代碼。' });
    if (coupons().indexOf(code.toLowerCase()) >= 0) return Promise.resolve({ err: '已套用折價券代碼！' });
    var p = GAS ? api('coupon', { code: code, subtotal: subtotal() }).then(function (j) {
      var g = LS.get(CDK, {}); g[j.coupon.code] = j.coupon; LS.set(CDK, g); return couponDef(j.coupon.code);
    }, function (er) { return { err: emsg(er) }; }) : Promise.resolve(couponDef(code));
    return p.then(function (c) {
      if (!c) return { err: '折價券「' + esc(code) + '」不存在！' };
      if (c.err) return c;
      if (c.d.min && subtotal() < c.d.min) return { err: '此折價券的最低消費金額為 ' + amt(c.d.min) + '。' };
      var l = coupons(); if (l.indexOf(c.code) >= 0) return { err: '已套用折價券代碼！' };
      l.push(c.code); LS.set(CPK, l); return { ok: '已成功套用折價券。' };
    });
  }
  function removeCoupon(code) { LS.set(CPK, coupons().filter(function (k) { return k !== code; })); }

  /* ================= side cart (xoo-wsc) ================= */
  function openSide() {
    var m = $('.xoo-wsc-modal'); if (!m) return;
    m.classList.add('xoo-wsc-cart-active'); body.classList.add('xoo-wsc-cart-active'); document.documentElement.classList.add('xoo-wsc-cart-active');
  }
  function closeSide() {
    var m = $('.xoo-wsc-modal'); if (m) m.classList.remove('xoo-wsc-cart-active');
    body.classList.remove('xoo-wsc-cart-active'); document.documentElement.classList.remove('xoo-wsc-cart-active');
  }
  function renderSide() {
    var c = cart(), n = count(c), sub = subtotal(c);
    $$('.xoo-wsc-items-count, .xoo-wscb-count').forEach(function (e) { e.textContent = n; });
    var bk = $('.xoo-wsc-basket'); if (bk) bk.style.display = n ? 'block' : 'none';
    var b = $('.xoo-wsc-body'), f = $('.xoo-wsc-footer');
    if (!b) return;
    if (!c.length) {
      b.innerHTML = '<div class="xoo-wsc-empty-cart"><span class="xoo-wsc-emp-txt">您的購物車是空的</span><a class="xoo-wsc-btn" href="' + R + 'shop/">返回購物</a></div>';
      if (f) f.innerHTML = '<div class="xoo-wsc-info-cont"></div><div class="xoo-wsc-ft-buttons-cont"> </div>';
      return;
    }
    b.innerHTML = '<div class="xoo-wsc-products xoo-wsc-pattern-row">' + c.map(function (i) {
      var dl = (i.attrs || []).map(function (a) { return '<dt class="variation-">' + esc(a.label) + ':</dt><dd class="variation-"><p>' + esc(a.value) + '</p></dd>'; }).join('');
      return '<div data-key="' + esc(i.key) + '" class="xoo-wsc-product"><div class="xoo-wsc-img-col"><a href="' + link(i.url) + '"><img width="400" height="400" src="' + link(i.img) + '" class="attachment-woocommerce_thumbnail size-woocommerce_thumbnail" alt="" decoding="async"></a></div>' +
        '<div class="xoo-wsc-sum-col"><div class="xoo-wsc-sm-info"><div class="xoo-wsc-sm-left"><span class="xoo-wsc-pname"><a href="' + link(i.url) + '">' + esc(i.name) + '</a></span>' +
        (dl ? '<dl class="variation">' + dl + '</dl>' : '') +
        '<div class="xoo-wsc-priceBox"><div class="xoo-wsc-pprice">Price: ' + amt(i.price) + '</div></div>' +
        '<div class="xoo-wsc-qty-box xoo-wsc-qtb-square"><span class="xoo-wsc-minus xoo-wsc-chng">-</span><input type="number" class="xoo-wsc-qty" step="1" min="0" max="" value="' + i.qty + '" placeholder="" inputmode="numeric" name="xoo-wsc-qty" title="Qty"><span class="xoo-wsc-plus xoo-wsc-chng">+</span></div></div>' +
        '<div class="xoo-wsc-sm-right"><span class="xoo-wsc-smr-del xoo-wsc-icon-trash"></span><span class="xoo-wsc-smr-ptotal">' + amt(i.price * i.qty) + '</span></div></div></div></div>';
    }).join('') + '</div>';
    if (f) f.innerHTML = '<div class="xoo-wsc-info-cont"></div><div class="xoo-wsc-ft-totals"><div class="xoo-wsc-ft-amt xoo-wsc-ft-amt-subtotal"><span class="xoo-wsc-ft-amt-label">小計</span><span class="xoo-wsc-ft-amt-value">' + amt(sub) + '</span></div></div>' +
      '<span class="xoo-wsc-footer-txt">以上金額未包含運費</span><div class="xoo-wsc-ft-buttons-cont"><a href="' + R + 'cart-2/" class="xoo-wsc-ft-btn xoo-wsc-btn xoo-wsc-ft-btn-cart">購物車明細</a><a href="' + R + 'checkout-2/" class="xoo-wsc-ft-btn xoo-wsc-btn xoo-wsc-ft-btn-checkout">結帳' + amt(sub) + '</a></div>';
  }

  /* ================= header cart / mini cart / handheld ================= */
  function renderHeader() {
    var c = cart(), n = count(c), sub = subtotal(c);
    $$('.site-header-cart .cart-contents').forEach(function (a) { a.innerHTML = ' ' + amt(sub) + ' <span class="count">' + n + ' 個項目</span> '; });
    $$('.footer-cart-contents .count').forEach(function (e) { e.textContent = n; });
    $$('.widget_shopping_cart_content').forEach(function (w) {
      if (!c.length) { w.innerHTML = '<p class="woocommerce-mini-cart__empty-message">購物車內沒有任何商品。</p>'; return; }
      w.innerHTML = '<ul class="woocommerce-mini-cart cart_list product_list_widget ">' + c.map(function (i) {
        return '<li class="woocommerce-mini-cart-item mini_cart_item"><a href="#" class="remove remove_from_cart_button" aria-label="從購物車移除「' + esc(itemTitle(i)) + '」" data-key="' + esc(i.key) + '">&times;</a>' +
          '<a href="' + link(i.url) + '"><img width="400" height="400" src="' + link(i.img) + '" class="attachment-woocommerce_thumbnail size-woocommerce_thumbnail" alt="" decoding="async">' + esc(i.name) + '</a>' +
          ((i.attrs || []).length ? '<dl class="variation">' + i.attrs.map(function (a) { return '<dt class="variation-">' + esc(a.label) + ':</dt><dd class="variation-"><p>' + esc(a.value) + '</p></dd>'; }).join('') + '</dl>' : '') +
          '<span class="quantity">' + i.qty + ' &times; ' + amt(i.price) + '</span></li>';
      }).join('') + '</ul><p class="woocommerce-mini-cart__total total"><strong>小計：</strong> ' + amt(sub) + '</p>' +
        '<p class="woocommerce-mini-cart__buttons buttons"><a href="' + R + 'cart-2/" class="button wc-forward">檢視購物車</a><a href="' + R + 'checkout-2/" class="button checkout wc-forward">結帳</a></p>';
    });
  }

  /* ================= notices ================= */
  function notice(wrap, html, type) {
    if (!wrap) return;
    var cls = type === 'error' ? '<ul class="woocommerce-error" role="alert"><li>' + html + '</li></ul>'
      : type === 'info' ? '<div class="woocommerce-info" role="status">' + html + '</div>'
        : '<div class="woocommerce-message" role="alert">' + html + '</div>';
    wrap.innerHTML = cls;
    try { wrap.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { }
  }

  /* ================= cart page ================= */
  var cartRoot = null, cartEmptyHTML = '', lastRemoved = null, prunedShown = false;
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }
  function totalsRows(sub, ship) {
    var ds = discounts(sub), disc = ds.reduce(function (s, d) { return s + d.amount; }, 0);
    var rows = '<tr class="cart-subtotal"><th>小計</th><td data-title="小計">' + amt(sub) + '</td></tr>';
    ds.forEach(function (d) {
      rows += '<tr class="cart-discount coupon-' + esc(d.code) + '"><th>折價券：' + esc(d.code) + '</th><td data-title="折價券：' + esc(d.code) + '">-' + amt(d.amount) + ' <a href="#" class="woocommerce-remove-coupon" data-coupon="' + esc(d.code) + '">[移除]</a></td></tr>';
    });
    rows += '<tr class="woocommerce-shipping-totals shipping"><th>貨物</th><td data-title="貨物">' + (ship ? ship.html : ' 輸入你的地址以檢視運送選項。 ') + '</td></tr>';
    var total = Math.max(0, sub - disc) + (ship && ship.cost || 0);
    rows += '<tr class="order-total"><th>總計</th><td data-title="總計"><strong>' + amt(total) + '</strong> </td></tr>';
    return { rows: rows, total: total, disc: disc, ds: ds };
  }
  function renderCartPage() {
    if (!cartRoot) return;
    var c = cart();
    var noticeHTML = cartRoot.querySelector('.woocommerce-notices-wrapper') ? cartRoot.querySelector('.woocommerce-notices-wrapper').innerHTML : '';
    var pend = ssGet('yy_pruned'); if (pend) { ssSet('yy_pruned', null); noticeHTML += pend; prunedShown = true; }
    if (!c.length) { cartRoot.innerHTML = cartEmptyHTML; var nw = cartRoot.querySelector('.woocommerce-notices-wrapper'); if (nw && noticeHTML && (lastRemoved || prunedShown)) nw.insertAdjacentHTML('afterbegin', noticeHTML); return; }
    var sub = subtotal(c), t = totalsRows(sub);
    cartRoot.innerHTML = '<div class="woocommerce-notices-wrapper">' + noticeHTML + '</div>' +
      '<form class="woocommerce-cart-form" action="" method="post"><table class="shop_table shop_table_responsive cart woocommerce-cart-form__contents" cellspacing="0"><thead><tr>' +
      '<th scope="col" class="product-remove"><span class="screen-reader-text">移除商品</span></th><th scope="col" class="product-thumbnail"><span class="screen-reader-text">縮圖圖片</span></th>' +
      '<th scope="col" class="product-name">商品</th><th scope="col" class="product-price">價格</th><th scope="col" class="product-quantity">數量</th><th scope="col" class="product-subtotal">小計</th></tr></thead><tbody>' +
      c.map(function (i) {
        var t = esc(itemTitle(i));
        return '<tr class="woocommerce-cart-form__cart-item cart_item"><td class="product-remove"><a role="button" href="#" class="remove" aria-label="從購物車移除「' + t + '」" data-key="' + esc(i.key) + '" data-product_id="' + i.pid + '">×</a></td>' +
          '<td class="product-thumbnail"><a href="' + link(i.url) + '"><img decoding="async" width="300" height="300" src="' + link(i.img) + '" class="attachment-woocommerce_thumbnail size-woocommerce_thumbnail" alt="' + t + '"></a></td>' +
          '<td role="rowheader" class="product-name" data-title="商品"><a href="' + link(i.url) + '">' + t + '</a></td>' +
          '<td class="product-price" data-title="價格">' + amt(i.price) + '</td>' +
          '<td class="product-quantity" data-title="數量"><div class="quantity"><label class="screen-reader-text">' + t + ' 數量</label><input type="number" class="input-text qty text" data-key="' + esc(i.key) + '" value="' + i.qty + '" aria-label="商品數量" min="0" step="1" inputmode="numeric" autocomplete="off"></div></td>' +
          '<td class="product-subtotal" data-title="小計">' + amt(i.price * i.qty) + '</td></tr>';
      }).join('') +
      '<tr><td colspan="6" class="actions"><div class="coupon"><label for="coupon_code" class="screen-reader-text">折價券:</label><input type="text" name="coupon_code" class="input-text" id="coupon_code" value="" placeholder="折價券"> <button type="submit" class="button" name="apply_coupon" value="使用折價券">使用折價券</button></div>' +
      '<button type="submit" class="button" name="update_cart" value="更新購物車" disabled>更新購物車</button></td></tr></tbody></table></form>' +
      '<div class="cart-collaterals"><div class="cart_totals "><h2>購物車總計</h2><table cellspacing="0" class="shop_table shop_table_responsive"><tbody>' + t.rows + '</tbody></table>' +
      '<div class="wc-proceed-to-checkout"><a href="' + R + 'checkout-2/" class="checkout-button button alt wc-forward"> 前往結帳</a></div></div></div>';
  }
  function initCartPage() {
    if (!body.classList.contains('woocommerce-cart')) return;
    var ec = $('#primary .entry-content'); if (!ec) return;
    cartRoot = ec.querySelector('.woocommerce'); if (!cartRoot) return;
    cartEmptyHTML = cartRoot.innerHTML;
    cartRoot.addEventListener('input', function (e) { if (e.target.matches('input.qty')) { var b = cartRoot.querySelector('[name=update_cart]'); if (b) b.disabled = false; } });
    cartRoot.addEventListener('click', function (e) {
      var nw = function () { return cartRoot.querySelector('.woocommerce-notices-wrapper'); };
      var rm = e.target.closest('a.remove');
      if (rm) {
        e.preventDefault();
        var it = cart().filter(function (i) { return i.key === rm.dataset.key; })[0];
        lastRemoved = it;
        setQty(rm.dataset.key, 0);
        notice(nw(), '已移除「' + esc(it ? itemTitle(it) : '') + '」。 <a href="#" class="restore-item">復原？</a>');
        return;
      }
      if (e.target.closest('.restore-item')) {
        e.preventDefault();
        if (lastRemoved) { var c = cart(); c.push(lastRemoved); lastRemoved = null; saveCart(c); }
        nw().innerHTML = ''; return;
      }
      var rc = e.target.closest('.woocommerce-remove-coupon');
      if (rc) { e.preventDefault(); removeCoupon(rc.dataset.coupon); renderAll(); notice(nw(), '已移除折價券。'); return; }
      var btn = e.target.closest('button[name=apply_coupon]');
      if (btn) {
        e.preventDefault();
        btn.disabled = true;
        applyCoupon(cartRoot.querySelector('#coupon_code').value).then(function (r) { btn.disabled = false; renderAll(); notice(nw(), r.err || r.ok, r.err ? 'error' : 'ok'); });
        return;
      }
      var up = e.target.closest('button[name=update_cart]');
      if (up) {
        e.preventDefault();
        var c2 = cart();
        $$('input.qty', cartRoot).forEach(function (inp) { c2.forEach(function (i) { if (i.key === inp.dataset.key) i.qty = Math.max(0, parseInt(inp.value, 10) || 0); }); });
        saveCart(c2.filter(function (i) { return i.qty > 0; }));
        notice(nw(), '購物車已更新。');
      }
    });
    cartRoot.addEventListener('submit', function (e) { e.preventDefault(); });
    renderCartPage();
  }

  /* ================= add to cart ================= */
  function attrLabel(form, name) {
    var sel = form.querySelector('select[name="' + name + '"]');
    if (sel) { var l = form.querySelector('label[for="' + sel.id + '"]'); if (l) return l.textContent.trim(); }
    try { return decodeURIComponent(name.replace(/^attribute_(pa_)?/, '')); } catch (e) { return name; }
  }
  function onSingleSubmit(form) {
    var qty = parseInt((form.querySelector('input.qty') || {}).value, 10) || 1;
    var pid = +(form.dataset.product_id || (form.querySelector('[name=add-to-cart]') || {}).value || bodyId('postid-'));
    var p = D.products[pid] || {};
    var name = p.name || ((($('.product_title') || {}).textContent) || '').trim();
    var url = p.url || toRootRel(location.href.split('?')[0]);
    var it = { pid: pid, vid: 0, name: name, url: url, img: p.img, price: p.price, qty: qty, attrs: [] };
    if (form.classList.contains('variations_form')) {
      var vid = +((form.querySelector('input.variation_id') || {}).value || 0);
      var vars = [];
      try { vars = JSON.parse(form.getAttribute('data-product_variations')) || []; } catch (e) { }
      var v = vars.filter(function (x) { return x.variation_id === vid; })[0];
      if (!vid || !v) { alert('請先選擇商品選項，再將此商品加入購物車。'); return; }
      it.vid = vid; it.price = v.display_price;
      if (v.image && v.image.thumb_src) it.img = toRootRel(v.image.thumb_src);
      $$('table.variations select', form).forEach(function (sel) {
        var o = sel.options[sel.selectedIndex];
        if (sel.value) it.attrs.push({ label: attrLabel(form, sel.name), value: (o ? o.textContent : sel.value).trim() });
      });
    }
    if (!it.price && it.price !== 0) { var pe = $('.summary .price bdi'); it.price = pe ? +pe.textContent.replace(/[^\d]/g, '') : 0; }
    addItem(it);
  }
  function addSimple(pid, qty) {
    var p = D.products[pid]; if (!p) return false;
    return addItem({ pid: +pid, vid: 0, name: p.name, url: p.url, img: p.img, price: p.price, qty: qty || 1, attrs: [] });
  }

  /* ================= archives: search / sort / price filter / paging ================= */
  function descendants(id) {
    var out = [id], changed = true;
    while (changed) {
      changed = false;
      for (var k in D.cats) if (out.indexOf(+D.cats[k].parent) >= 0 && out.indexOf(+k) < 0) { out.push(+k); changed = true; }
    }
    return out;
  }
  function contextIds() {
    var ids = Object.keys(D.products).map(Number), term = bodyId('term-');
    if (body.classList.contains('tax-product_cat') && term) {
      var set = descendants(term);
      ids = ids.filter(function (i) { return (D.products[i].cats || []).some(function (c) { return set.indexOf(+c) >= 0; }); });
    } else if (body.classList.contains('tax-product_brand') && term) {
      ids = ids.filter(function (i) { return (D.products[i].brands || []).indexOf(term) >= 0; });
    }
    return ids;
  }
  function archiveBase() { return location.pathname.replace(/page\/\d+\/?$/, ''); }
  function renderArchive() {
    var ul = $('#primary ul.products'); if (!ul) return;
    var isArchive = body.classList.contains('post-type-archive-product') || body.classList.contains('tax-product_cat') || body.classList.contains('tax-product_brand') || body.classList.contains('woocommerce-shop');
    if (!isArchive) return;
    var s = (qs.get('s') || '').trim(), ob = qs.get('orderby') || '', mn = qs.get('min_price'), mx = qs.get('max_price');
    var sel = $('.woocommerce-ordering select.orderby');
    $$('.woocommerce-ordering').forEach(function (f) {
      ['s', 'post_type', 'min_price', 'max_price'].forEach(function (k) {
        if (qs.get(k) && !f.querySelector('[name=' + k + ']')) f.insertAdjacentHTML('beforeend', '<input type="hidden" name="' + k + '" value="' + esc(qs.get(k)) + '">');
      });
    });
    if (!s && !ob && mn == null && mx == null && !qs.get('paged') && !Object.keys(NP).length && !Object.keys(OFF).length) return;
    if (sel && ob) sel.value = ob;
    var ids = contextIds();
    if (s) {
      var terms = s.toLowerCase().split(/\s+/).filter(Boolean);
      ids = ids.filter(function (i) { var t = (D.products[i].name + ' ' + D.products[i].search).toLowerCase(); return terms.every(function (w) { return t.indexOf(w) >= 0; }); });
      if (ids.length === 1 && !ob && catDone) { location.replace(link(D.products[ids[0]].url)); return; }
    }
    if (mn != null || mx != null) {
      var lo = +(mn || 0), hi = mx ? +mx : Infinity;
      ids = ids.filter(function (i) { var p = D.products[i].price; return p >= lo && p <= hi; });
    }
    var order = (D.orders[ob || 'menu_order'] || D.orders.menu_order || []).map(Number);
    ids.sort(function (a, b) { var x = order.indexOf(a), y = order.indexOf(b); return (x < 0 ? 1e9 : x) - (y < 0 ? 1e9 : y); });
    var per = 12, total = ids.length, pages = Math.max(1, Math.ceil(total / per));
    var page = Math.min(pages, Math.max(1, parseInt(qs.get('paged') || (location.pathname.match(/page\/(\d+)/) || [])[1] || 1, 10)));
    if (ob || s || mn != null || mx != null) { if (!qs.get('paged') || qs.get('paged') === '1') page = Math.max(1, parseInt(qs.get('paged') || 1, 10)); }
    var slice = ids.slice((page - 1) * per, page * per);
    var cols = +((ul.className.match(/columns-(\d+)/) || [])[1] || 3);
    if (s) {
      var h1 = $('.woocommerce-products-header__title'); if (h1) h1.textContent = '搜尋結果：「' + s + '」';
      document.title = '「' + s + '」的搜尋結果 – ' + document.title.split('–').pop().trim();
      var bc = $('.woocommerce-breadcrumb'); if (bc) bc.innerHTML = '<a href="' + R + '">首頁</a><span class="breadcrumb-separator"> / </span>「' + esc(s) + '」的搜尋結果';
    }
    $$('.yy-nores').forEach(function (e) { e.remove(); });
    ul.style.display = '';
    $$('.woocommerce-result-count, .woocommerce-pagination').forEach(function (e) { e.style.display = ''; });
    if (!total) {
      ul.style.display = 'none';
      ul.insertAdjacentHTML('afterend', '<div class="woocommerce-no-products-found yy-nores"><div class="woocommerce-info" role="status">找不到符合選取條件的商品。</div></div>');
      $$('.woocommerce-result-count, .woocommerce-pagination').forEach(function (e) { e.style.display = 'none'; });
      return;
    }
    ul.innerHTML = slice.map(function (id, idx) {
      var li = (D.loop[id] || '').split('{R}').join(R);
      var cls = idx % cols === 0 ? ' first' : (idx % cols === cols - 1 ? ' last' : '');
      return li.replace(/^<li class="product /, '<li class="product' + cls + ' ');
    }).join('');
    var rcTxt = total === 1 ? '顯示單一結果' : total <= per ? '顯示全部 ' + total + ' 項結果' : '顯示第 ' + ((page - 1) * per + 1) + ' 至 ' + Math.min(total, page * per) + ' 項結果，共 ' + total + ' 項';
    $$('.woocommerce-result-count').forEach(function (rc) { var n = rc.cloneNode(false); n.textContent = rcTxt; rc.parentNode.replaceChild(n, rc); });
    var base = archiveBase();
    function purl(n) { var q = new URLSearchParams(location.search); q.set('paged', n); return base + '?' + q.toString(); }
    var navs = $$('nav.woocommerce-pagination');
    var navHTML = '';
    if (pages > 1) {
      navHTML = '<ul class="page-numbers">';
      if (page > 1) navHTML += '<li><a class="prev page-numbers" href="' + purl(page - 1) + '">&larr;</a></li>';
      for (var n = 1; n <= pages; n++) navHTML += n === page ? '<li><span aria-label="第 ' + n + ' 頁" aria-current="page" class="page-numbers current">' + n + '</span></li>' : '<li><a aria-label="第 ' + n + ' 頁" class="page-numbers" href="' + purl(n) + '">' + n + '</a></li>';
      if (page < pages) navHTML += '<li><a class="next page-numbers" href="' + purl(page + 1) + '">&rarr;</a></li>';
      navHTML += '</ul>';
    }
    if (navs.length) navs.forEach(function (nv) { nv.innerHTML = navHTML; nv.style.display = navHTML ? '' : 'none'; });
    else if (navHTML) { var after = $('.storefront-sorting:last-of-type') || ul; after.insertAdjacentHTML('afterend', '<nav class="woocommerce-pagination" aria-label="商品分頁">' + navHTML + '</nav>'); }
  }

  function initPriceFilter() {
    var onArchive = $('#primary ul.products') && (body.classList.contains('tax-product_cat') || body.classList.contains('tax-product_brand') || body.classList.contains('post-type-archive-product'));
    if (!onArchive) {  // the original block renders nothing outside product archives
      $$('.wp-block-woocommerce-filter-wrapper[data-filter-type="price-filter"]').forEach(function (w) { $$('h3, .wp-block-woocommerce-price-filter', w).forEach(function (x) { x.style.display = 'none'; }); });
      return;
    }
    $$('.wp-block-woocommerce-price-filter').forEach(function (w) {
      var prices = Object.keys(D.products).map(function (k) { return D.products[k].price; }).filter(function (p) { return p > 0; });
      if (!prices.length) return;
      var lo = Math.floor(Math.min.apply(null, prices) / 10) * 10, hi = Math.ceil(Math.max.apply(null, prices) / 10) * 10;
      var cmn = +(qs.get('min_price') || lo), cmx = +(qs.get('max_price') || hi);
      w.classList.remove('is-loading');
      w.innerHTML = '<div class="yy-pf"><div class="yy-pf-track"><div class="yy-pf-fill"></div>' +
        '<input type="range" class="yy-pf-r yy-pf-min" min="' + lo + '" max="' + hi + '" step="10" value="' + cmn + '" aria-label="篩選最低價格">' +
        '<input type="range" class="yy-pf-r yy-pf-max" min="' + lo + '" max="' + hi + '" step="10" value="' + cmx + '" aria-label="篩選最高價格"></div>' +
        '<div class="yy-pf-ctrl"><input type="text" class="yy-pf-amt yy-pf-amt-min" value="NT$' + fmt(cmn) + '" aria-label="篩選最低價格"><input type="text" class="yy-pf-amt yy-pf-amt-max" value="NT$' + fmt(cmx) + '" aria-label="篩選最高價格">' +
        '<button type="button" class="yy-pf-btn">篩選</button></div></div>';
      var a = w.querySelector('.yy-pf-min'), b = w.querySelector('.yy-pf-max'), fill = w.querySelector('.yy-pf-fill'), ta = w.querySelector('.yy-pf-amt-min'), tb = w.querySelector('.yy-pf-amt-max');
      function sync(src) {
        var x = +a.value, y = +b.value;
        if (x > y) { if (src === a) a.value = y; else b.value = x; x = +a.value; y = +b.value; }
        fill.style.left = ((x - lo) / (hi - lo) * 100) + '%'; fill.style.right = (100 - (y - lo) / (hi - lo) * 100) + '%';
        ta.value = 'NT$' + fmt(x); tb.value = 'NT$' + fmt(y);
      }
      a.addEventListener('input', function () { sync(a); }); b.addEventListener('input', function () { sync(b); });
      [ta, tb].forEach(function (t, k) { t.addEventListener('change', function () { var v = +t.value.replace(/[^\d]/g, ''); (k ? b : a).value = v; sync(k ? b : a); }); });
      sync();
      w.querySelector('.yy-pf-btn').addEventListener('click', function () {
        var isArch = $('#primary ul.products') && (body.classList.contains('tax-product_cat') || body.classList.contains('tax-product_brand') || body.classList.contains('post-type-archive-product'));
        var q = new URLSearchParams(isArch ? location.search : '');
        q.delete('paged'); q.set('min_price', a.value); q.set('max_price', b.value);
        location.href = (isArch ? archiveBase() : R + 'shop/') + '?' + q.toString();
      });
    });
  }

  /* ================= recently viewed ================= */
  var RVK = 'yy_recent_v1';
  function refreshRecent() { var o = $('[data-yy=recent]'); if (o) o.remove(); initRecent(); }
  function initRecent() {
    var pid = body.classList.contains('single-product') ? bodyId('postid-') : 0;
    var l = LS.get(RVK, []);
    if (pid && D.products[pid]) { l = [pid].concat(l.filter(function (x) { return x !== pid; })).slice(0, 15); LS.set(RVK, l); }
    l = l.filter(function (x) { return D.products[x]; }).slice(0, 10);
    var sec = $('#secondary'); if (!sec || !l.length || $('.widget_recently_viewed_products:not([data-yy])', sec)) return;
    sec.insertAdjacentHTML('beforeend', '<div id="woocommerce_recently_viewed_products-2" data-yy="recent" class="widget woocommerce widget_recently_viewed_products"><span class="gamma widget-title">近期瀏覽商品</span><ul class="product_list_widget">' +
      l.map(function (id) {
        var p = D.products[id];
        return '<li><a href="' + link(p.url) + '"><img width="400" height="400" src="' + link(p.img) + '" class="attachment-woocommerce_thumbnail size-woocommerce_thumbnail" alt="' + esc(p.name) + '" decoding="async" loading="lazy"><span class="product-title">' + esc(p.name) + '</span></a>' + (p.price_html || '') + '</li>';
      }).join('') + '</ul></div>');
  }

  /* ================= backend (Google Apps Script + 試算表；未設定 gasUrl 時為瀏覽器展示模式) ================= */
  var GAS = C.gasUrl || '';
  var DEMO = GAS === 'demo';   // 展示模式：不用試算表，真正的後端程式在瀏覽器裡執行（資料只存在這台裝置）
  var SK = 'yy_session_v1';
  var demoP = null;
  function demoEngine() {
    if (!demoP) demoP = window.YY_DEMO ? Promise.resolve(window.YY_DEMO) : new Promise(function (ok, no) {
      window.YY_DEMO_ROOT = SITE;
      var sc = document.createElement('script'); sc.src = R + 'assets/yy-demo.js';
      sc.onload = function () { window.YY_DEMO ? ok(window.YY_DEMO) : no(new Error('demo')); };
      sc.onerror = function () { demoP = null; no(new Error('demo')); };
      document.head.appendChild(sc);
    });
    return demoP;
  }
  function transport(data) {
    if (DEMO) return demoEngine().then(function (E) { return new Promise(function (ok) { setTimeout(function () { ok(JSON.stringify(E.post(data))); }, 200); }); });
    return fetch(GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) }).then(function (r) { return r.text(); });
  }
  function session() { return LS.get(SK, null); }
  function api(action, data) {
    data = data || {}; data.action = action;
    var s = session(); if (s && s.token && data.token === undefined) data.token = s.token;
    var fail = function (m) { var e = new Error(m); e.plain = true; throw e; };
    return transport(data)
      .then(function (t) { return t; }, function () { fail('網路連線失敗，請稍後再試。'); })
      .then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) { }
        if (!j) fail('系統忙碌中，請稍後再試。');
        if (!j.ok) { if (/重新登入|逾時/.test(j.error || '') && action !== 'login') localStorage.removeItem(SK); fail(j.error || '系統忙碌中，請稍後再試。'); }
        return j;
      });
  }
  function emsg(er) { return er && er.plain ? esc(er.message) : (er && er.message) || '發生錯誤，請稍後再試。'; }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return 'h' + (h >>> 0).toString(36); }
  var Auth = {
    login: function (u, p) {
      if (GAS) return api('login', { email: u, password: p, token: '' })
        .then(function (j) { LS.set(SK, { email: j.email, token: j.token }); LS.set('yy_profile_' + j.email, j.profile || {}); });
      var users = LS.get('yy_users', {}), k = String(u).toLowerCase(), x = users[k];
      if (!x) return Promise.reject(new Error('使用者名稱或電子郵件 ' + esc(u) + ' 尚未在網站中註冊。如果你不確定使用者名稱，請改用電子郵件地址登入。'));
      if (x.pass !== hash(p)) return Promise.reject(new Error('使用者名稱或電子郵件 ' + esc(u) + ' 的密碼不正確。 <a href="' + R + 'my-account/lost-password/">忘記密碼？</a>'));
      LS.set(SK, { email: k }); return Promise.resolve();
    },
    register: function (e, p) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return Promise.reject(new Error('請提供有效的電子郵件地址。'));
      if (!p) return Promise.reject(new Error('請輸入帳號密碼。'));
      if (GAS) return api('register', { email: e, password: p, token: '' })
        .then(function (j) { LS.set(SK, { email: j.email, token: j.token }); return j; });
      var users = LS.get('yy_users', {}), k = e.toLowerCase();
      if (users[k]) return Promise.reject(new Error('已有帳號使用您的電子郵件地址註冊。<a href="#" class="showlogin">請登入。</a>'));
      users[k] = { email: k, pass: hash(p), created: Date.now() }; LS.set('yy_users', users); LS.set(SK, { email: k }); return Promise.resolve({});
    },
    logout: function () { localStorage.removeItem(SK); },
    profile: function () { var s = session(); if (!s) return {}; return LS.get('yy_profile_' + s.email, {}); },
    cacheProfile: function (p) { var s = session(); if (s) LS.set('yy_profile_' + s.email, p); },
    saveProfile: function (p) {
      Auth.cacheProfile(p);
      return GAS && session() ? api('save_profile', { profile: p }).then(function (j) { Auth.cacheProfile(j.profile); }) : Promise.resolve();
    },
    changePassword: function (old, np) {
      if (GAS) return api('change_password', { old: old, password: np });
      var s = session(), u = LS.get('yy_users', {});
      if (u[s.email] && u[s.email].pass !== hash(old)) return Promise.reject(new Error('目前密碼不正確。'));
      if (u[s.email]) { u[s.email].pass = hash(np); LS.set('yy_users', u); }
      return Promise.resolve();
    },
    refresh: function () {
      if (!GAS || !session()) return Promise.resolve();
      return api('me').then(function (j) { Auth.cacheProfile(j.profile || {}); });
    }
  };
  function saveOrderLocal(o) { var l = LS.get('yy_orders', []); l.push(o); LS.set('yy_orders', l.slice(-50)); }
  function myOrders() {
    var s = session(); if (!s) return Promise.resolve([]);
    if (GAS) return api('my_orders').then(function (j) { return j.orders || []; });
    return Promise.resolve(LS.get('yy_orders', []).filter(function (o) { return (o.billing.billing_email || '').toLowerCase() === s.email || o.account === s.email; }).reverse());
  }

  /* ---------- 即時庫存（商品庫存分頁）：自動顯示已售完、限制購買數量 ---------- */
  var STK = 'yy_stock_v2', stockMap = null, catProducts = [], catOff = [];
  var SOLD_HTML = '<p class="stock out-of-stock">已售完</p>';
  function cachedCatalog() {
    var c = null; try { c = JSON.parse(sessionStorage.getItem(STK)); } catch (e) { }
    return c && c.j && Date.now() - c.t < 60000 ? c.j : null;
  }
  function gotCatalog(j) {
    if (!j || !j.ok || !j.items) return null;
    stockMap = j.items; catProducts = Array.isArray(j.products) ? j.products : []; catOff = Array.isArray(j.off) ? j.off.map(String) : [];
    return stockMap;
  }
  function loadStock(force) {
    if (!GAS) return Promise.resolve(null);
    if (DEMO) return demoEngine().then(function (E) { return gotCatalog(E.get({ action: 'catalog' })); }, function () { return null; });
    var c = cachedCatalog();
    if (!force && c) return Promise.resolve(gotCatalog(c));
    var timeout = new Promise(function (ok) { setTimeout(function () { ok(null); }, 15000); });
    return Promise.race([timeout, fetch(GAS + (GAS.indexOf('?') < 0 ? '?' : '&') + 'action=catalog').then(function (r) { return r.json(); }).then(function (j) {
      if (!gotCatalog(j)) return null;
      try { sessionStorage.setItem(STK, JSON.stringify({ t: Date.now(), j: j })); } catch (e) { }
      return stockMap;
    }, function () { return null; })]);
  }
  function stockOf(id) {
    var s = stockMap && stockMap[String(id)]; if (!s) return null;
    return { ok: !!s[0] && !(s[1] !== null && s[1] <= 0), qty: s[1], price: s[2] };
  }
  function stockBlock(it, inCart) {
    var s = stockOf(it.vid || it.pid); if (!s) return '';
    if (!s.ok) return '很抱歉，此商品已售完。';
    if (s.qty !== null && inCart + it.qty > s.qty) return '很抱歉，此商品庫存不足（目前剩 ' + s.qty + ' 件' + (inCart ? '，購物車已有 ' + inCart + ' 件' : '') + '）。';
    return '';
  }
  function applyStock() {
    if (!stockMap) return;
    var jq = window.jQuery;
    $$('form.variations_form').forEach(function (f) {
      var fix = function (v) {
        var s = stockOf(v.variation_id); if (!s) return;
        if (!s.ok) { v.is_in_stock = false; v.availability_html = SOLD_HTML; return; }
        v.is_in_stock = true;
        v.availability_html = s.qty !== null ? '<p class="stock in-stock">' + s.qty + ' 件庫存</p>' : '';
        if (s.qty !== null) v.max_qty = s.qty;
        if (s.price && s.price !== v.display_price) { v.display_price = v.display_regular_price = s.price; v.price_html = '<span class="price">' + amt(s.price) + '</span>'; }
      };
      var list = null; try { list = JSON.parse(f.getAttribute('data-product_variations')); } catch (e) { }
      if (Array.isArray(list)) { list.forEach(fix); f.setAttribute('data-product_variations', JSON.stringify(list)); }
      var jl = jq ? jq(f).data('product_variations') : null;
      if (Array.isArray(jl) && jl !== list) jl.forEach(fix);
      if (jq) jq(f).trigger('check_variations');
    });
    var pid = bodyId('postid-'), p = D.products[pid];
    if (!body.classList.contains('single-product') || !p || p.type === 'variable') return;
    var s = stockOf(pid); if (!s) return;
    var sum = $('.summary.entry-summary') || $('.summary'); if (!sum) return;
    var form = $('form.cart', sum), sold = $('p.stock.out-of-stock', sum);
    if (!s.ok) {
      if (form) form.style.display = 'none';
      if (!sold) (form || $('.woocommerce-product-details__short-description', sum) || $('p.price', sum)).insertAdjacentHTML(form ? 'beforebegin' : 'afterend', SOLD_HTML);
    } else {
      if (sold) sold.remove();
      $$('p.stock.in-stock', sum).forEach(function (x) { x.remove(); });
      if (form) {
        form.style.display = '';
        if (s.qty !== null) { form.insertAdjacentHTML('beforebegin', '<p class="stock in-stock">' + s.qty + ' 件庫存</p>'); var qi = $('input.qty', form); if (qi) qi.max = s.qty; }
      }
      else {
        var anchor = $('.woocommerce-product-details__short-description', sum) || $('p.price', sum);
        if (anchor) anchor.insertAdjacentHTML('afterend', '<form class="cart" method="post"><div class="quantity"><input type="number" class="input-text qty text" name="quantity" value="1" aria-label="商品數量" min="1"' + (s.qty !== null ? ' max="' + s.qty + '"' : '') + ' step="1" inputmode="numeric"></div> <button type="submit" name="add-to-cart" value="' + pid + '" class="single_add_to_cart_button button alt">加入購物車</button></form>');
      }
    }
    if (s.price && s.price !== p.price) { var pe = $('p.price', sum); if (pe) pe.innerHTML = amt(s.price); }
  }

  /* ---------- 後台「商品上架」新增的商品：自動產生商品卡片與商品頁（p/?id=商品ID） ---------- */
  var NP = {}, OFF = {}, npSig = '[[],[]]', npShown = false;
  function npImg(u) {
    u = String(u || '');
    return /^https:\/\/[^\s"'<>]+$/.test(u) || /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(u) || (/^wp-content\/uploads\/[^"'<>?#\\]+$/.test(u) && u.indexOf('..') < 0) ? u : '';
  }
  function npSrc(u) { return /^wp-content\//.test(u) ? link(u) : u; }   // 原站圖片存的是網站內路徑
  function npSlug(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function catChain(id) {
    var out = [], c = D.cats[id], n = 0;
    while (c && n++ < 8) { out.unshift({ id: id, name: c.name, slug: npSlug(c.slug) }); id = c.parent; c = D.cats[id]; }
    return out.map(function (x, i) { x.url = 'product-category/' + out.slice(0, i + 1).map(function (y) { return y.slug; }).join('/') + '/'; return x; });
  }
  function npPrices(p) {
    var ps = p.vars.length ? p.vars.map(function (v) { var s = stockOf(v.id); return s && s.price ? s.price : v.price; }) : [(stockOf(p.id) || {}).price || p.price];
    return { lo: Math.min.apply(null, ps), hi: Math.max.apply(null, ps) };
  }
  function npInStock(p) {
    var ok = function (id) { var s = stockOf(id); return !s || s.ok; };
    return p.vars.length ? p.vars.some(function (v) { return ok(v.id); }) : ok(p.id);
  }
  function npSale(p) { var r = npPrices(p); return p.was && r.lo === r.hi && p.was > r.lo; }
  function npPriceHtml(p) {
    var r = npPrices(p);
    if (r.lo !== r.hi) return amt(r.lo) + ' <span aria-hidden="true">–</span> ' + amt(r.hi) + '<span class="screen-reader-text">價格範圍：NT$' + fmt(r.lo) + ' 到 NT$' + fmt(r.hi) + '</span>';
    if (npSale(p)) return '<del aria-hidden="true">' + amt(p.was) + '</del> <span class="screen-reader-text">原始價格：NT$' + fmt(p.was) + '。</span><ins aria-hidden="true">' + amt(r.lo) + '</ins><span class="screen-reader-text">目前價格：NT$' + fmt(r.lo) + '。</span>';
    return amt(r.lo);
  }
  // 商品介紹：空一行＝新段落、**粗體**、--- 分隔線、### 小標題
  function npInline(b) { return esc(b).replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />\n'); }
  function npText(t) {
    return String(t || '').replace(/\r/g, '').split(/\n{2,}/).map(function (b) { return b.trim(); }).filter(Boolean).map(function (b) {
      if (/^-{3,}$/.test(b)) return '<hr />';
      if (/^###\s+/.test(b)) return '<h3>' + npInline(b.replace(/^###\s+/, '')) + '</h3>';
      return '<p>' + npInline(b) + '</p>';
    }).join('\n');
  }
  function npCard(id) {
    var p = NP[id], P = D.products[id], u = '{R}' + P.url, nm = esc(p.name), varb = P.type === 'variable';
    var cls = 'product type-product post-' + id + ' status-publish ' + (P.stock ? 'instock' : 'outofstock') + (npSale(p) ? ' sale' : '') + ' has-post-thumbnail shipping-taxable purchasable product-type-' + P.type + (p.orig ? ' yy-ov' : ' yy-new');
    var btn = varb
      ? '<a href="' + u + '" data-quantity="1" class="button product_type_variable add_to_cart_button" data-product_id="' + id + '" data-product_sku="" aria-label="選取「' + nm + '」選項" rel="">選擇規格</a>\t<span class="screen-reader-text">此產品有多種款式。 可在產品頁面選擇選項</span>'
      : P.stock
        ? '<a href="' + u + '" data-quantity="1" class="button product_type_simple add_to_cart_button ajax_add_to_cart" data-product_id="' + id + '" data-product_sku="" aria-label="加入購物車：「' + nm + '」" rel="nofollow" data-success_message="「' + nm + '」已新增至你的購物車" role="button">加入購物車</a>'
        : '<a href="' + u + '" data-quantity="1" class="button product_type_simple" data-product_id="' + id + '" data-product_sku="" aria-label="進一步了解「' + nm + '」" rel="nofollow">了解更多</a>';
    return '<li class="' + cls + '">\n\t<a href="' + u + '" class="woocommerce-LoopProduct-link woocommerce-loop-product__link">' + (npSale(p) ? '\n\t<span class="onsale">特價！</span>\n\t' : '') +
      '<img loading="lazy" width="400" height="400" src="' + esc(npSrc(P.img)) + '" class="attachment-woocommerce_thumbnail size-woocommerce_thumbnail" alt="' + nm + '" decoding="async" /><h2 class="woocommerce-loop-product__title">' + nm + '</h2>\n\t<span class="price">' + P.price_html + '</span>\n</a>' + btn + '\n</li>';
  }
  // 後台資料 → 商品清單：新商品（p/?id=）、改過的原站商品（同網址、內容換掉）、下架／刪除的原站商品（OFF，整站隱藏）
  function mergeProducts(list, off) {
    D.products = Object.assign({}, D0.products); D.loop = Object.assign({}, D0.loop); D.orders = JSON.parse(JSON.stringify(D0.orders));
    NP = {}; OFF = {};
    (off || []).forEach(function (id) { id = String(id); if (D0.products[id]) OFF[id] = 1; });
    Object.keys(OFF).forEach(function (id) { delete D.products[id]; delete D.loop[id]; });
    Object.keys(D.orders).forEach(function (k) { D.orders[k] = (D.orders[k] || []).filter(function (i) { return !OFF[i]; }); });
    var fresh = [], edited = [];
    (list || []).slice().sort(function (a, b) { return (b.t || 0) - (a.t || 0); }).forEach(function (q) {
      var id = String(q && q.id || ''), base = D0.products[id], orig = !!(q && q.orig && base);
      if (!/^\d{1,12}$/.test(id) || !q.name || OFF[id] || NP[id] || (base && !orig)) return;
      var p = {
        id: id, name: String(q.name), was: +q.was || 0, price: +q.price || 0, cats: (q.cats || []).map(Number).filter(function (c) { return D.cats[c]; }),
        short: String(q.short || ''), desc: String(q.desc || ''), optName: String(q.optName || '款式'), t: +q.t || 0,
        sku: String(q.sku || ''), ups: (q.ups || []).map(String).filter(function (u) { return /^\d{1,12}$/.test(u); }),
        orig: orig, keepImgs: orig && !!q.keepImgs, keepDesc: orig && !!q.keepDesc,
        imgs: (q.imgs || []).map(npImg).filter(Boolean), vars: (q.vars || []).filter(function (v) { return v && /^\d{1,12}$/.test(String(v.id)) && v.name; })
          .map(function (v) { return { id: String(v.id), name: String(v.name), price: +v.price || 0, img: npImg(v.img) }; })
      };
      p.thumb = npImg(q.thumb) || p.imgs[0] || (base && base.img) || '';
      NP[id] = p;
      D.products[id] = { name: p.name, url: orig ? base.url : 'p/?id=' + id, price: npPrices(p).lo, hi: npPrices(p).hi, type: p.vars.length ? 'variable' : 'simple', stock: npInStock(p), cats: p.cats,
        brands: orig ? base.brands || [] : [], img: p.thumb, price_html: npPriceHtml(p), search: (p.name + ' ' + p.short + ' ' + p.desc).toLowerCase(), isNew: !orig };
      D.loop[id] = npCard(id);
      (orig ? edited : fresh).push(+id);
    });
    fresh.sort(function (a, b) { return NP[b].t - NP[a].t; });
    ['menu_order', 'date'].forEach(function (k) { if (D.orders[k]) D.orders[k] = fresh.concat(D.orders[k]); });
    if (D.orders.popularity) D.orders.popularity = D.orders.popularity.concat(fresh);
    [['price', 1], ['price-desc', -1]].forEach(function (o) {
      var l = D.orders[o[0]]; if (!l) return;
      l = D.orders[o[0]] = l.filter(function (i) { return edited.indexOf(+i) < 0; });   // 改了價格的原站商品重新排位置
      fresh.concat(edited).forEach(function (id) {
        // WooCommerce：低→高 用最低價、高→低 用最高價（多規格商品）
        var key = function (q) { if (o[1] > 0 || q.type !== 'variable') return q.price; if (q.hi) return q.hi; var m = (q.price_html || '').replace(/<[^>]+>/g, ' ').match(/[\d,]+/g) || []; return Math.max.apply(null, [q.price].concat(m.map(function (x) { return +x.replace(/,/g, '') || 0; }))); };
        var pr = key(D.products[id]), at = l.length;
        for (var i = 0; i < l.length; i++) { var q = D.products[l[i]]; if (q && (key(q) - pr) * o[1] > 0) { at = i; break; } }
        l.splice(at, 0, id);
      });
    });
  }
  function npDims(u) {
    return new Promise(function (ok) {
      var im = new Image(), done = function () { ok([im.naturalWidth || 1000, im.naturalHeight || 1000]); };
      im.onload = done; im.onerror = done; setTimeout(done, 6000); im.src = u;
    });
  }
  function npVarImage(u, sz, alt) {
    var s = npSrc(u), w = sz[0], h = sz[1];
    return { title: alt, caption: '', url: s, alt: alt, src: s, srcset: '', sizes: '(max-width: ' + w + 'px) 100vw, ' + w + 'px', full_src: s, full_src_w: w, full_src_h: h,
      gallery_thumbnail_src: s, gallery_thumbnail_src_w: 100, gallery_thumbnail_src_h: 100, thumb_src: s, thumb_src_w: w, thumb_src_h: h, src_w: w, src_h: h };
  }
  function npVariations(p, vimg) {
    var r = npPrices(p), diff = r.lo !== r.hi;
    return p.vars.map(function (v) {
      var s = stockOf(v.id), price = s && s.price ? s.price : v.price;
      return { attributes: { 'attribute_yy-opt': v.name }, availability_html: '', backorders_allowed: false, dimensions: { length: '', width: '', height: '' }, dimensions_html: '不提供',
        display_price: price, display_regular_price: price, gallery_image_ids: [], gallery_images_html: '', image: (vimg && v.img && vimg[v.img]) || {}, image_id: 0, is_downloadable: false, is_in_stock: true,
        is_purchasable: true, is_sold_individually: 'no', is_virtual: false, max_qty: '', min_qty: 1, price_html: diff ? '<span class="price">' + amt(price) + '</span>' : '', sku: '',
        variation_description: '', variation_id: +v.id, variation_is_active: true, variation_is_visible: true, weight: '', weight_html: '不提供' };
    });
  }
  function npGallery(p, sz) {
    var nm = esc(p.name);
    var gal = p.imgs.map(function (u, i) {
      var e = esc(npSrc(u)), w = sz[i][0], h = sz[i][1];
      return '<div data-thumb="' + e + '" data-thumb-alt="' + nm + (i ? '：圖片 ' + (i + 1) : '') + '" data-thumb-srcset=""  data-thumb-sizes="(max-width: 100px) 100vw, 100px" class="woocommerce-product-gallery__image"><a href="' + e + '"><img width="' + w + '" height="' + h + '" src="' + e + '" class="' + (i ? '' : 'wp-post-image') + '" alt="' + nm + (i ? '：圖片 ' + (i + 1) : '') + '" data-caption="" data-src="' + e + '" data-large_image="' + e + '" data-large_image_width="' + w + '" data-large_image_height="' + h + '" decoding="async" /></a></div>';
    }).join('');
    return '\t<div class="woocommerce-product-gallery woocommerce-product-gallery--with-images woocommerce-product-gallery--columns-4 images" data-columns="4" style="opacity: 0; transition: opacity .25s ease-in-out;">\n\t<div class="woocommerce-product-gallery__wrapper">\n\t\t' + gal + '\t</div>\n</div>\n';
  }
  function npForm(p, id, vimg) {
    var nm = esc(p.name), varb = p.vars.length > 0;
    var qty = '<div class="quantity">\n\t\t<label class="screen-reader-text" for="quantity_yy' + id + '">' + nm + ' 數量</label>\n\t<input type="number" id="quantity_yy' + id + '" class="input-text qty text" name="quantity" value="1" aria-label="商品數量" min="1" step="1" placeholder="" inputmode="numeric" autocomplete="off" />\n\t</div>\n\t';
    return varb
      ? '<form class="variations_form cart" action="" method="post" enctype="multipart/form-data" data-product_id="' + id + '" data-product_variations="' + esc(JSON.stringify(npVariations(p, vimg))) + '">\n\t\t\t<table class="variations" cellspacing="0" role="presentation">\n\t\t\t<tbody>\n\t\t\t\t\t<tr>\n\t\t\t\t\t\t<th class="label"><label for="yy-opt">' + esc(p.optName) + '</label></th>\n\t\t\t\t\t\t<td class="value">\n\t\t\t\t\t\t\t<select id="yy-opt" class="" name="attribute_yy-opt" data-attribute_name="attribute_yy-opt" data-show_option_none="yes"><option value="">請選取一個選項</option>' +
        p.vars.map(function (v) { return '<option value="' + esc(v.name) + '" >' + esc(v.name) + '</option>'; }).join('') +
        '</select><a class="reset_variations" href="#" aria-label="清除選項">清除</a>\t\t\t\t\t\t</td>\n\t\t\t\t\t</tr>\n\t\t\t\t\t\t\t</tbody>\n\t\t</table>\n\t\t<div class="reset_variations_alert screen-reader-text" role="alert" aria-live="polite" aria-relevant="all"></div>\n\t\t<div class="single_variation_wrap">\n\t\t\t<div class="woocommerce-variation single_variation" role="alert" aria-relevant="additions"></div><div class="woocommerce-variation-add-to-cart variations_button">\n\t' +
        qty + '<button type="submit" class="single_add_to_cart_button button alt">加入購物車</button>\n\t<input type="hidden" name="add-to-cart" value="' + id + '" />\n\t<input type="hidden" name="product_id" value="' + id + '" />\n\t<input type="hidden" name="variation_id" class="variation_id" value="0" />\n</div>\n\t\t</div>\n\t</form>\n'
      : '<form class="cart" action="" method="post" enctype="multipart/form-data">\n\t\t' + qty + '<button type="submit" name="add-to-cart" value="' + id + '" class="single_add_to_cart_button button alt">加入購物車</button>\n\t</form>\n';
  }
  function npCatLinks(p) {
    return p.cats.map(function (c) { var ch = catChain(c), x = ch[ch.length - 1]; return x ? '<a href="' + esc(R + x.url) + '" rel="tag">' + esc(x.name) + '</a>' : ''; }).filter(Boolean).join(', ');
  }
  var NP_REVIEWS_LI = '\t\t\t\t\t\t\t<li role="presentation" class="reviews_tab" id="tab-title-reviews">\n\t\t\t\t\t<a href="#tab-reviews" role="tab" aria-controls="tab-reviews">\n\t\t\t\t\t\t評價 (0)\t\t\t\t\t</a>\n\t\t\t\t</li>\n';
  var NP_REVIEWS = '\t\t\t\t\t<div class="woocommerce-Tabs-panel woocommerce-Tabs-panel--reviews panel entry-content wc-tab" id="tab-reviews" role="tabpanel" aria-labelledby="tab-title-reviews">\n\t\t\t\t<div id="reviews" class="woocommerce-Reviews">\n\t<div id="comments">\n\t\t<h2 class="woocommerce-Reviews-title">\n\t\t\t商品評價\t\t</h2>\n\n\t\t\t\t\t<p class="woocommerce-noreviews">目前沒有評價。</p>\n\t\t\t</div>\n\n\t\t\t<p class="woocommerce-verification-required">只有註冊並且購買過商品的顧客才能撰寫評價。</p>\n\t\n\t<div class="clear"></div>\n</div>\n\t\t\t</div>\n';
  function npTabs(p) {
    var desc = npText(p.desc);
    return '\t<div class="woocommerce-tabs wc-tabs-wrapper">\n\t\t<ul class="tabs wc-tabs" role="tablist">\n' +
      (desc ? '\t\t\t\t\t\t\t<li role="presentation" class="description_tab" id="tab-title-description">\n\t\t\t\t\t<a href="#tab-description" role="tab" aria-controls="tab-description">\n\t\t\t\t\t\t商品介紹\t\t\t\t\t</a>\n\t\t\t\t</li>\n' : '') + NP_REVIEWS_LI +
      '\t\t\t\t\t</ul>\n' +
      (desc ? '\t\t\t\t\t<div class="woocommerce-Tabs-panel woocommerce-Tabs-panel--description panel entry-content wc-tab" id="tab-description" role="tabpanel" aria-labelledby="tab-title-description">\n\t<h2>描述</h2>\n' + desc + '\n\t\t\t</div>\n' : '') +
      NP_REVIEWS + '\t\t\t</div>\n';
  }
  function npLis(ids) {
    return ids.map(function (i, k) { return D.loop[i].split('{R}').join(R).replace(/^<li class="product /, '<li class="product' + (k % 3 === 0 ? ' first' : k % 3 === 2 ? ' last' : '') + ' '); }).join('\n');
  }
  function npUpsells(p, id) {
    var ids = p.ups.filter(function (u, i, a) { return u !== String(id) && D.products[u] && D.loop[u] && a.indexOf(u) === i; });
    return ids.length ? '\t<section class="up-sells upsells products">\n\t\t\t\t\t<h2>您可能也喜歡&hellip;</h2>\n\t\t\n\t\t<ul class="products columns-3">\n' + npLis(ids) + '\n\t\t\t</ul>\n\n\t</section>\n' : '';
  }
  function npInitGallery(root) {
    var g = $('.woocommerce-product-gallery', root), jq = window.jQuery;
    if (jq && jq.fn.wc_product_gallery && window.wc_single_product_params) {
      var $g = jq(g); $g.trigger('wc-product-gallery-before-init', [g, window.wc_single_product_params]);
      $g.wc_product_gallery(window.wc_single_product_params); $g.trigger('wc-product-gallery-after-init', [g, window.wc_single_product_params]);
    } else if (g) g.style.opacity = 1;
  }
  function npInitForm(root) {
    var jq = window.jQuery;
    if (jq && jq.fn.wc_variation_form) jq('.variations_form', root).each(function () { jq(this).wc_variation_form(); });
  }
  // gallery sizes + variation pictures (variation images re-use the original picture data when it is the same file)
  function npPictures(p, withGallery, known) {
    var vi = p.vars.map(function (v) { return v.img; }).filter(function (u, i, a) { return u && a.indexOf(u) === i; });
    var list = (withGallery ? p.imgs : []).concat(vi);
    return Promise.all(list.map(function (u) { return npDims(npSrc(u)); })).then(function (sz) {
      var n = withGallery ? p.imgs.length : 0, vimg = {};
      vi.forEach(function (u, i) { vimg[u] = (known && known[u]) || npVarImage(u, sz[n + i], p.name); });
      return { gal: sz.slice(0, n), vimg: vimg };
    });
  }
  function renderNewProduct(final, failed) {
    var box = $('#yy-np'); if (!box || npShown) return;
    var id = String(qs.get('id') || ''), p = NP[id];
    if (p && p.orig) { location.replace(link(D.products[id].url)); return; }
    if (!p) {
      if (!final) return;
      document.title = (failed ? '載入失敗' : '找不到商品') + ' – A.Neuf-yunyun JP';
      box.className = '';
      box.innerHTML = '<div class="woocommerce-info" role="status">' + (failed ? '商品資料載入失敗，請稍後重新整理頁面。' : '找不到這個商品，可能已經下架。') + ' <a class="button wc-forward" href="' + R + 'shop/">回到商店</a></div>';
      return;
    }
    npShown = true;
    var P = D.products[id], nm = esc(p.name);
    npPictures(p, true).then(function (pic) {
      var cats = npCatLinks(p);
      var rel = Object.keys(D.products).map(Number).filter(function (i) { return i !== +id && D.loop[i] && D.products[i].stock && p.ups.indexOf(String(i)) < 0 && (D.products[i].cats || []).some(function (c) { return p.cats.indexOf(+c) >= 0 && +c !== 15; }); });
      var ord = (D.orders.date || []).map(Number); rel.sort(function (a, b) { var x = ord.indexOf(a), y = ord.indexOf(b); return (x < 0 ? 1e9 : x) - (y < 0 ? 1e9 : y); }); rel = rel.slice(0, 3);
      var html = '<div id="product-' + id + '" class="product type-product post-' + id + ' status-publish first ' + (P.stock ? 'instock' : 'outofstock') + (npSale(p) ? ' sale' : '') + ' has-post-thumbnail shipping-taxable purchasable product-type-' + P.type + '">\n' +
        (npSale(p) ? '\n\t<span class="onsale">特價！</span>\n\t' : '') + npGallery(p, pic.gal) +
        '\t<div class="summary entry-summary">\n\t\t<h1 class="product_title entry-title">' + nm + '</h1><p class="price">' + P.price_html + '</p>\n' +
        (p.short ? '<div class="woocommerce-product-details__short-description">\n\t' + npText(p.short) + '\n</div>\n' : '') + npForm(p, id, pic.vimg) +
        '<div class="product_meta">\n\t\t<span class="sku_wrapper">貨號: <span class="sku">' + (p.sku ? esc(p.sku) : '不提供') + '</span></span>\n' + (cats ? '\t<span class="posted_in">分類: ' + cats + '</span>\n' : '') + '</div>\n\t</div>\n' +
        npTabs(p) + npUpsells(p, id) +
        (rel.length ? '\t<section class="related products">\n\t\t\t\t\t<h2>相關商品</h2>\n\t\t\t\t<ul class="products columns-3">\n' + npLis(rel) + '\n\t\t</ul>\n\t</section>\n' : '') + '\t\t</div>';
      box.outerHTML = html;
      body.classList.add('postid-' + id);
      document.title = p.name + ' – A.Neuf-yunyun JP';
      var bc = $('#yy-np-bc');
      if (bc) {
        var ch = p.cats.length ? catChain(p.cats.filter(function (c) { return c !== 15; })[0] || p.cats[0]) : [];
        bc.innerHTML = '<a href="' + R + '">首頁</a>' + ch.map(function (x) { return '<span class="breadcrumb-separator"> / </span><a href="' + esc(R + x.url) + '">' + esc(x.name) + '</a>'; }).join('') + '<span class="breadcrumb-separator"> / </span>' + nm;
      }
      var root = $('#product-' + id), jq = window.jQuery;
      npInitGallery(root);
      if (jq) jq('.wc-tabs-wrapper, .woocommerce-tabs', root).trigger('init');
      npInitForm(root);
      refreshRecent();
      applyStock();
    });
  }

  /* ---------- 原站商品：後台改過內容 → 同一頁換成新內容；下架／刪除 → 整站隱藏 ---------- */
  function idFromHref(h) {
    var r = toRootRel(h || ''); if (!r) return '';
    var m = r.match(/^p\/\?id=(\d+)/); if (m) return m[1];
    return URL2ID[r.split('#')[0].split('?')[0]] || '';
  }
  function fixCols(ul) {
    var cols = +((ul.className.match(/columns-(\d+)/) || [])[1] || 3);
    $$(':scope > li.product', ul).forEach(function (li, i) { li.classList.remove('first', 'last'); if (i % cols === 0) li.classList.add('first'); else if (i % cols === cols - 1) li.classList.add('last'); });
  }
  function overrideProductPage(id) {
    var p = NP[id], P = D.products[id], root = $('#product-' + id);
    if (!root || root.getAttribute('data-yy-ov')) return;
    root.setAttribute('data-yy-ov', '1');
    var known = {}, of = $('form.variations_form', root);
    try { (JSON.parse(of.getAttribute('data-product_variations')) || []).forEach(function (v) { if (v.image && v.image.full_src) known[toRootRel(v.image.full_src)] = v.image; }); } catch (e) { }
    npPictures(p, !p.keepImgs, known).then(function (pic) {
      var sum = $('.summary', root), jq = window.jQuery;
      root.classList.remove('product-type-simple', 'product-type-variable', 'instock', 'outofstock', 'sale');
      root.classList.add('product-type-' + P.type, P.stock ? 'instock' : 'outofstock');
      if (npSale(p)) root.classList.add('sale');
      var os = $(':scope > .onsale', root);
      if (npSale(p)) { if (!os) root.insertAdjacentHTML('afterbegin', '<span class="onsale">特價！</span>'); } else if (os) os.remove();
      if (!p.keepImgs) { var g = $('.woocommerce-product-gallery', root); if (g && p.imgs.length) { g.outerHTML = npGallery(p, pic.gal); npInitGallery(root); } }
      if (sum) {
        var h1 = $('.product_title', sum); if (h1) h1.textContent = p.name;
        var pr = $('p.price', sum); if (pr) pr.innerHTML = P.price_html;
        var sd = $('.woocommerce-product-details__short-description', sum);
        if (p.short) { if (sd) sd.innerHTML = '\n\t' + npText(p.short) + '\n'; else (pr || h1).insertAdjacentHTML('afterend', '<div class="woocommerce-product-details__short-description">\n\t' + npText(p.short) + '\n</div>'); }
        else if (sd) sd.remove();
        $$('form.cart, p.stock', sum).forEach(function (x) { x.remove(); });
        var anchor = $('.woocommerce-product-details__short-description', sum) || $('#wc-stripe-bnpl-product-msg', sum) || pr || h1;
        if (anchor) anchor.insertAdjacentHTML('afterend', npForm(p, id, pic.vimg));
        var sku = $('.sku', sum); if (sku) sku.textContent = p.sku || '不提供';
        var pc = $('.product_meta .posted_in', sum), cats = npCatLinks(p);
        if (pc && !/品牌/.test(pc.firstChild && pc.firstChild.textContent || '')) { if (cats) pc.innerHTML = '分類: ' + cats; else pc.remove(); }
      }
      if (!p.keepDesc) {
        var dp = $('#tab-description', root);
        if (dp) dp.innerHTML = '\n\t<h2>描述</h2>\n' + npText(p.desc) + '\n';
        else { var tabs = $('.woocommerce-tabs', root); if (tabs) { tabs.outerHTML = npTabs(p); if (jq) jq('.wc-tabs-wrapper, .woocommerce-tabs', root).trigger('init'); } }
      }
      var up = $('section.up-sells', root), uh = npUpsells(p, id);
      if (up) { if (uh) up.outerHTML = uh; else up.remove(); }
      else if (uh) { var relS = $('section.related', root), tb = $('.woocommerce-tabs', root); if (relS) relS.insertAdjacentHTML('beforebegin', uh); else if (tb) tb.insertAdjacentHTML('afterend', uh); else root.insertAdjacentHTML('beforeend', uh); }
      var sk = $('.storefront-sticky-add-to-cart');
      if (sk) {
        var st = $('.storefront-sticky-add-to-cart__content-title strong', sk); if (st) st.textContent = p.name;
        var sp = $('.storefront-sticky-add-to-cart__content-price', sk); if (sp) sp.innerHTML = P.price_html;
        var si = $('img', sk); if (si && !p.keepImgs && p.thumb) { si.src = npSrc(p.thumb); si.removeAttribute('srcset'); si.alt = p.name; }
        var sb = $('.storefront-sticky-add-to-cart__content-button', sk); if (sb) sb.textContent = P.type === 'variable' ? '選擇規格' : '加入購物車';
      }
      var bc = $('.woocommerce-breadcrumb'); if (bc && bc.lastChild && bc.lastChild.nodeType === 3) bc.lastChild.textContent = p.name;
      document.title = p.name + ' – A.Neuf-yunyun JP';
      npInitForm(root);
      applyStock();
    });
  }
  function showOffProduct(id) {
    var el = $('#product-' + id); if (!el) return;
    el.outerHTML = '<div class="woocommerce-info" role="status">此商品已下架。 <a class="button wc-forward" href="' + R + 'shop/">回到商店</a></div>';
    $$('.storefront-sticky-add-to-cart').forEach(function (x) { x.remove(); });
    document.title = '此商品已下架 – A.Neuf-yunyun JP';
  }
  function applyOverrides() {
    var ov = Object.keys(NP).filter(function (i) { return NP[i].orig; });
    if (!ov.length && !Object.keys(OFF).length) return;
    // product cards anywhere (home, archives, related, upsells)
    $$('ul.products').forEach(function (ul) {
      var ch = false;
      $$(':scope > li.product', ul).forEach(function (li) {
        var m = li.className.match(/\bpost-(\d+)\b/); if (!m) return;
        if (OFF[m[1]]) { li.remove(); ch = true; }
        else if (NP[m[1]] && NP[m[1]].orig && D.loop[m[1]] && !li.classList.contains('yy-ov')) {
          var t = document.createElement('ul'); t.innerHTML = D.loop[m[1]].split('{R}').join(R); li.parentNode.replaceChild(t.firstElementChild, li); ch = true;
        }
      });
      if (ch) { fixCols(ul); if (!$('li.product', ul)) { var sec = ul.closest('section.up-sells, section.related'); if (sec) sec.remove(); } }
    });
    // sidebar product lists
    $$('.product_list_widget > li').forEach(function (li) {
      var a = $('a[href]', li); if (!a) return;
      var id = idFromHref(a.getAttribute('href')); if (!id) return;
      if (OFF[id]) { li.remove(); return; }
      var p = NP[id]; if (!p || !p.orig) return;
      var t = $('.product-title', li); if (t) t.textContent = p.name;
      var im = $('img', li); if (im && !p.keepImgs && p.thumb) { im.src = npSrc(p.thumb); im.removeAttribute('srcset'); im.alt = p.name; }
      while (a.nextSibling) a.parentNode.removeChild(a.nextSibling);
      a.insertAdjacentHTML('afterend', D.products[id].price_html);
    });
    // previous / next product links
    $$('.storefront-product-pagination a[href]').forEach(function (a) {
      var id = idFromHref(a.getAttribute('href')); if (!id) return;
      if (OFF[id]) a.style.display = 'none';
      else if (NP[id] && NP[id].orig) { var t = $('.storefront-product-pagination__title', a); if (t) t.textContent = NP[id].name; }
    });
    var pid = String(bodyId('postid-'));
    if (body.classList.contains('single-product') && D0.products[pid] && !$('#yy-np')) {
      if (OFF[pid]) showOffProduct(pid); else if (NP[pid] && NP[pid].orig) overrideProductPage(pid);
    }
  }
  // 購物車裡已下架／已刪除／規格被移除的商品 → 自動移除並提示（跟原站 WooCommerce 一樣）
  function pruneCart() {
    if (!stockMap) return;
    try { if (window.top !== window.self) return; } catch (e) { return; }   // 後台預覽框不動購物車
    var c = LS.get(CK, []) || [], gone = [];
    var keep = c.filter(function (i) {
      if (!i || !i.pid) return false;
      var pid = String(i.pid), bad = !!OFF[pid] || !D.products[pid] || !stockMap[String(i.vid || i.pid)];
      if (bad) gone.push(i);
      return !bad;
    });
    if (!gone.length) return;
    LS.set(CK, keep);
    var html = '<ul class="woocommerce-error" role="alert">' + gone.map(function (i) { return '\n\t\t\t<li>\n\t\t\t「' + esc(itemTitle(i)) + '」已從你的購物車中移除，因為它已無法購買。\t\t</li>'; }).join('') + '\n\t</ul>';
    var w = cartRoot ? cartRoot.querySelector('.woocommerce-notices-wrapper') : $('.woocommerce-notices-wrapper');
    if (w) { w.insertAdjacentHTML('beforeend', html); prunedShown = true; }
    else ssSet('yy_pruned', (ssGet('yy_pruned') || '') + html);   // 沒有提示區的頁面：下次打開購物車時顯示
  }
  var catDone = false;
  function afterCatalog(failed) {
    var sig = JSON.stringify([catProducts || [], catOff || []]);
    catDone = true;
    if (sig !== npSig) { npSig = sig; mergeProducts(catProducts, catOff); renderArchive(); refreshRecent(); }
    else if ((qs.get('s') || '').trim()) renderArchive();
    applyOverrides();
    renderNewProduct(true, failed);
    applyStock();
    if (!failed) pruneCart();
    renderAll();
  }

  /* ---------- 訂單來源追蹤（Google／IG／FB／LINE…）---------- */
  var SRCK = 'yy_src_v1';
  function srcName(x) {
    x = String(x || '').toLowerCase();
    return /google/.test(x) ? 'Google' : /instagram|^ig$/.test(x) ? 'Instagram' : /facebook|^fb$|fb\.(com|me)/.test(x) ? 'Facebook' : /(^|\.)line\.(me|naver)|^line$/.test(x) ? 'LINE' :
      /threads/.test(x) ? 'Threads' : /youtube|youtu\.be/.test(x) ? 'YouTube' : /bing/.test(x) ? 'Bing' : /yahoo/.test(x) ? 'Yahoo' : /^t\.co$|twitter|(^|\.)x\.com/.test(x) ? 'X' :
      /dcard/.test(x) ? 'Dcard' : /ptt\.cc/.test(x) ? 'PTT' : /shopee/.test(x) ? '蝦皮' : '';
  }
  function trackSource() {
    var host = ''; try { host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (e) { }
    if (host === location.hostname.replace(/^www\./, '')) host = '';
    var ua = navigator.userAgent, s = null, us = qs.get('utm_source');
    if (us) s = { label: (srcName(us) || us) + '（活動連結）', detail: [us, qs.get('utm_medium'), qs.get('utm_campaign')].filter(Boolean).join(' / ') };
    else if (qs.get('gclid')) s = { label: 'Google 廣告', detail: '' };
    else if (host) { var n = srcName(host); s = n ? { label: /Google|Bing|Yahoo/.test(n) ? n + ' 搜尋' : n, detail: host } : { label: '其他網站', detail: host }; }
    else if (/Instagram/.test(ua)) s = { label: 'Instagram', detail: 'IG App 內開啟' };
    else if (/FBAN|FBAV|FB_IAB/.test(ua)) s = { label: 'Facebook', detail: 'FB App 內開啟' };
    else if (/\bLine\//i.test(ua)) s = { label: 'LINE', detail: 'LINE 內開啟' };
    else if (qs.get('fbclid')) s = { label: 'Facebook / Instagram', detail: '' };
    var prev = LS.get(SRCK, null);
    if (!s && prev && Date.now() - prev.t < 30 * 864e5) return;
    s = s || { label: '直接造訪', detail: '' };
    var path = location.pathname; try { path = decodeURIComponent(path); } catch (e) { }
    s.landing = path.slice(0, 200); s.t = Date.now();
    LS.set(SRCK, s);
  }
  function sourceInfo() {
    var s = LS.get(SRCK, {}) || {}, ua = navigator.userAgent;
    return { label: s.label || '直接造訪', detail: s.detail || '', landing: s.landing || '', device: /iPad|Tablet/i.test(ua) ? '平板' : /Mobi|Android|iPhone/i.test(ua) ? '手機' : '電腦' };
  }

  /* ================= checkout ================= */
  function shipOptions(country, sub) {
    return (C.shipping || []).filter(function (m) { return !m.countries || m.countries.indexOf(country) >= 0; })
      .map(function (m) { var cost = m.freeOver && sub >= m.freeOver ? 0 : m.cost; return { id: m.id, label: m.label, cost: cost, store: m.store, map: m.map }; });
  }
  var chosenShip = LS.get('yy_ship', ''), cvsStore = '';
  function initCheckout() {
    if (!body.classList.contains('woocommerce-checkout')) return;
    if (qs.get('order-received')) { renderReceived(); return; }
    if (!cart().length) { location.replace(R + 'cart-2/'); return; }
    var form = $('form.checkout'); if (!form) return;
    var po = $('#place_order'), poText = po ? (po.getAttribute('data-value') || po.textContent) : '下單購買';

    // toggles (login / coupon)
    document.addEventListener('click', function (e) {
      var t = e.target.closest('.showlogin, .showcoupon'); if (!t) return;
      e.preventDefault();
      var f = t.classList.contains('showlogin') ? $('form.woocommerce-form-login.login') : $('.checkout_coupon');
      if (f) f.style.display = f.style.display === 'none' || getComputedStyle(f).display === 'none' ? 'block' : 'none';
    });
    var cf = $('.checkout_coupon');
    function ckCoupon(e) {
      e.preventDefault();
      applyCoupon((cf.querySelector('[name=coupon_code]') || {}).value).then(function (r) { notice(ensureNotice(), r.err || r.ok, r.err ? 'error' : 'ok'); renderReview(); });
    }
    if (cf) {
      cf.addEventListener('submit', ckCoupon);
      var cb = cf.querySelector('[name=apply_coupon]'); if (cb) cb.addEventListener('click', ckCoupon);
      var ci = cf.querySelector('[name=coupon_code]'); if (ci) ci.addEventListener('keydown', function (e) { if (e.key === 'Enter') ckCoupon(e); });
    }
    // ship to different address / create account
    var sd = $('#ship-to-different-address-checkbox'), sa = $('.shipping_address');
    function syncShip() { if (sa) sa.style.display = sd && sd.checked ? '' : 'none'; renderReview(); }
    if (sd) sd.addEventListener('change', syncShip);
    var ca = $('#createaccount'), caf = $('div.create-account');
    if (ca && caf) { var syncCa = function () { caf.style.display = ca.checked ? '' : 'none'; }; ca.addEventListener('change', syncCa); syncCa(); }
    // payment boxes
    function syncPay() {
      var cur = $('input[name=payment_method]:checked');
      $$('.payment_box').forEach(function (b) { b.style.display = cur && b.parentNode === cur.closest('li') ? 'block' : 'none'; });
      if (po) { var t = cur && cur.getAttribute('data-order_button_text'); po.textContent = t || poText; }
    }
    $$('input[name=payment_method]').forEach(function (r) { r.addEventListener('change', syncPay); });
    syncPay();
    form.addEventListener('change', function (e) {
      if (/(billing|shipping)_country|shipping_method/.test(e.target.name || '')) {
        if (e.target.name.indexOf('shipping_method') === 0) { chosenShip = e.target.value; LS.set('yy_ship', chosenShip); }
        renderReview();
      }
    });
    form.addEventListener('input', function (e) { if (e.target.id === 'yy_cvs_store') cvsStore = e.target.value; });
    form.addEventListener('submit', function (e) { e.preventDefault(); placeOrder(form); });
    // logged-in prefill
    var s = session(), pr = Auth.profile();
    if (s) {
      var em = $('#billing_email'); if (em && !em.value) em.value = s.email;
      Object.keys(pr).forEach(function (k) { var el = form.querySelector('[name="' + k + '"]'); if (el && !el.value) el.value = pr[k]; });
      var tg = $('.woocommerce-form-login-toggle'); if (tg) tg.style.display = 'none';
      $$('.woocommerce-account-fields').forEach(function (x) { x.style.display = 'none'; });
    }
    syncShip();
  }
  function ensureNotice() {
    var w = $('.woocommerce-NoticeGroup-checkout');
    if (!w) { var f = $('form.checkout'); f.insertAdjacentHTML('afterbegin', '<div class="woocommerce-NoticeGroup woocommerce-NoticeGroup-checkout"></div>'); w = $('.woocommerce-NoticeGroup-checkout'); }
    return w;
  }
  function currentShip(sub) {
    var sd = $('#ship-to-different-address-checkbox');
    var cEl = sd && sd.checked ? $('#shipping_country') : $('#billing_country');
    var country = cEl ? cEl.value : '';
    if (!country) return null;
    var opts = shipOptions(country, sub);
    if (!opts.length) return { html: ' 沒有適用於您地址的運送方式。 ', cost: 0, none: true };
    var cur = opts.filter(function (o) { return o.id === chosenShip; })[0] || opts[0];
    chosenShip = cur.id;
    var html = '<ul id="shipping_method" class="woocommerce-shipping-methods">' + opts.map(function (o) {
      return '<li><input type="radio" name="shipping_method[0]" data-index="0" id="shipping_method_0_' + o.id + '" value="' + o.id + '" class="shipping_method"' + (o.id === cur.id ? ' checked="checked"' : '') + '>' +
        '<label for="shipping_method_0_' + o.id + '">' + esc(o.label) + (o.cost ? ': ' + amt(o.cost) : '') + '</label></li>';
    }).join('') + '</ul>';
    if (cur.store) html += '<p class="form-row yy-cvs-row"><label for="yy_cvs_store">取貨門市（店號／店名）&nbsp;<abbr class="required" title="必填">*</abbr></label><input type="text" class="input-text" id="yy_cvs_store" value="' + esc(cvsStore) + '">' + (/^https:\/\//.test(cur.map || '') ? '<a class="yy-cvs-map" href="' + esc(cur.map) + '" target="_blank" rel="noopener">查詢門市店號 ›</a>' : '') + '</p>';
    return { html: html, cost: cur.cost, opt: cur };
  }
  function renderReview() {
    var t = $('.woocommerce-checkout-review-order-table'); if (!t) return;
    var c = cart(), sub = subtotal(c), ship = currentShip(sub), r = totalsRows(sub, ship);
    t.querySelector('tbody').innerHTML = c.map(function (i) {
      return '<tr class="cart_item"><td class="product-name"> ' + esc(itemTitle(i)) + '&nbsp; <strong class="product-quantity">×&nbsp;' + i.qty + '</strong> </td><td class="product-total"> ' + amt(i.qty * i.price) + ' </td></tr>';
    }).join('');
    t.querySelector('tfoot').innerHTML = r.rows.replace(/ <a href="#" class="woocommerce-remove-coupon"/g, ' <a href="#" class="woocommerce-remove-coupon"');
    var isStore = !!(ship && ship.opt && ship.opt.store);   // 超商取貨：不用填地址（與原站一致）
    ['postcode', 'state', 'city', 'address_1', 'address_2'].forEach(function (k) { var f = $('#billing_' + k + '_field'); if (f) f.style.display = isStore ? 'none' : ''; });
    t.onclick = function (e) { var rc = e.target.closest('.woocommerce-remove-coupon'); if (rc) { e.preventDefault(); removeCoupon(rc.dataset.coupon); renderReview(); } };
    return { sub: sub, ship: ship, r: r };
  }
  function fieldLabel(row) {
    var l = row.querySelector('label'); if (!l) return '';
    return l.textContent.replace(/\*|\(選填\)|（選填）|必填/g, '').trim();
  }
  function placeOrder(form) {
    var errs = [];
    var groups = [$('.woocommerce-billing-fields', form)];
    var sd = $('#ship-to-different-address-checkbox');
    if (sd && sd.checked) groups.push($('.shipping_address', form));
    var ca = $('#createaccount');
    var acctOn = !session() && (!ca || ca.checked) && $('#account_password');
    if (acctOn && $('.woocommerce-account-fields', form) && $('.woocommerce-account-fields', form).offsetParent !== null) groups.push($('.woocommerce-account-fields', form));
    groups.filter(Boolean).forEach(function (g) {
      $$('.validate-required', g).forEach(function (row) {
        if (row.offsetParent === null) return;
        var el = row.querySelector('input,select,textarea'); if (!el) return;
        row.classList.remove('woocommerce-invalid', 'woocommerce-invalid-required-field');
        if (!String(el.value).trim()) { errs.push('<strong>' + esc(fieldLabel(row)) + '</strong> 是必填欄位。'); row.classList.add('woocommerce-invalid', 'woocommerce-invalid-required-field'); }
        else if (el.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value)) { errs.push('<strong>' + esc(fieldLabel(row)) + '</strong> 不是有效的電子郵件地址。'); row.classList.add('woocommerce-invalid'); }
      });
    });
    var rv = renderReview();
    if (rv.ship && rv.ship.none) errs.push('沒有適用於您地址的運送方式。請確認您的地址是否正確，或聯絡我們以取得協助。');
    if (rv.ship && rv.ship.opt && rv.ship.opt.store && !cvsStore.trim()) errs.push('<strong>取貨門市</strong> 是必填欄位。');
    var terms = $('#terms', form); if (terms && !terms.checked) errs.push('請閱讀並接受條款與條件，以繼續處理您的訂單。');
    var w = ensureNotice();
    if (errs.length) { w.innerHTML = '<ul class="woocommerce-error" role="alert">' + errs.map(function (e) { return '<li>' + e + '</li>'; }).join('') + '</ul>'; w.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    w.innerHTML = '';
    var fd = {}; $$('input,select,textarea', form).forEach(function (el) {
      if (!el.name || el.type === 'hidden' || el.name === 'account_password') return;
      if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
      fd[el.name] = el.value;
    });
    var bill = {}, shipA = {};
    Object.keys(fd).forEach(function (k) { if (k.indexOf('billing_') === 0) bill[k] = fd[k]; if (k.indexOf('shipping_') === 0 && k !== 'shipping_method[0]') shipA[k] = fd[k]; });
    var pm = $('input[name=payment_method]:checked');
    var pmLabel = pm ? (pm.closest('li').querySelector('label').textContent || '').trim() : '';
    var now = Date.now();
    var o = {
      number: String(now).slice(-6), key: 'wc_order_' + Math.random().toString(36).slice(2, 15), date: now, status: '待付款',
      billing: bill, shipping: sd && sd.checked ? shipA : null, note: fd.order_comments || '',
      items: cart().map(function (i) { return { pid: i.pid, vid: i.vid, name: itemTitle(i), qty: i.qty, price: i.price, url: i.url }; }),
      subtotal: rv.sub, discounts: rv.r.ds, shippingLabel: rv.ship && rv.ship.opt ? rv.ship.opt.label : '', shippingCost: rv.ship ? rv.ship.cost : 0, cvsStore: cvsStore,
      total: rv.r.total, payment: pm ? pm.value : '', paymentLabel: pmLabel, account: session() ? session().email : ''
    };
    var po = $('#place_order');
    if (GAS) {
      var poTxt = po ? po.textContent : '';
      if (po) { po.disabled = true; po.textContent = '處理中，請稍候…'; }
      form.classList.add('processing');
      var pay = { items: o.items, billing: bill, shipping: o.shipping, note: o.note, coupons: coupons(), shipId: rv.ship && rv.ship.opt ? rv.ship.opt.id : '', cvsStore: cvsStore, payment: o.payment, source: sourceInfo() };
      if (acctOn && $('#account_password').value) pay.accountPassword = $('#account_password').value;
      api('place_order', { order: pay }).then(function (j) {
        if (j.token) LS.set(SK, { email: bill.billing_email.toLowerCase(), token: j.token });
        var so = j.order; so.bankInfo = j.bankInfo || ''; saveOrderLocal(so);
        if (session()) { var pr = Auth.profile(); Object.keys(bill).forEach(function (k) { if (k !== 'billing_email') pr[k] = bill[k]; }); Auth.cacheProfile(pr); }
        try { sessionStorage.removeItem(STK); } catch (e) { }
        LS.set(CK, []); LS.set(CPK, []);
        location.href = R + 'checkout-2/?order-received=' + so.number + '&key=' + so.key;
      }, function (er) {
        if (po) { po.disabled = false; po.textContent = poTxt; }
        form.classList.remove('processing');
        w.innerHTML = '<ul class="woocommerce-error" role="alert"><li>' + emsg(er) + '</li></ul>';
        w.scrollIntoView({ behavior: 'smooth', block: 'start' });
        loadStock(true).then(renderAll);
      });
      return;
    }
    if (po) { po.disabled = true; }
    var pre = Promise.resolve();
    if (acctOn && $('#account_password').value) pre = Auth.register(bill.billing_email, $('#account_password').value).then(function () { o.account = bill.billing_email.toLowerCase(); }, function () { });
    pre.then(function () {
      if (session()) { var keep = {}; Object.keys(bill).forEach(function (k) { if (k !== 'billing_email') keep[k] = bill[k]; }); Auth.saveProfile(keep); }
      saveOrderLocal(o);
      LS.set(CK, []); LS.set(CPK, []);
      location.href = R + 'checkout-2/?order-received=' + o.number + '&key=' + o.key;
    });
  }
  function orderTable(o) {
    return '<table class="woocommerce-table woocommerce-table--order-details shop_table order_details"><thead><tr><th class="woocommerce-table__product-name product-name">商品</th><th class="woocommerce-table__product-table product-total">小計</th></tr></thead><tbody>' +
      o.items.map(function (i) { return '<tr class="woocommerce-table__line-item order_item"><td class="woocommerce-table__product-name product-name"><a href="' + link(i.url) + '">' + esc(i.name) + '</a> <strong class="product-quantity">&times;&nbsp;' + i.qty + '</strong></td><td class="woocommerce-table__product-total product-total">' + amt(i.qty * i.price) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><th scope="row">小計：</th><td>' + amt(o.subtotal) + '</td></tr>' +
      (o.discounts || []).map(function (d) { return '<tr><th scope="row">折扣：</th><td>-' + amt(d.amount) + '</td></tr>'; }).join('') +
      (o.shippingLabel ? '<tr><th scope="row">運送方式：</th><td>' + (o.shippingCost ? amt(o.shippingCost) + '&nbsp;<small class="shipped_via">透過 ' + esc(o.shippingLabel) + '</small>' : esc(o.shippingLabel)) + (o.cvsStore ? '<br><small>取貨門市：' + esc(o.cvsStore) + '</small>' : '') + '</td></tr>' : '') +
      '<tr><th scope="row">付款方式：</th><td>' + esc(o.paymentLabel) + '</td></tr><tr><th scope="row">總計：</th><td>' + amt(o.total) + '</td></tr>' +
      (o.note ? '<tr><th>備註：</th><td>' + esc(o.note) + '</td></tr>' : '') + '</tfoot></table>';
  }
  function addressHTML(b, p) {
    p = p || 'billing_';
    var cn = { TW: '臺灣', HK: '香港', MO: '澳門' };
    return [(b[p + 'last_name'] || '') + (b[p + 'first_name'] || ''), b[p + 'company'], b[p + 'postcode'] + ' ' + (b[p + 'state'] || '') + (b[p + 'city'] || ''), b[p + 'address_1'], b[p + 'address_2'], cn[b[p + 'country']] || b[p + 'country']]
      .filter(function (x) { return x && String(x).trim(); }).map(esc).join('<br>');
  }
  function renderReceived() {
    var no = qs.get('order-received'), key = qs.get('key');
    var o = LS.get('yy_orders', []).filter(function (x) { return x.number === no && x.key === key; })[0];
    var h1 = $('#primary .entry-title'); if (h1) h1.textContent = '已收到訂單';
    document.title = '已收到訂單 – ' + document.title.split('–').pop().trim();
    var ec = $('#primary .entry-content'); if (!ec) return;
    if (!o && GAS && no && key) {
      ec.innerHTML = '<div class="woocommerce"><p>訂單資料載入中…</p></div>';
      api('order_get', { number: no, key: key, token: '' }).then(function (j) { j.order.bankInfo = j.bankInfo || ''; paintReceived(ec, j.order); }, function () { paintReceived(ec, null); });
      return;
    }
    paintReceived(ec, o);
  }
  function paintReceived(ec, o) {
    if (!o) { ec.innerHTML = '<div class="woocommerce"><div class="woocommerce-order"><p class="woocommerce-notice woocommerce-notice--error">找不到這筆訂單。</p></div></div>'; return; }
    var pay = o.payment === 'ry_ecpay_atm'
      ? '<section class="woocommerce-order-details yy-payinfo"><h2 class="woocommerce-order-details__title">付款資訊</h2><p>' + ((o.bankInfo || C.bankInfo) ? esc(o.bankInfo || C.bankInfo).replace(/\n/g, '<br>') : '我們將盡快以 Email 提供 ATM 轉帳資訊，請留意信箱（' + esc(o.billing.billing_email) + '）。') + '</p></section>'
      : '<section class="woocommerce-order-details yy-payinfo"><h2 class="woocommerce-order-details__title">付款資訊</h2><p>我們將以 Email 傳送 ' + esc(o.paymentLabel) + ' 付款連結至 ' + esc(o.billing.billing_email) + '。</p></section>';
    ec.innerHTML = '<div class="woocommerce"><div class="woocommerce-order">' +
      '<p class="woocommerce-notice woocommerce-notice--success woocommerce-thankyou-order-received">謝謝您，我們已收到您的訂單。</p>' +
      '<ul class="woocommerce-order-overview woocommerce-thankyou-order-details order_details">' +
      '<li class="woocommerce-order-overview__order order">訂單編號： <strong>' + esc(o.number) + '</strong></li>' +
      '<li class="woocommerce-order-overview__date date">日期： <strong>' + zhDate(o.date) + '</strong></li>' +
      '<li class="woocommerce-order-overview__email email">電子郵件： <strong>' + esc(o.billing.billing_email) + '</strong></li>' +
      '<li class="woocommerce-order-overview__total total">總計： <strong>' + amt(o.total) + '</strong></li>' +
      '<li class="woocommerce-order-overview__payment-method method">付款方式： <strong>' + esc(o.paymentLabel) + '</strong></li></ul>' + pay +
      '<section class="woocommerce-order-details"><h2 class="woocommerce-order-details__title">訂單詳細資料</h2>' + orderTable(o) + '</section>' +
      '<section class="woocommerce-customer-details"><section class="woocommerce-columns woocommerce-columns--2 woocommerce-columns--addresses col2-set addresses"><div class="woocommerce-column woocommerce-column--1 woocommerce-column--billing-address col-1"><h2 class="woocommerce-column__title">收件人資訊</h2><address>' + addressHTML(o.billing) +
      (o.billing.billing_phone ? '<p class="woocommerce-customer-details--phone">' + esc(o.billing.billing_phone) + '</p>' : '') + '<p class="woocommerce-customer-details--email">' + esc(o.billing.billing_email) + '</p></address></div>' +
      (o.shipping ? '<div class="woocommerce-column woocommerce-column--2 woocommerce-column--shipping-address col-2"><h2 class="woocommerce-column__title">運送地址</h2><address>' + addressHTML(o.shipping, 'shipping_') + '</address></div>' : '') +
      '</section></section></div></div>';
  }

  /* ================= my account ================= */
  function bindLoginForms() {
    $$('form.woocommerce-form-login').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var u = (f.querySelector('[name=username]') || {}).value || '', p = (f.querySelector('[name=password]') || {}).value || '';
        var nw = $('.woocommerce-notices-wrapper', f.closest('.woocommerce') || document) || ensureNotice();
        if (!u) return notice(nw, '<strong>錯誤：</strong>使用者名稱為必填欄位。', 'error');
        if (!p) return notice(nw, '<strong>錯誤：</strong>密碼欄位為空白。', 'error');
        var sb = f.querySelector('[type=submit]'); if (sb) sb.disabled = true;
        Auth.login(u, p).then(function () { location.reload(); }, function (er) {
          if (sb) sb.disabled = false;
          var m = emsg(er); if (er.plain && /密碼不正確/.test(er.message)) m += ' <a href="' + R + 'my-account/lost-password/">忘記密碼？</a>';
          notice(nw, '<strong>錯誤：</strong>' + m, 'error');
        });
      });
    });
    $$('form.woocommerce-form-register').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var em = (f.querySelector('[name=email]') || {}).value || '', p = (f.querySelector('[name=password]') || {}).value || '';
        var nw = $('.woocommerce-notices-wrapper', f.closest('.woocommerce') || document);
        var sb = f.querySelector('[type=submit]'); if (sb) sb.disabled = true;
        Auth.register(em, p).then(function () { location.reload(); }, function (er) { if (sb) sb.disabled = false; notice(nw, '<strong>錯誤：</strong>' + emsg(er), 'error'); });
      });
    });
    var lp = $('form.lost_reset_password');
    var rq = new URLSearchParams(location.search), rkey = rq.get('key'), rlogin = rq.get('login');
    var lp2busy = false;
    if (lp && GAS && rkey && rlogin) {
      var lp2 = lp;
      // step 2 (from the e-mailed link): choose a new password
      lp2.innerHTML = '<p>輸入下方的新密碼。</p>' +
        '<p class="woocommerce-form-row woocommerce-form-row--first form-row form-row-first"><label for="password_1">新密碼&nbsp;<span class="required" aria-hidden="true">*</span></label><input type="password" class="woocommerce-Input woocommerce-Input--text input-text" name="password_1" id="password_1" autocomplete="new-password" required></p>' +
        '<p class="woocommerce-form-row woocommerce-form-row--last form-row form-row-last"><label for="password_2">再次輸入新密碼&nbsp;<span class="required" aria-hidden="true">*</span></label><input type="password" class="woocommerce-Input woocommerce-Input--text input-text" name="password_2" id="password_2" autocomplete="new-password" required></p>' +
        '<div class="clear"></div><p class="woocommerce-form-row form-row"><button type="submit" class="woocommerce-Button button" value="儲存">儲存</button></p>';
      lp2.addEventListener('submit', function (e) {
        e.preventDefault();
        var a = $('#password_1').value, b = $('#password_2').value, nw = $('.woocommerce-notices-wrapper', lp2.closest('.woocommerce')), sb = lp2.querySelector('[type=submit]');
        setTimeout(function () { sb.disabled = !!lp2busy; }, 0);
        if (!a) return notice(nw, '請輸入新密碼。', 'error');
        if (a !== b) return notice(nw, '密碼不相符。', 'error');
        lp2busy = true;
        api('reset_password', { email: rlogin, key: rkey, password: a, token: '' }).then(function (j) {
          LS.set(SK, { email: j.email, token: j.token }); LS.set('yy_profile_' + j.email, j.profile || {});
          lp2.innerHTML = ''; notice(nw, '您的密碼已重設，並已自動登入。');
          setTimeout(function () { location.href = R + 'my-account/'; }, 1500);
        }, function (er) { lp2busy = false; sb.disabled = false; notice(nw, emsg(er), 'error'); });
      });
      lp = null;
    }
    if (lp) lp.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = (lp.querySelector('[name=user_login]') || {}).value || '', nw = $('.woocommerce-notices-wrapper', lp.closest('.woocommerce'));
      var sb = lp.querySelector('[type=submit]'), on = function () { if (sb) sb.disabled = false; };
      setTimeout(function () { if (sb) sb.disabled = !!(v && GAS); }, 0);
      if (!v) return notice(nw, '輸入使用者名稱或電子郵件地址。', 'error');
      if (GAS) api('lost_password', { email: v, token: '' }).then(function () { on(); notice(nw, '密碼重設電子郵件已寄出。若此電子郵件已註冊，您會收到一封含重設連結的郵件（1 小時內有效），請查看收件匣（也請檢查垃圾郵件）。' + (DEMO ? '<br>（展示模式不會真的寄信，信件內容可在後台「展示信箱」查看。）' : '')); }, function (er) { on(); notice(nw, emsg(er), 'error'); });
      else notice(nw, '請來信 <a href="mailto:' + esc(C.contactEmail) + '">' + esc(C.contactEmail) + '</a> 由客服協助重設密碼。', 'info');
    });
  }
  function initAccount() {
    if (!body.classList.contains('woocommerce-account')) return;
    var s = session(); if (!s) return;
    if (/lost-password/.test(location.pathname)) return;
    var lf = $('form.woocommerce-form-login, form.woocommerce-form-register');
    var root = $('#primary .entry-content > .woocommerce') || (lf && lf.closest('.woocommerce')) || $('#primary .woocommerce'); if (!root) return;
    body.classList.add('logged-in');
    var A = R + 'my-account/';
    var items = [['dashboard', '控制台', ''], ['orders', '訂單', 'orders'], ['edit-address', '地址', 'edit-address'], ['edit-account', '帳號詳細資料', 'edit-account'], ['customer-logout', '登出', 'customer-logout']];
    function route() {
      var h = location.hash.replace(/^#\/?/, '');
      if (h === 'customer-logout') { Auth.logout(); location.href = A; return; }
      var cur = h.split('/')[0] || 'dashboard';
      var nav = '<nav class="woocommerce-MyAccount-navigation" aria-label="帳號頁面"><ul>' + items.map(function (it) {
        return '<li class="woocommerce-MyAccount-navigation-link woocommerce-MyAccount-navigation-link--' + it[0] + (cur === it[0] || (cur === 'view-order' && it[0] === 'orders') ? ' is-active' : '') + '"><a href="' + A + (it[2] ? '#' + it[2] : '#') + '">' + it[1] + '</a></li>';
      }).join('') + '</ul></nav>';
      var name = s.email.split('@')[0];
      var pr = Auth.profile();
      var content = '';
      if (cur === 'dashboard') {
        content = '<p>Hello <strong>' + esc(name) + '</strong> (不是 <strong>' + esc(name) + '</strong>？ <a href="' + A + '#customer-logout">登出</a>)</p>' +
          '<p>在您的帳號控制台中，您可以檢視<a href="' + A + '#orders">近期訂單</a>、管理<a href="' + A + '#edit-address">收件地址和帳單地址</a>，以及<a href="' + A + '#edit-account">編輯密碼和帳號詳細資料</a>。</p>';
        paint(nav, content);
      } else if (cur === 'orders' || cur === 'view-order') {
        paint(nav, '<p>載入中…</p>');
        myOrders().catch(function (er) { paint(nav, '<div class="woocommerce-error">' + emsg(er) + '</div>'); return null; }).then(function (os) {
          if (!os) return;
          if (cur === 'view-order') {
            var o = os.filter(function (x) { return x.number === h.split('/')[1]; })[0];
            if (!o) return paint(nav, '<div class="woocommerce-error">訂單無效。</div>');
            return paint(nav, '<p>訂單 #<mark class="order-number">' + esc(o.number) + '</mark> 於 <mark class="order-date">' + zhDate(o.date) + '</mark> 下單，目前狀態為 <mark class="order-status">' + esc(o.status) + '</mark>。</p>' +
              '<section class="woocommerce-order-details"><h2 class="woocommerce-order-details__title">訂單詳細資料</h2>' + orderTable(o) + '</section>' +
              '<section class="woocommerce-customer-details"><h2 class="woocommerce-column__title">收件人資訊</h2><address>' + addressHTML(o.billing) + '</address></section>');
          }
          if (!os.length) return paint(nav, '<div class="woocommerce-message woocommerce-message--info woocommerce-Message woocommerce-Message--info woocommerce-info">還沒有任何訂單。<a class="woocommerce-Button button" href="' + R + 'shop/">瀏覽商品</a></div>');
          paint(nav, '<table class="woocommerce-orders-table woocommerce-MyAccount-orders shop_table shop_table_responsive my_account_orders account-orders-table"><thead><tr>' +
            ['order-number|訂單', 'order-date|日期', 'order-status|狀態', 'order-total|總計', 'order-actions|動作'].map(function (x) { x = x.split('|'); return '<th scope="col" class="woocommerce-orders-table__header woocommerce-orders-table__header-' + x[0] + '"><span class="nobr">' + x[1] + '</span></th>'; }).join('') +
            '</tr></thead><tbody>' + os.map(function (o) {
              var n = o.items.reduce(function (a, i) { return a + i.qty; }, 0);
              return '<tr class="woocommerce-orders-table__row order"><th class="woocommerce-orders-table__cell woocommerce-orders-table__cell-order-number" data-title="訂單" scope="row"><a href="' + A + '#view-order/' + o.number + '">#' + esc(o.number) + '</a></th>' +
                '<td class="woocommerce-orders-table__cell woocommerce-orders-table__cell-order-date" data-title="日期"><time>' + zhDate(o.date) + '</time></td>' +
                '<td class="woocommerce-orders-table__cell woocommerce-orders-table__cell-order-status" data-title="狀態">' + esc(o.status) + '</td>' +
                '<td class="woocommerce-orders-table__cell woocommerce-orders-table__cell-order-total" data-title="總計">' + amt(o.total) + '，共 ' + n + ' 件商品</td>' +
                '<td class="woocommerce-orders-table__cell woocommerce-orders-table__cell-order-actions" data-title="動作"><a href="' + A + '#view-order/' + o.number + '" class="woocommerce-button button view">檢視</a></td></tr>';
            }).join('') + '</tbody></table>');
        });
      } else if (cur === 'edit-address') {
        var f = [['billing_last_name', '姓氏'], ['billing_first_name', '名字'], ['billing_phone', '聯絡電話'], ['billing_postcode', '郵遞區號'], ['billing_state', '縣/市'], ['billing_city', '鄉鎮市'], ['billing_address_1', '街道地址'], ['billing_address_2', '公寓、套房、單元等']];
        paint(nav, '<p>以下地址將預設用於結帳頁面。</p><h2>收件人資訊</h2><form class="yy-addr-form">' + f.map(function (x) {
          return '<p class="form-row form-row-wide"><label for="' + x[0] + '">' + x[1] + '</label><span class="woocommerce-input-wrapper"><input type="text" class="input-text" name="' + x[0] + '" id="' + x[0] + '" value="' + esc(pr[x[0]] || '') + '"></span></p>';
        }).join('') + '<p><button type="submit" class="button" name="save_address">儲存地址</button></p></form>');
        $('.yy-addr-form').addEventListener('submit', function (e) {
          e.preventDefault(); var p = Auth.profile(); $$('.yy-addr-form input').forEach(function (i) { p[i.name] = i.value; });
          var nw = $('.woocommerce-notices-wrapper', root);
          Auth.saveProfile(p).then(function () { notice(nw, '地址已成功變更。'); }, function (er) { notice(nw, emsg(er), 'error'); });
        });
      } else if (cur === 'edit-account') {
        paint(nav, '<form class="woocommerce-EditAccountForm edit-account yy-acct-form"><p class="woocommerce-form-row form-row form-row-wide"><label>電子郵件地址</label><input type="email" class="woocommerce-Input input-text" value="' + esc(s.email) + '" disabled></p>' +
          '<fieldset><legend>密碼變更</legend><p class="woocommerce-form-row form-row form-row-wide"><label for="password_current">目前密碼（若不變更請留空）</label><input type="password" class="woocommerce-Input input-text" id="password_current" autocomplete="current-password"></p><p class="woocommerce-form-row form-row form-row-wide"><label for="password_1">新密碼（若不變更請留空）</label><input type="password" class="woocommerce-Input input-text" id="password_1" autocomplete="new-password"></p>' +
          '<p class="woocommerce-form-row form-row form-row-wide"><label for="password_2">確認新密碼</label><input type="password" class="woocommerce-Input input-text" id="password_2" autocomplete="new-password"></p></fieldset>' +
          '<p><button type="submit" class="woocommerce-Button button" name="save_account_details">儲存變更</button></p></form>');
        $('.yy-acct-form').addEventListener('submit', function (e) {
          e.preventDefault(); var a = $('#password_1').value, b = $('#password_2').value, nw = $('.woocommerce-notices-wrapper', root);
          if (!a) return notice(nw, '帳號詳細資料已成功變更。');
          if (a !== b) return notice(nw, '新密碼不相符。', 'error');
          var c0 = $('#password_current').value;
          if (!c0) return notice(nw, '請輸入目前的密碼。', 'error');
          Auth.changePassword(c0, a).then(function () { $$('.yy-acct-form input[type=password]').forEach(function (i) { i.value = ''; }); notice(nw, '帳號詳細資料已成功變更。'); }, function (er) { notice(nw, emsg(er), 'error'); });
        });
      }
    }
    function paint(nav, content) { root.innerHTML = '<div class="woocommerce-notices-wrapper"></div>' + nav + '<div class="woocommerce-MyAccount-content"><div class="woocommerce-notices-wrapper"></div>' + content + '</div>'; }
    window.addEventListener('hashchange', route);
    route();
    Auth.refresh().catch(function (er) { if (!session()) { location.href = A; } });
  }

  /* ================= mysticky contact form ================= */
  function sendContact(f) {
    var n = $('#contact-form-name', f), e = $('#contact-form-email', f), m = $('#contact-form-message', f), msg = $('#mse-form-error', f);
    var bad = false;
    [n, e, m].forEach(function (x) { if (!x) return; var ok = String(x.value).trim() && (x !== e || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.value)); x.classList.toggle('mse-input-error', !ok); if (!ok) bad = true; });
    if (bad) return;
    var data = { name: n.value, email: e.value, message: m.value, page: location.href, created: Date.now() };
    var show = function (t) { if (msg) { msg.textContent = t; msg.style.display = 'block'; } };
    if (GAS) {
      api('contact', { name: data.name, email: data.email, message: data.message, page: data.page, token: '' })
        .then(function () { show('Your message has been sent successfully. 感謝您的留言！'); f.reset(); }, function (er) { show(er.message || 'Something went wrong. 請稍後再試。'); });
    } else {
      var l = LS.get('yy_messages', []); l.push(data); LS.set('yy_messages', l);
      location.href = 'mailto:' + C.contactEmail + '?subject=' + encodeURIComponent('網站留言：' + data.name) + '&body=' + encodeURIComponent(data.message + '\n\n' + data.name + ' <' + data.email + '>');
      show('Your message has been sent successfully. 感謝您的留言！'); f.reset();
    }
  }

  /* ================= global event capture (runs before leftover plugin handlers) ================= */
  window.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.matches('form.woocommerce-product-search, form.search-form, form[role=search]')) {
      e.preventDefault(); e.stopPropagation();
      var v = (f.querySelector('[name=s]') || {}).value || '';
      location.href = R + 'shop/?s=' + encodeURIComponent(v.trim()) + '&post_type=product';
      return;
    }
    if (f.matches('form.cart') && !f.closest('.woocommerce-cart')) { e.preventDefault(); e.stopPropagation(); onSingleSubmit(f); return; }
    if (f.id === 'stickyelements-form') { e.preventDefault(); e.stopPropagation(); sendContact(f); return; }
    if (f.id === 'commentform') { e.preventDefault(); e.stopPropagation(); alert('感謝您的評價！'); f.reset(); }
  }, true);
  window.addEventListener('click', function (e) {
    var t = e.target;
    var st = t.closest('#stickyelements-submit-form');
    if (st) { e.preventDefault(); e.stopPropagation(); sendContact(st.form); return; }
    var aj = t.closest('a.ajax_add_to_cart, a[href*="add-to-cart="]');
    if (aj) {
      var pid = aj.dataset.product_id || (aj.getAttribute('href').match(/add-to-cart=(\d+)/) || [])[1];
      if (pid && D.products[pid] && D.products[pid].type !== 'variable') { e.preventDefault(); e.stopPropagation(); if (addSimple(pid, +(aj.dataset.quantity || 1))) aj.classList.add('added'); return; }
    }
    if (t.closest('.xoo-wsc-basket')) { e.preventDefault(); openSide(); return; }
    if (t.closest('.xoo-wsch-close, .xoo-wsc-opac, .xoo-wsc-cart-close')) { e.preventDefault(); closeSide(); return; }
    var row = t.closest('.xoo-wsc-product');
    if (row) {
      var key = row.dataset.key, it = cart().filter(function (i) { return i.key === key; })[0]; if (!it) return;
      if (t.closest('.xoo-wsc-smr-del')) { setQty(key, 0); return; }
      if (t.closest('.xoo-wsc-plus')) { setQty(key, it.qty + 1); return; }
      if (t.closest('.xoo-wsc-minus')) { setQty(key, it.qty - 1); return; }
    }
    var mr = t.closest('.widget_shopping_cart_content a.remove');
    if (mr) { e.preventDefault(); setQty(mr.dataset.key, 0); }
  }, true);
  document.addEventListener('change', function (e) {
    if (e.target.matches('.xoo-wsc-qty')) { var row = e.target.closest('.xoo-wsc-product'); setQty(row.dataset.key, parseInt(e.target.value, 10) || 0); }
    if (e.target.matches('.woocommerce-ordering select.orderby') && !window.jQuery) e.target.form.submit();
  });

  function renderAll() { renderSide(); renderHeader(); renderCartPage(); if (body.classList.contains('woocommerce-checkout') && !qs.get('order-received')) renderReview(); }

  /* ================= boot ================= */
  function boot() {
    renderSide(); renderHeader();
    initCartPage(); initCheckout(); bindLoginForms(); initAccount();
    var cc = GAS && !DEMO ? cachedCatalog() : null;
    catDone = !GAS;
    if (cc && gotCatalog(cc)) { npSig = JSON.stringify([catProducts, catOff]); mergeProducts(catProducts, catOff); }
    renderArchive(); initPriceFilter(); initRecent(); trackSource();
    if (cc) { applyOverrides(); renderNewProduct(false); applyStock(); }
    if (GAS) loadStock(!!cc && !!$('#yy-np') && !NP[qs.get('id')]).then(function (r) { afterCatalog(r === null); });
    else renderNewProduct(true, true);
    window.addEventListener('storage', function (e) { if (e.key === CK) renderAll(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
