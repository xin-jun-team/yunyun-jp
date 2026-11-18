/* 云云代購 — 展示模式引擎（build.py 會把 Catalog.gs + Code.gs 塞進 @@GAS@@ 產生 assets/yy-demo.js）
 * 在瀏覽器裡模擬 Google Apps Script + 試算表，讓「還沒接試算表」時前台＋後台也能完整操作。
 * 資料只存在這台裝置、這個瀏覽器的 localStorage；接上正式試算表後就不會再用到這個檔案。 */
(function () {
  'use strict';
  var BOOK = 'yy_demo_book', PROPS = 'yy_demo_props', CACHE = 'yy_demo_cache', MAILS = 'yy_demo_mails';
  var LSget = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var LSset = function (k, v) { localStorage.setItem(k, v); };

  /* ---------- SHA-256 / HMAC（同步、純 JS） ---------- */
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256(m) {
    var l = m.length, n = ((l + 9 + 63) >> 6) << 6, b = new Uint8Array(n), i, j;
    b.set(m); b[l] = 0x80;
    var bits = l * 8; b[n - 4] = bits >>> 24; b[n - 3] = bits >>> 16; b[n - 2] = bits >>> 8; b[n - 1] = bits; b[n - 5] = Math.floor(l / 0x20000000);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], W = new Array(64);
    for (i = 0; i < n; i += 64) {
      for (j = 0; j < 16; j++) W[j] = (b[i + j * 4] << 24) | (b[i + j * 4 + 1] << 16) | (b[i + j * 4 + 2] << 8) | b[i + j * 4 + 3];
      for (j = 16; j < 64; j++) {
        var x = W[j - 15], y = W[j - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3), s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        W[j] = (W[j - 16] + s0 + W[j - 7] + s1) | 0;
      }
      var a = H[0], c1 = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (j = 0; j < 64; j++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[j] + W[j]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var t2 = (S0 + ((a & c1) ^ (a & c) ^ (c1 & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = c1; c1 = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + c1) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var o = new Uint8Array(32);
    for (i = 0; i < 8; i++) { o[i * 4] = H[i] >>> 24; o[i * 4 + 1] = H[i] >>> 16; o[i * 4 + 2] = H[i] >>> 8; o[i * 4 + 3] = H[i]; }
    return o;
  }
  var enc = new TextEncoder(), dec = new TextDecoder();
  function u8(v) {
    if (v instanceof Uint8Array) return v;
    if (Array.isArray(v)) return Uint8Array.from(v, function (x) { return x & 255; });
    return enc.encode(String(v));
  }
  function signed(b) { return Array.prototype.map.call(b, function (x) { return x > 127 ? x - 256 : x; }); }
  function hmacSha(v, k) {
    var key = u8(k); if (key.length > 64) key = sha256(key);
    var ip = new Uint8Array(64), op = new Uint8Array(64);
    for (var i = 0; i < 64; i++) { ip[i] = (key[i] || 0) ^ 0x36; op[i] = (key[i] || 0) ^ 0x5c; }
    var m = u8(v), a = new Uint8Array(64 + m.length); a.set(ip); a.set(m, 64);
    var ih = sha256(a), b = new Uint8Array(96); b.set(op); b.set(ih, 64);
    return sha256(b);
  }
  function b64(v) { var b = u8(v), s = ''; for (var i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(s); }
  function unb64(s) { var t = atob(String(s)), o = new Uint8Array(t.length); for (var i = 0; i < t.length; i++) o[i] = t.charCodeAt(i); return o; }
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    var r = crypto.getRandomValues(new Uint8Array(16)); r[6] = (r[6] & 15) | 64; r[8] = (r[8] & 63) | 128;
    var h = Array.prototype.map.call(r, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  /* ---------- 試算表（存在 localStorage） ---------- */
  var ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  function Range(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr || 1; this.nc = nc || 1; }
  Range.prototype.setValues = function (v) { var t = this; v.forEach(function (row, i) { row.forEach(function (x, j) { t.sh.put(t.r + i, t.c + j, x); }); }); return this; };
  Range.prototype.setValue = function (x) { this.sh.put(this.r, this.c, x); return this; };
  Range.prototype.getValues = function () {
    var o = [];
    for (var i = 0; i < this.nr; i++) { var row = [], src = this.sh.d[this.r + i - 1] || []; for (var j = 0; j < this.nc; j++) { var v = src[this.c + j - 1]; row.push(v === undefined || v === null ? '' : (typeof v === 'string' && ISO.test(v) ? new Date(v) : v)); } o.push(row); }
    return o;
  };
  Range.prototype.setFontWeight = Range.prototype.setBackground = Range.prototype.setNumberFormat = function () { return this; };
  function Sheet(name, d) { this.name = name; this.d = d || []; }
  Sheet.prototype.getName = function () { return this.name; };
  Sheet.prototype.put = function (r, c, x) { while (this.d.length < r) this.d.push([]); if (typeof x === 'string' && x[0] === "'") x = x.slice(1); if (x instanceof Date) x = x.toISOString(); this.d[r - 1][c - 1] = x; };
  Sheet.prototype.getRange = function (r, c, nr, nc) { return new Range(this, r, c, nr, nc); };
  Sheet.prototype.getLastRow = function () { var n = this.d.length; while (n && !(this.d[n - 1] || []).some(function (v) { return v !== '' && v !== undefined && v !== null; })) n--; return n; };
  Sheet.prototype.appendRow = function (a) { var r = this.getLastRow() + 1, t = this; a.forEach(function (x, j) { t.put(r, j + 1, x); }); };
  Sheet.prototype.deleteRow = function (r) { this.d.splice(r - 1, 1); };
  Sheet.prototype.setFrozenRows = function () { };

  var book = null, bookRaw = null;
  function load() {
    var raw = LSget(BOOK) || '[]';
    if (raw === bookRaw && book) return;
    var a = []; try { a = JSON.parse(raw) || []; } catch (e) { }
    book = a.map(function (s) { return new Sheet(s.n, s.d); }); bookRaw = raw;
  }
  function save() { var raw = JSON.stringify(book.map(function (s) { return { n: s.name, d: s.d }; })); if (raw !== bookRaw) { LSset(BOOK, raw); bookRaw = raw; } }
  var SS = {
    getSheetByName: function (n) { return book.filter(function (s) { return s.name === n; })[0] || null; },
    insertSheet: function (n) { var s = new Sheet(n); book.push(s); return s; },
    getSheets: function () { return book; }, deleteSheet: function (s) { book = book.filter(function (x) { return x !== s; }); },
    getUrl: function () { return ''; }
  };
  function store(k) {
    var o = {}; try { o = JSON.parse(LSget(k) || '{}') || {}; } catch (e) { }
    return { o: o, save: function () { LSset(k, JSON.stringify(o)); } };
  }

  /* ---------- Apps Script 服務 ---------- */
  var SpreadsheetApp = { getActiveSpreadsheet: function () { return SS; } };
  var LockService = { getScriptLock: function () { return { waitLock: function () { }, releaseLock: function () { } }; } };
  var CacheService = {
    getScriptCache: function () {
      return {
        get: function (k) { var c = store(CACHE).o[k]; return c && c.e > Date.now() ? c.v : null; },
        put: function (k, v, s) { var c = store(CACHE); c.o[k] = { v: v, e: Date.now() + (s || 600) * 1000 }; Object.keys(c.o).forEach(function (x) { if (c.o[x].e < Date.now()) delete c.o[x]; }); c.save(); },
        remove: function (k) { var c = store(CACHE); delete c.o[k]; c.save(); }
      };
    }
  };
  var PropertiesService = {
    getScriptProperties: function () {
      return {
        getProperty: function (k) { var o = store(PROPS).o; return k in o ? o[k] : null; },
        setProperty: function (k, v) { var p = store(PROPS); p.o[k] = String(v); p.save(); },
        setProperties: function (x) { var p = store(PROPS); Object.keys(x).forEach(function (k) { p.o[k] = String(x[k]); }); p.save(); },
        deleteProperty: function (k) { var p = store(PROPS); delete p.o[k]; p.save(); }
      };
    }
  };
  var Utilities = {
    getUuid: uuid, DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: function (a, s) { return signed(sha256(u8(s))); },
    computeHmacSha256Signature: function (v, k) { return signed(hmacSha(v, k)); },
    base64Encode: function (v) { return b64(v); },
    base64EncodeWebSafe: function (v) { return b64(v).replace(/\+/g, '-').replace(/\//g, '_'); },
    base64DecodeWebSafe: function (s) { return signed(unb64(String(s).replace(/-/g, '+').replace(/_/g, '/'))); },
    base64Decode: function (s) { return signed(unb64(s)); },
    newBlob: function (b) { return { getDataAsString: function () { return dec.decode(u8(b)); } }; },
    formatDate: function (d) { return new Date(d.getTime() + 8 * 36e5).toISOString().slice(0, 10); }
  };
  var MailApp = {
    getRemainingDailyQuota: function () { return 100; },
    sendEmail: function (o) {
      var l = []; try { l = JSON.parse(LSget(MAILS) || '[]'); } catch (e) { }
      l.unshift({ t: Date.now(), to: o.to, subject: o.subject, html: o.htmlBody, from: o.name });
      LSset(MAILS, JSON.stringify(l.slice(0, 40)));
    }
  };
  var Session = { getEffectiveUser: function () { return { getEmail: function () { return '店主信箱（展示）'; } }; } };
  var ContentService = { MimeType: { JSON: 'json' }, createTextOutput: function (s) { return { s: s, setMimeType: function () { return this; } }; } };
  var Logger = { log: function () { } };
  var DriveApp = null;

  /* ---------- 後端程式（與正式版完全相同） ---------- */
  // 由 make_catalog.py 產生：setup() 第一次執行時寫入「商品庫存」分頁（之後新增的列由 seedMissing() 補上）
const CATALOG_SEED = [
{"id": "6922", "parent": "", "name": "售完JILL STUART｜2026年年末聖誕禮盒＊夢境公主組", "option": "", "price": 2880, "in_stock": false, "qty": ""},
{"id": "6958", "parent": "6948", "name": "JILL STUART｜夢境公主限定彩妝系列", "option": "唇頰 103 hidden rose 玫瑰粉", "price": 1130, "in_stock": true, "qty": ""},
{"id": "6959", "parent": "6948", "name": "JILL STUART｜夢境公主限定彩妝系列", "option": "唇頰 104 blessed dream 奶茶粉", "price": 1130, "in_stock": true, "qty": ""},
{"id": "6960", "parent": "6948", "name": "JILL STUART｜夢境公主限定彩妝系列", "option": "腮紅 102 princess lullaby 淡藍紫粉色調", "price": 1520, "in_stock": true, "qty": ""},
{"id": "6961", "parent": "6948", "name": "JILL STUART｜夢境公主限定彩妝系列", "option": "腮紅 103 moon latte 淡珊瑚橘色調", "price": 1520, "in_stock": true, "qty": ""},
{"id": "6962", "parent": "6948", "name": "JILL STUART｜夢境公主限定彩妝系列", "option": "眼影 107 persian paws 浪漫粉", "price": 980, "in_stock": true, "qty": ""},
{"id": "6963", "parent": "6948", "name": "JILL STUART｜夢境公主限定彩妝系列", "option": "眼影 108 milky prism 奶油白", "price": 980, "in_stock": true, "qty": ""},
{"id": "6964", "parent": "6948", "name": "JILL STUART｜夢境公主限定彩妝系列", "option": "眼影 109 vintage waltz 奶茶灰", "price": 980, "in_stock": true, "qty": ""},
{"id": "6965", "parent": "6948", "name": "JILL STUART｜夢境公主限定彩妝系列", "option": "潤唇膏 108 dreamy berry 櫻桃紅", "price": 1120, "in_stock": true, "qty": ""},
{"id": "6966", "parent": "6948", "name": "JILL STUART｜夢境公主限定彩妝系列", "option": "潤唇膏 109 coral whisper 珊瑚粉", "price": 1120, "in_stock": true, "qty": ""},
{"id": "6967", "parent": "6948", "name": "JILL STUART｜夢境公主限定彩妝系列", "option": "潤唇膏 110 sugar nap 極光粉", "price": 1120, "in_stock": true, "qty": ""},
{"id": "6953", "parent": "6950", "name": "JILL STUART｜酸甜白花香年末小禮盒", "option": "組合1.夜晚全身呵護組", "price": 1580, "in_stock": true, "qty": ""},
{"id": "6954", "parent": "6950", "name": "JILL STUART｜酸甜白花香年末小禮盒", "option": "組合2.沐浴全身療癒組", "price": 1220, "in_stock": true, "qty": ""},
{"id": "6955", "parent": "6950", "name": "JILL STUART｜酸甜白花香年末小禮盒", "option": "組合3.夜晚重點呵護組", "price": 700, "in_stock": true, "qty": ""},
{"id": "6901", "parent": "6896", "name": "JILL STUART｜限定鮮嫩多汁水蜜桃系列", "option": "鮮嫩多汁蜜桃淡香精", "price": 1450, "in_stock": false, "qty": ""},
{"id": "6902", "parent": "6896", "name": "JILL STUART｜限定鮮嫩多汁水蜜桃系列", "option": "鮮嫩多汁蜜桃免沖洗護髮霜", "price": 1040, "in_stock": true, "qty": ""},
{"id": "6903", "parent": "6896", "name": "JILL STUART｜限定鮮嫩多汁水蜜桃系列", "option": "鮮嫩多汁蜜桃深層滋潤護手霜", "price": 950, "in_stock": true, "qty": ""},
{"id": "6890", "parent": "6877", "name": "JILL STUART｜鮮嫩多汁水蜜桃新商品", "option": "滾珠瓶淡香精香水 EDT", "price": 780, "in_stock": true, "qty": ""},
{"id": "6891", "parent": "6877", "name": "JILL STUART｜鮮嫩多汁水蜜桃新商品", "option": "水晶鑽身體乳", "price": 1220, "in_stock": true, "qty": ""},
{"id": "6892", "parent": "6877", "name": "JILL STUART｜鮮嫩多汁水蜜桃新商品", "option": "護手霜", "price": 600, "in_stock": true, "qty": ""},
{"id": "6893", "parent": "6877", "name": "JILL STUART｜鮮嫩多汁水蜜桃新商品", "option": "唇凍", "price": 700, "in_stock": true, "qty": ""},
{"id": "6864", "parent": "6856", "name": "ANNA SUI｜2026年聖誕禮盒＆新品", "option": "2026年聖誕禮盒組", "price": 2400, "in_stock": true, "qty": ""},
{"id": "6865", "parent": "6856", "name": "ANNA SUI｜2026年聖誕禮盒＆新品", "option": "戒指唇膏 001 粉白色", "price": 800, "in_stock": true, "qty": ""},
{"id": "6866", "parent": "6856", "name": "ANNA SUI｜2026年聖誕禮盒＆新品", "option": "戒指唇膏 301 奶粉色", "price": 800, "in_stock": true, "qty": ""},
{"id": "6867", "parent": "6856", "name": "ANNA SUI｜2026年聖誕禮盒＆新品", "option": "戒指唇膏 601 橘紅色", "price": 800, "in_stock": true, "qty": ""},
{"id": "6868", "parent": "6856", "name": "ANNA SUI｜2026年聖誕禮盒＆新品", "option": "玫瑰身體保濕霜", "price": 1250, "in_stock": true, "qty": ""},
{"id": "6869", "parent": "6856", "name": "ANNA SUI｜2026年聖誕禮盒＆新品", "option": "洗手護手組", "price": 1280, "in_stock": true, "qty": ""},
{"id": "6846", "parent": "6845", "name": "售完ANNA SUI x ADO｜藍玫瑰限定聯名", "option": "ANNA SUI x Ado 藍玫瑰唇膏A", "price": 1250, "in_stock": false, "qty": ""},
{"id": "6847", "parent": "6845", "name": "售完ANNA SUI x ADO｜藍玫瑰限定聯名", "option": "ANNA SUI x Ado 戒指型潤唇膏A", "price": 890, "in_stock": false, "qty": ""},
{"id": "6848", "parent": "6845", "name": "售完ANNA SUI x ADO｜藍玫瑰限定聯名", "option": "ANNA SUI x Ado彩繪風藍玫瑰復古鏡A", "price": 1220, "in_stock": false, "qty": ""},
{"id": "6849", "parent": "6845", "name": "售完ANNA SUI x ADO｜藍玫瑰限定聯名", "option": "ANNA SUI x Ado指甲油A01", "price": 660, "in_stock": false, "qty": ""},
{"id": "6850", "parent": "6845", "name": "售完ANNA SUI x ADO｜藍玫瑰限定聯名", "option": "ANNA SUI x Ado指甲油A02", "price": 660, "in_stock": false, "qty": ""},
{"id": "6851", "parent": "6845", "name": "售完ANNA SUI x ADO｜藍玫瑰限定聯名", "option": "ANNA SUI x Ado指甲油A03", "price": 660, "in_stock": false, "qty": ""},
{"id": "6852", "parent": "6845", "name": "售完ANNA SUI x ADO｜藍玫瑰限定聯名", "option": "ANNA SUI x Ado 指甲貼A", "price": 520, "in_stock": false, "qty": ""},
{"id": "6840", "parent": "6834", "name": "Flora Notis JILL STUART｜2026年年末星辰之冬禮盒、單品", "option": "年末禮盒全身四瓶組", "price": 2800, "in_stock": true, "qty": ""},
{"id": "6841", "parent": "6834", "name": "Flora Notis JILL STUART｜2026年年末星辰之冬禮盒、單品", "option": "香棒狀香膏", "price": 1320, "in_stock": true, "qty": ""},
{"id": "6842", "parent": "6834", "name": "Flora Notis JILL STUART｜2026年年末星辰之冬禮盒、單品", "option": "護手霜", "price": 700, "in_stock": true, "qty": ""},
{"id": "6843", "parent": "6834", "name": "Flora Notis JILL STUART｜2026年年末星辰之冬禮盒、單品", "option": "護髮油三種香味組", "price": 1550, "in_stock": true, "qty": ""},
{"id": "6756", "parent": "6744", "name": "Flora Notis JILL STUART｜頭皮深層去角質洗髮霜、洗髮梳", "option": "頭皮深層去角質洗髮霜", "price": 1400, "in_stock": true, "qty": ""},
{"id": "6757", "parent": "6744", "name": "Flora Notis JILL STUART｜頭皮深層去角質洗髮霜、洗髮梳", "option": "按摩洗髮梳", "price": 880, "in_stock": true, "qty": ""},
{"id": "6725", "parent": "6715", "name": "JILL STUART｜白花香面膜＆白花香浴鹽", "option": "🌷白花香保濕面膜 16ml 一片", "price": 280, "in_stock": true, "qty": ""},
{"id": "6726", "parent": "6715", "name": "JILL STUART｜白花香面膜＆白花香浴鹽", "option": "🌷白花香浴鹽 30g", "price": 230, "in_stock": true, "qty": ""},
{"id": "6706", "parent": "6670", "name": "JILL STUART｜幻彩月光系列", "option": "🌙眼影101 亮粉膚色", "price": 950, "in_stock": true, "qty": ""},
{"id": "6707", "parent": "6670", "name": "JILL STUART｜幻彩月光系列", "option": "🌙眼影102 粉紫色", "price": 950, "in_stock": true, "qty": ""},
{"id": "6708", "parent": "6670", "name": "JILL STUART｜幻彩月光系列", "option": "🌙打亮液 米白色", "price": 1120, "in_stock": true, "qty": ""},
{"id": "6709", "parent": "6670", "name": "JILL STUART｜幻彩月光系列", "option": "🌙我的唇色 01 亮粉橘色", "price": 1120, "in_stock": true, "qty": ""},
{"id": "6710", "parent": "6670", "name": "JILL STUART｜幻彩月光系列", "option": "🌙我的唇色 02 乾燥玫瑰色", "price": 1120, "in_stock": true, "qty": ""},
{"id": "6711", "parent": "6670", "name": "JILL STUART｜幻彩月光系列", "option": "🌙水光透明唇釉", "price": 1120, "in_stock": true, "qty": ""},
{"id": "6712", "parent": "6670", "name": "JILL STUART｜幻彩月光系列", "option": "🌙月光鏡", "price": 1150, "in_stock": true, "qty": ""},
{"id": "6642", "parent": "6638", "name": "Flora Notis JILL STUART｜秋季桂花系列", "option": "桂花潤唇膏", "price": 1060, "in_stock": true, "qty": ""},
{"id": "6643", "parent": "6638", "name": "Flora Notis JILL STUART｜秋季桂花系列", "option": "桂花指緣油", "price": 960, "in_stock": true, "qty": ""},
{"id": "6644", "parent": "6638", "name": "Flora Notis JILL STUART｜秋季桂花系列", "option": "桂花入浴劑", "price": 1350, "in_stock": true, "qty": ""},
{"id": "6645", "parent": "6638", "name": "Flora Notis JILL STUART｜秋季桂花系列", "option": "桂花修護洗髮精", "price": 1220, "in_stock": true, "qty": ""},
{"id": "6646", "parent": "6638", "name": "Flora Notis JILL STUART｜秋季桂花系列", "option": "桂花修護潤髮", "price": 1220, "in_stock": true, "qty": ""},
{"id": "6647", "parent": "6638", "name": "Flora Notis JILL STUART｜秋季桂花系列", "option": "桂花香水＆桂花護髮油組", "price": 1650, "in_stock": true, "qty": ""},
{"id": "6630", "parent": "6621", "name": "Flora Notis JILL STUART｜清新橙花涼爽系列", "option": "清新橙花香水", "price": 1330, "in_stock": true, "qty": ""},
{"id": "6631", "parent": "6621", "name": "Flora Notis JILL STUART｜清新橙花涼爽系列", "option": "清新橙花涼感頭皮洗髮霜", "price": 1450, "in_stock": true, "qty": ""},
{"id": "6632", "parent": "6621", "name": "Flora Notis JILL STUART｜清新橙花涼爽系列", "option": "清新橙花涼感全身UV噴霧", "price": 1090, "in_stock": true, "qty": ""},
{"id": "6519", "parent": "6498", "name": "JILL STUART｜2026秋季彩妝新品＋限定", "option": "唇頰01 peony romance 珊瑚粉", "price": 1130, "in_stock": true, "qty": ""},
{"id": "6520", "parent": "6498", "name": "JILL STUART｜2026秋季彩妝新品＋限定", "option": "唇頰02 carnation rust 奶茶粉", "price": 1130, "in_stock": true, "qty": ""},
{"id": "6521", "parent": "6498", "name": "JILL STUART｜2026秋季彩妝新品＋限定", "option": "唇頰 03 ranunculus silence 牛奶粉", "price": 1130, "in_stock": true, "qty": ""},
{"id": "6522", "parent": "6498", "name": "JILL STUART｜2026秋季彩妝新品＋限定", "option": "唇頰04 daisy couture 玫瑰粉", "price": 1130, "in_stock": true, "qty": ""},
{"id": "6523", "parent": "6498", "name": "JILL STUART｜2026秋季彩妝新品＋限定", "option": "唇頰 05 lacy dahlia 乾燥玫瑰", "price": 1130, "in_stock": true, "qty": ""},
{"id": "6524", "parent": "6498", "name": "JILL STUART｜2026秋季彩妝新品＋限定", "option": "唇頰06 rosy plum 玫瑰紫", "price": 1130, "in_stock": true, "qty": ""},
{"id": "6525", "parent": "6498", "name": "JILL STUART｜2026秋季彩妝新品＋限定", "option": "唇頰 101 velvet camellia 山茶紅", "price": 1130, "in_stock": true, "qty": ""},
{"id": "6526", "parent": "6498", "name": "JILL STUART｜2026秋季彩妝新品＋限定", "option": "唇頰102 osmanthus eden 珊瑚橘", "price": 1130, "in_stock": true, "qty": ""},
{"id": "6527", "parent": "6498", "name": "JILL STUART｜2026秋季彩妝新品＋限定", "option": "眼影05 spiced orchid 奶茶x金色系", "price": 1990, "in_stock": true, "qty": ""},
{"id": "6528", "parent": "6498", "name": "JILL STUART｜2026秋季彩妝新品＋限定", "option": "眼影06 violet mist 紫色x煙燻色調", "price": 1990, "in_stock": true, "qty": ""},
{"id": "6533", "parent": "6498", "name": "JILL STUART｜2026秋季彩妝新品＋限定", "option": "第二代-替換眼影刷", "price": 280, "in_stock": true, "qty": ""},
{"id": "6529", "parent": "6498", "name": "JILL STUART｜2026秋季彩妝新品＋限定", "option": "打亮101 lilylight mirage 粉白x粉色", "price": 1530, "in_stock": true, "qty": ""},
{"id": "6530", "parent": "6498", "name": "JILL STUART｜2026秋季彩妝新品＋限定", "option": "潤唇膏 106 soft embrace 淺粉色", "price": 1120, "in_stock": true, "qty": ""},
{"id": "6531", "parent": "6498", "name": "JILL STUART｜2026秋季彩妝新品＋限定", "option": "潤唇膏 107 corsage dream 酒紅色", "price": 1120, "in_stock": true, "qty": ""},
{"id": "6028", "parent": "6027", "name": "JILL STUART｜光澤雪紡肌提亮妝前", "option": "01 fancy tulle 寶寶粉", "price": 1130, "in_stock": true, "qty": ""},
{"id": "6029", "parent": "6027", "name": "JILL STUART｜光澤雪紡肌提亮妝前", "option": "02 lacy veil 薰衣草紫", "price": 1130, "in_stock": true, "qty": ""},
{"id": "6030", "parent": "6027", "name": "JILL STUART｜光澤雪紡肌提亮妝前", "option": "03 bustier dress 冰川藍", "price": 1130, "in_stock": true, "qty": ""},
{"id": "6002", "parent": "6001", "name": "JILL STUART｜夏季限定清涼白花香系列", "option": "頭皮深層清潔洗髮霜", "price": 1290, "in_stock": false, "qty": ""},
{"id": "6003", "parent": "6001", "name": "JILL STUART｜夏季限定清涼白花香系列", "option": "瀏海睫毛膏式定型液", "price": 800, "in_stock": true, "qty": ""},
{"id": "6004", "parent": "6001", "name": "JILL STUART｜夏季限定清涼白花香系列", "option": "全身噴霧", "price": 980, "in_stock": false, "qty": ""},
{"id": "6005", "parent": "6001", "name": "JILL STUART｜夏季限定清涼白花香系列", "option": "UV全身防曬噴霧", "price": 850, "in_stock": true, "qty": ""},
{"id": "6006", "parent": "6001", "name": "JILL STUART｜夏季限定清涼白花香系列", "option": "UV防曬唇部精華", "price": 710, "in_stock": false, "qty": ""},
{"id": "5992", "parent": "5964", "name": "JILL STUART｜20週年第三彈香甜夢復刻版", "option": "【預購已結束】香水", "price": 2340, "in_stock": true, "qty": ""},
{"id": "5993", "parent": "5964", "name": "JILL STUART｜20週年第三彈香甜夢復刻版", "option": "粉色潤色防曬乳", "price": 1220, "in_stock": true, "qty": ""},
{"id": "5994", "parent": "5964", "name": "JILL STUART｜20週年第三彈香甜夢復刻版", "option": "臉部&全身滾珠蜜粉", "price": 1850, "in_stock": true, "qty": ""},
{"id": "5995", "parent": "5964", "name": "JILL STUART｜20週年第三彈香甜夢復刻版", "option": "髮香噴霧", "price": 1090, "in_stock": true, "qty": ""},
{"id": "5751", "parent": "5750", "name": "JILL STUART｜高訂感四格腮紅盤", "option": "01 daydream dress 粉色調腮紅盤", "price": 1520, "in_stock": true, "qty": ""},
{"id": "5752", "parent": "5750", "name": "JILL STUART｜高訂感四格腮紅盤", "option": "02 early bloom 粉橘色調腮紅盤", "price": 1520, "in_stock": true, "qty": ""},
{"id": "5753", "parent": "5750", "name": "JILL STUART｜高訂感四格腮紅盤", "option": "03 rosy horizon 奶茶粉調腮紅盤", "price": 1520, "in_stock": true, "qty": ""},
{"id": "5754", "parent": "5750", "name": "JILL STUART｜高訂感四格腮紅盤", "option": "04 peppy peach 珊瑚粉調腮紅盤", "price": 1520, "in_stock": true, "qty": ""},
{"id": "5755", "parent": "5750", "name": "JILL STUART｜高訂感四格腮紅盤", "option": "05 midnight minuet 玫瑰粉調腮紅盤", "price": 1520, "in_stock": true, "qty": ""},
{"id": "5757", "parent": "5750", "name": "JILL STUART｜高訂感四格腮紅盤", "option": "第二代腮紅刷", "price": 850, "in_stock": true, "qty": ""},
{"id": "5687", "parent": "5685", "name": "JILL STUART｜迷你版高防曬亮采鑽石＆無暇珍珠光妝前乳", "option": "01 lavender gem", "price": 750, "in_stock": true, "qty": ""},
{"id": "5688", "parent": "5685", "name": "JILL STUART｜迷你版高防曬亮采鑽石＆無暇珍珠光妝前乳", "option": "02 diamond gem", "price": 750, "in_stock": true, "qty": ""},
{"id": "5689", "parent": "5685", "name": "JILL STUART｜迷你版高防曬亮采鑽石＆無暇珍珠光妝前乳", "option": "03 pink opal gem", "price": 750, "in_stock": true, "qty": ""},
{"id": "5690", "parent": "5685", "name": "JILL STUART｜迷你版高防曬亮采鑽石＆無暇珍珠光妝前乳", "option": "Flawless Gem", "price": 750, "in_stock": true, "qty": ""},
{"id": "5679", "parent": "5678", "name": "JILL STUART｜柔光定妝蜜粉", "option": "01 自然柔和感粉膚色 無珠光", "price": 1620, "in_stock": true, "qty": ""},
{"id": "5680", "parent": "5678", "name": "JILL STUART｜柔光定妝蜜粉", "option": "02 細緻珠光血色感粉色 珠光", "price": 1620, "in_stock": true, "qty": ""},
{"id": "5681", "parent": "5678", "name": "JILL STUART｜柔光定妝蜜粉", "option": "03華麗光澤透明感紫色 珠光", "price": 1620, "in_stock": true, "qty": ""},
{"id": "5682", "parent": "5678", "name": "JILL STUART｜柔光定妝蜜粉", "option": "04高級光澤感貝殼米白色 珠光", "price": 1620, "in_stock": true, "qty": ""},
{"id": "5606", "parent": "", "name": "Flora Notis JILL STUART｜清香花香經典綻放香水", "option": "", "price": 3080, "in_stock": true, "qty": ""},
{"id": "5562", "parent": "5550", "name": "JILL STUART｜明亮柔焦薄紗粉餅", "option": "200 light 粉調明亮色", "price": 1140, "in_stock": true, "qty": ""},
{"id": "5563", "parent": "5550", "name": "JILL STUART｜明亮柔焦薄紗粉餅", "option": "101 linen 明亮色", "price": 1140, "in_stock": true, "qty": ""},
{"id": "5564", "parent": "5550", "name": "JILL STUART｜明亮柔焦薄紗粉餅", "option": "202 ivory 粉膚色", "price": 1140, "in_stock": true, "qty": ""},
{"id": "5565", "parent": "5550", "name": "JILL STUART｜明亮柔焦薄紗粉餅", "option": "103 nude 自然色", "price": 1140, "in_stock": true, "qty": ""},
{"id": "5566", "parent": "5550", "name": "JILL STUART｜明亮柔焦薄紗粉餅", "option": "204 sand 裸膚色", "price": 1140, "in_stock": true, "qty": ""},
{"id": "5567", "parent": "5550", "name": "JILL STUART｜明亮柔焦薄紗粉餅", "option": "105 tan 健康色", "price": 1140, "in_stock": true, "qty": ""},
{"id": "5568", "parent": "5550", "name": "JILL STUART｜明亮柔焦薄紗粉餅", "option": "粉盒（含粉撲）", "price": 590, "in_stock": true, "qty": ""},
{"id": "5569", "parent": "5550", "name": "JILL STUART｜明亮柔焦薄紗粉餅", "option": "粉撲（單顆）", "price": 225, "in_stock": true, "qty": ""},
{"id": "5527", "parent": "5526", "name": "JILL STUART｜漸層色立體壓花腮紅 ＆ 花瓣腮紅粉撲", "option": "01 apricot daisy 杏色", "price": 1430, "in_stock": true, "qty": ""},
{"id": "5528", "parent": "5526", "name": "JILL STUART｜漸層色立體壓花腮紅 ＆ 花瓣腮紅粉撲", "option": "02 baby tulip 淡粉色", "price": 1430, "in_stock": true, "qty": ""},
{"id": "5529", "parent": "5526", "name": "JILL STUART｜漸層色立體壓花腮紅 ＆ 花瓣腮紅粉撲", "option": "03 misty lilac 紫丁香色", "price": 1430, "in_stock": true, "qty": ""},
{"id": "5530", "parent": "5526", "name": "JILL STUART｜漸層色立體壓花腮紅 ＆ 花瓣腮紅粉撲", "option": "04 dressed peony 牡丹粉", "price": 1430, "in_stock": true, "qty": ""},
{"id": "5531", "parent": "5526", "name": "JILL STUART｜漸層色立體壓花腮紅 ＆ 花瓣腮紅粉撲", "option": "05 muted dahlia 橘紅色", "price": 1430, "in_stock": true, "qty": ""},
{"id": "5532", "parent": "5526", "name": "JILL STUART｜漸層色立體壓花腮紅 ＆ 花瓣腮紅粉撲", "option": "06 mellow ranunculus 珊瑚橘", "price": 1430, "in_stock": true, "qty": ""},
{"id": "5533", "parent": "5526", "name": "JILL STUART｜漸層色立體壓花腮紅 ＆ 花瓣腮紅粉撲", "option": "07 sweetness gerbera 蜜桃珊瑚橘", "price": 1430, "in_stock": true, "qty": ""},
{"id": "5548", "parent": "5526", "name": "JILL STUART｜漸層色立體壓花腮紅 ＆ 花瓣腮紅粉撲", "option": "腮紅＋花瓣粉撲，請備註色號", "price": 1720, "in_stock": true, "qty": ""},
{"id": "5484", "parent": "5483", "name": "JILL STUART｜花瓣立體眼影", "option": "01 satin dahlia 粉色x棕色系", "price": 1990, "in_stock": true, "qty": ""},
{"id": "5485", "parent": "5483", "name": "JILL STUART｜花瓣立體眼影", "option": "02 peony embroidery 粉色x酒紅色系", "price": 1990, "in_stock": true, "qty": ""},
{"id": "5486", "parent": "5483", "name": "JILL STUART｜花瓣立體眼影", "option": "03 marigold chiffon 珊瑚橘x紅棕色系", "price": 1990, "in_stock": true, "qty": ""},
{"id": "5487", "parent": "5483", "name": "JILL STUART｜花瓣立體眼影", "option": "04 rose boutique 玫瑰x棕色系", "price": 1990, "in_stock": true, "qty": ""},
{"id": "5488", "parent": "5483", "name": "JILL STUART｜花瓣立體眼影", "option": "05 lacy dahlia 乾燥玫瑰", "price": 1960, "in_stock": true, "qty": ""},
{"id": "5489", "parent": "5483", "name": "JILL STUART｜花瓣立體眼影", "option": "06 rosy plum 玫瑰紫", "price": 1960, "in_stock": true, "qty": ""},
{"id": "6550", "parent": "5483", "name": "JILL STUART｜花瓣立體眼影", "option": "第二代替換眼影刷-短款2支", "price": 290, "in_stock": true, "qty": ""},
{"id": "6551", "parent": "5483", "name": "JILL STUART｜花瓣立體眼影", "option": "眼影刷第二代-長款", "price": 700, "in_stock": true, "qty": ""},
{"id": "5462", "parent": "5460", "name": "JILL STUART｜水晶綻放浪漫粉系列", "option": "水晶綻放香水身體乳", "price": 1900, "in_stock": true, "qty": ""},
{"id": "5463", "parent": "5460", "name": "JILL STUART｜水晶綻放浪漫粉系列", "option": "水晶綻放香水護手霜", "price": 920, "in_stock": true, "qty": ""},
{"id": "5464", "parent": "5460", "name": "JILL STUART｜水晶綻放浪漫粉系列", "option": "水晶綻放edp香水 30ml", "price": 1920, "in_stock": true, "qty": ""},
{"id": "5465", "parent": "5460", "name": "JILL STUART｜水晶綻放浪漫粉系列", "option": "水晶綻放edp香水 50ml", "price": 2580, "in_stock": true, "qty": ""},
{"id": "5456", "parent": "5452", "name": "JILL STUART｜奢華璀璨晶透淡香水", "option": "30ml", "price": 2000, "in_stock": true, "qty": ""},
{"id": "5457", "parent": "5452", "name": "JILL STUART｜奢華璀璨晶透淡香水", "option": "50ml", "price": 2680, "in_stock": true, "qty": ""},
{"id": "5414", "parent": "5413", "name": "JILL STUART｜年末小禮盒套組", "option": "白花香小組合", "price": 1500, "in_stock": true, "qty": ""},
{"id": "5415", "parent": "5413", "name": "JILL STUART｜年末小禮盒套組", "option": "奶茶味小組合", "price": 1500, "in_stock": true, "qty": ""},
{"id": "5416", "parent": "5413", "name": "JILL STUART｜年末小禮盒套組", "option": "莓果味小組合", "price": 1500, "in_stock": true, "qty": ""},
{"id": "5347", "parent": "5345", "name": "JILL STUART｜全身護膚系列", "option": "白花香身體乳", "price": 1250, "in_stock": true, "qty": ""},
{"id": "5348", "parent": "5345", "name": "JILL STUART｜全身護膚系列", "option": "白花香髮香噴霧", "price": 940, "in_stock": true, "qty": ""},
{"id": "5288", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "01 geranium lilac　紫丁香-淡紫", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5289", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "02 sweet pea pink　香碗豆-粉紅", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5290", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "03 gerbera coral　非洲菊-珊瑚橘", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5291", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "04 carnation blush　康乃馨-珊瑚粉", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5292", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "05 lily fuchsia　百合-淡紫粉", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5293", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "06 rose redwood　玫瑰-玫瑰粉", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5294", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "07 violet grape　紫花地丁-深紫", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5295", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "08 majestic dahlia　大麗花-紅棕", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5296", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "09 smoky protea　普提花-煙燻紅", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5297", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "10 nudy zinnia　百日菊-奶茶粉", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5298", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "11 camellia ruby　山茶花-寶石紅", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5299", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "12 lupine sparkle　魯冰花-薰衣草紫", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5300", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "13 twinkle cosmos　大波斯菊-寶寶粉", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5301", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "14 ranunculus sparkle　洋牡丹-粉膚", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5302", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "15 salvia rouge　鼠尾草-透明紅", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5303", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "★114 lustrous begonia　海棠-金黃粉 ★限定色", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5304", "parent": "5287", "name": "JILL STUART｜水晶綻放水潤花束唇釉", "option": "★115 clear leucocoryne　白絲蘭-薄荷透藍 ★限定色", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5257", "parent": "5256", "name": "JILL STUART｜黃金三角鑽石遮瑕液", "option": "C00 fair beige 透亮膚色", "price": 1090, "in_stock": true, "qty": ""},
{"id": "5258", "parent": "5256", "name": "JILL STUART｜黃金三角鑽石遮瑕液", "option": " C01 linen beige  明亮膚色", "price": 1090, "in_stock": true, "qty": ""},
{"id": "5259", "parent": "5256", "name": "JILL STUART｜黃金三角鑽石遮瑕液", "option": " C02 nude beige  自然膚色", "price": 1090, "in_stock": true, "qty": ""},
{"id": "5260", "parent": "5256", "name": "JILL STUART｜黃金三角鑽石遮瑕液", "option": " C03 sepia beige  健康膚色", "price": 1090, "in_stock": true, "qty": ""},
{"id": "5261", "parent": "5256", "name": "JILL STUART｜黃金三角鑽石遮瑕液", "option": "  C10 healthy pink  粉色遮瑕 ", "price": 1090, "in_stock": true, "qty": ""},
{"id": "5262", "parent": "5256", "name": "JILL STUART｜黃金三角鑽石遮瑕液", "option": "C11 fresh yellow  黃色遮瑕", "price": 1090, "in_stock": true, "qty": ""},
{"id": "5263", "parent": "5256", "name": "JILL STUART｜黃金三角鑽石遮瑕液", "option": "C12 pale green 綠色遮瑕", "price": 1090, "in_stock": true, "qty": ""},
{"id": "5264", "parent": "5256", "name": "JILL STUART｜黃金三角鑽石遮瑕液", "option": "P20 illuminating pink  粉色璀璨色號", "price": 1090, "in_stock": true, "qty": ""},
{"id": "6581", "parent": "5256", "name": "JILL STUART｜黃金三角鑽石遮瑕液", "option": "P21 illuminating ivory", "price": 1090, "in_stock": true, "qty": ""},
{"id": "5177", "parent": "5175", "name": "JILL STUART｜綻放花環光澤唇釉", "option": "唇膏01 mysterious lily 冷紅色", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5178", "parent": "5175", "name": "JILL STUART｜綻放花環光澤唇釉", "option": "唇膏02 warm tulip 粉橘色", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5179", "parent": "5175", "name": "JILL STUART｜綻放花環光澤唇釉", "option": "唇膏03 caramel alstroemeria ribbon", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5180", "parent": "5175", "name": "JILL STUART｜綻放花環光澤唇釉", "option": "唇膏04 glowing innocent cosmos 煙燻粉", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5181", "parent": "5175", "name": "JILL STUART｜綻放花環光澤唇釉", "option": "唇膏05 lilac twinkle tears 紫丁香粉", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5182", "parent": "5175", "name": "JILL STUART｜綻放花環光澤唇釉", "option": "唇膏06 muse of scarlet 紅褐色", "price": 1180, "in_stock": true, "qty": ""},
{"id": "5161", "parent": "5160", "name": "JILL STUART｜洗護系列", "option": "白花香洗髮精 500ml", "price": 1370, "in_stock": true, "qty": ""},
{"id": "5162", "parent": "5160", "name": "JILL STUART｜洗護系列", "option": "白花香洗髮精 補充包 400ml", "price": 1050, "in_stock": true, "qty": ""},
{"id": "5163", "parent": "5160", "name": "JILL STUART｜洗護系列", "option": "白花香護髮素 500ml", "price": 1370, "in_stock": true, "qty": ""},
{"id": "5164", "parent": "5160", "name": "JILL STUART｜洗護系列", "option": "白花香護髮素 補充包 400ml", "price": 1050, "in_stock": true, "qty": ""},
{"id": "5165", "parent": "5160", "name": "JILL STUART｜洗護系列", "option": "白花香短時修護鎖水護髮 200ml", "price": 1120, "in_stock": true, "qty": ""},
{"id": "5166", "parent": "5160", "name": "JILL STUART｜洗護系列", "option": "白花香集中修護髮膜 200g", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4961", "parent": "4956", "name": "JILL STUART｜水滴型粉撲 &花瓣腮紅粉撲", "option": "水滴型粉撲", "price": 250, "in_stock": true, "qty": ""},
{"id": "4962", "parent": "4956", "name": "JILL STUART｜水滴型粉撲 &花瓣腮紅粉撲", "option": "花瓣腮紅粉撲", "price": 350, "in_stock": true, "qty": ""},
{"id": "4798", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "02 flood of honey", "price": 750, "in_stock": true, "qty": ""},
{"id": "4799", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "03 sunlight ruby", "price": 750, "in_stock": true, "qty": ""},
{"id": "4800", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "04 romantic gem", "price": 750, "in_stock": true, "qty": ""},
{"id": "4801", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "06 fake love", "price": 750, "in_stock": true, "qty": ""},
{"id": "4802", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "08 twilight sparkle", "price": 750, "in_stock": true, "qty": ""},
{"id": "4803", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "09 chocolate tower", "price": 750, "in_stock": true, "qty": ""},
{"id": "4804", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "10 dye on you", "price": 750, "in_stock": true, "qty": ""},
{"id": "4805", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "11 heavenly blue", "price": 750, "in_stock": true, "qty": ""},
{"id": "4806", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "12 ripe fig", "price": 750, "in_stock": true, "qty": ""},
{"id": "4807", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "13 naughty lady", "price": 750, "in_stock": true, "qty": ""},
{"id": "4808", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "14 silky moment", "price": 750, "in_stock": true, "qty": ""},
{"id": "4809", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "15 dreamy state", "price": 750, "in_stock": true, "qty": ""},
{"id": "4810", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "16 warm latte", "price": 750, "in_stock": true, "qty": ""},
{"id": "4812", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "18 daybreak sky", "price": 750, "in_stock": true, "qty": ""},
{"id": "4813", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "19 melty taupe", "price": 750, "in_stock": true, "qty": ""},
{"id": "4814", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "20 illuminate night", "price": 750, "in_stock": true, "qty": ""},
{"id": "4816", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "27 warm grace", "price": 750, "in_stock": true, "qty": ""},
{"id": "4817", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "31cracked applecandy", "price": 750, "in_stock": true, "qty": ""},
{"id": "4818", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "32 flower horoscope", "price": 750, "in_stock": true, "qty": ""},
{"id": "4819", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "34 jellyfish lullaby", "price": 750, "in_stock": true, "qty": ""},
{"id": "4820", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "35 peach cocktail", "price": 750, "in_stock": true, "qty": ""},
{"id": "4821", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "36 blazing sun", "price": 750, "in_stock": true, "qty": ""},
{"id": "4823", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "101 sweet milk tea", "price": 750, "in_stock": true, "qty": ""},
{"id": "4824", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "102 light curtain", "price": 750, "in_stock": true, "qty": ""},
{"id": "4825", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "103 crystal tiara", "price": 750, "in_stock": true, "qty": ""},
{"id": "4826", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "104 sing a rhythm", "price": 750, "in_stock": true, "qty": ""},
{"id": "4827", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "105 little shell", "price": 750, "in_stock": true, "qty": ""},
{"id": "4828", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "106 beating heart", "price": 750, "in_stock": true, "qty": ""},
{"id": "4830", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "108 sweet voyage", "price": 750, "in_stock": true, "qty": ""},
{"id": "4831", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "109 strawberry drop", "price": 750, "in_stock": true, "qty": ""},
{"id": "4832", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "110 black berry syru", "price": 750, "in_stock": true, "qty": ""},
{"id": "4833", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "113 ennui noon", "price": 750, "in_stock": true, "qty": ""},
{"id": "4835", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "01 pink essence", "price": 750, "in_stock": true, "qty": ""},
{"id": "4836", "parent": "4575", "name": "JILL STUART｜指甲油", "option": "02lavender essence", "price": 750, "in_stock": true, "qty": ""},
{"id": "4563", "parent": "4550", "name": "JILL STUART｜高顯色花瓣眼影", "option": "01 cymbidium cameo：奶茶灰粉系", "price": 1920, "in_stock": true, "qty": ""},
{"id": "4564", "parent": "4550", "name": "JILL STUART｜高顯色花瓣眼影", "option": "02 viola amethyst：淡紫紅色系", "price": 1920, "in_stock": true, "qty": ""},
{"id": "4566", "parent": "4550", "name": "JILL STUART｜高顯色花瓣眼影", "option": "04 calandiva garnet：酒紅色系 ※人氣色", "price": 1920, "in_stock": true, "qty": ""},
{"id": "4568", "parent": "4550", "name": "JILL STUART｜高顯色花瓣眼影", "option": "13 sunflower coral：粉色珊瑚礁色系", "price": 1920, "in_stock": true, "qty": ""},
{"id": "4569", "parent": "4550", "name": "JILL STUART｜高顯色花瓣眼影", "option": "14 verbena morganite：粉紫色系", "price": 1920, "in_stock": true, "qty": ""},
{"id": "4514", "parent": "4488", "name": "JILL STUART｜花瓣瓶蓋捲翹睫毛膏", "option": "01 midnight silence 黑色", "price": 1060, "in_stock": true, "qty": ""},
{"id": "4515", "parent": "4488", "name": "JILL STUART｜花瓣瓶蓋捲翹睫毛膏", "option": "02 deep walnut 棕色", "price": 1060, "in_stock": true, "qty": ""},
{"id": "4516", "parent": "4488", "name": "JILL STUART｜花瓣瓶蓋捲翹睫毛膏", "option": "03 ennui dawn 深灰色", "price": 1060, "in_stock": true, "qty": ""},
{"id": "4462", "parent": "4443", "name": "JILL STUART｜居家生活-各種全身、洗手護手、香氛噴霧", "option": "水晶鑽圓罐白花香深層滋潤護手霜", "price": 960, "in_stock": true, "qty": ""},
{"id": "4464", "parent": "4443", "name": "JILL STUART｜居家生活-各種全身、洗手護手、香氛噴霧", "option": "白花香身體去角質", "price": 1350, "in_stock": true, "qty": ""},
{"id": "4465", "parent": "4443", "name": "JILL STUART｜居家生活-各種全身、洗手護手、香氛噴霧", "option": "多功能芳香除臭殺菌白花香噴霧", "price": 1080, "in_stock": true, "qty": ""},
{"id": "4466", "parent": "4443", "name": "JILL STUART｜居家生活-各種全身、洗手護手、香氛噴霧", "option": "白花香金黃洗手露", "price": 900, "in_stock": true, "qty": ""},
{"id": "4463", "parent": "4443", "name": "JILL STUART｜居家生活-各種全身、洗手護手、香氛噴霧", "option": "水晶鑽白花香沐浴鹽", "price": 1260, "in_stock": true, "qty": ""},
{"id": "4467", "parent": "4443", "name": "JILL STUART｜居家生活-各種全身、洗手護手、香氛噴霧", "option": "白花香乾洗手凝膠（含酒精）", "price": 620, "in_stock": true, "qty": ""},
{"id": "5154", "parent": "4441", "name": "JILL STUART｜各種頭髮護理", "option": "蝴蝶結鑽石洗髮梳", "price": 950, "in_stock": true, "qty": ""},
{"id": "5155", "parent": "4441", "name": "JILL STUART｜各種頭髮護理", "option": "頭皮深層清潔洗髮霜", "price": 1300, "in_stock": true, "qty": ""},
{"id": "4456", "parent": "4441", "name": "JILL STUART｜各種頭髮護理", "option": "復古奢華風雙重毛氣墊梳", "price": 1280, "in_stock": true, "qty": ""},
{"id": "4457", "parent": "4441", "name": "JILL STUART｜各種頭髮護理", "option": "免沖洗白花香寶石護髮霜", "price": 1040, "in_stock": true, "qty": ""},
{"id": "4458", "parent": "4441", "name": "JILL STUART｜各種頭髮護理", "option": "白花香寶石髮香噴霧", "price": 1080, "in_stock": true, "qty": ""},
{"id": "4459", "parent": "4441", "name": "JILL STUART｜各種頭髮護理", "option": "白花香護髮油 清爽型", "price": 1080, "in_stock": true, "qty": ""},
{"id": "4460", "parent": "4441", "name": "JILL STUART｜各種頭髮護理", "option": "白花香護髮油 滋潤型", "price": 1080, "in_stock": true, "qty": ""},
{"id": "4395", "parent": "4391", "name": "JILL STUART｜白花香UV防曬乳", "option": "白花香UV防曬乳", "price": 1130, "in_stock": true, "qty": ""},
{"id": "4387", "parent": "4386", "name": "JILL STUART｜高防曬亮采鑽石＆無暇珍珠光妝前乳", "option": "01 lavender gem 薰衣草紫", "price": 1220, "in_stock": true, "qty": ""},
{"id": "4388", "parent": "4386", "name": "JILL STUART｜高防曬亮采鑽石＆無暇珍珠光妝前乳", "option": "02 diamond gem 明亮白", "price": 1220, "in_stock": true, "qty": ""},
{"id": "4389", "parent": "4386", "name": "JILL STUART｜高防曬亮采鑽石＆無暇珍珠光妝前乳", "option": "03 pink opal gem 自然粉膚", "price": 1220, "in_stock": true, "qty": ""},
{"id": "5284", "parent": "4386", "name": "JILL STUART｜高防曬亮采鑽石＆無暇珍珠光妝前乳", "option": "Flawless Gem 自然的米白色", "price": 1220, "in_stock": true, "qty": ""},
{"id": "4346", "parent": "4345", "name": "JILL STUART｜透明感保養品全系列", "option": "淨透卸妝膏 附刮勺", "price": 1260, "in_stock": true, "qty": ""},
{"id": "4347", "parent": "4345", "name": "JILL STUART｜透明感保養品全系列", "option": "純淨雙層油美容液", "price": 1320, "in_stock": true, "qty": ""},
{"id": "4348", "parent": "4345", "name": "JILL STUART｜透明感保養品全系列", "option": "淨透洗面乳", "price": 1050, "in_stock": true, "qty": ""},
{"id": "4349", "parent": "4345", "name": "JILL STUART｜透明感保養品全系列", "option": "保溼化妝水", "price": 1300, "in_stock": true, "qty": ""},
{"id": "4350", "parent": "4345", "name": "JILL STUART｜透明感保養品全系列", "option": "保濕光滑乳液", "price": 1280, "in_stock": true, "qty": ""},
{"id": "4255", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "01 feminine lilac", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4256", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "02 shy peony", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4257", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "03 Casablanca voyage", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4258", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "04 milky magnolia（無珠光）", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4259", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "05 noble plumeria（無珠光）", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4260", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "06 urban bougainvillea（無珠光）", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4261", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "07 ranunculus nocturne（無珠光）", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4262", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "08 baked marigold（無珠光）", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4263", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "09 petit cherry", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4264", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "10 sakura ribbon", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4265", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "11 poppy waltz（無珠光）", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4266", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "12 camellia muse（無珠光）", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4267", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "13 happy primula", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4279", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "14 ardent amaryllis", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4268", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "15 dancing tulip（無珠光）", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4269", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "16 peach blossom blizzard（無珠光）", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4270", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "17 marguerite secret（無珠光）", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4271", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "18 cattleya temptation", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4272", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "19 anemone dazzle", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4273", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "20 brilliant aster（無珠光）", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4274", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "21 burgundy dahlia", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4275", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "22 chocolate gerbera", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4276", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "23 tender mum（無珠光）", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4277", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "24 orchid ornament（無珠光）", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4278", "parent": "4251", "name": "JILL STUART｜花瓣保濕持色唇膏", "option": "25 azalea wish（無珠光）", "price": 1120, "in_stock": true, "qty": ""},
{"id": "4194", "parent": "4193", "name": "JILL STUART｜各色滾珠瓶置物袋", "option": "01 白色", "price": 390, "in_stock": true, "qty": ""},
{"id": "4195", "parent": "4193", "name": "JILL STUART｜各色滾珠瓶置物袋", "option": "05 粉膚色", "price": 390, "in_stock": true, "qty": ""},
{"id": "4196", "parent": "4193", "name": "JILL STUART｜各色滾珠瓶置物袋", "option": "06 蜜桃粉色", "price": 390, "in_stock": true, "qty": ""},
{"id": "4197", "parent": "4193", "name": "JILL STUART｜各色滾珠瓶置物袋", "option": "09 桃紅色", "price": 390, "in_stock": true, "qty": ""},
{"id": "4198", "parent": "4193", "name": "JILL STUART｜各色滾珠瓶置物袋", "option": "10 粉紫色", "price": 390, "in_stock": true, "qty": ""},
{"id": "4199", "parent": "4193", "name": "JILL STUART｜各色滾珠瓶置物袋", "option": "11 藍色", "price": 390, "in_stock": true, "qty": ""},
{"id": "5849", "parent": "4184", "name": "JILL STUART｜身體乳，護手霜，唇凍，滾珠瓶", "option": "白花香乳液", "price": 1220, "in_stock": true, "qty": ""},
{"id": "5848", "parent": "4184", "name": "JILL STUART｜身體乳，護手霜，唇凍，滾珠瓶", "option": "奶茶乳液", "price": 1220, "in_stock": true, "qty": ""},
{"id": "5847", "parent": "4184", "name": "JILL STUART｜身體乳，護手霜，唇凍，滾珠瓶", "option": "莓果乳液", "price": 1220, "in_stock": true, "qty": ""},
{"id": "5839", "parent": "4184", "name": "JILL STUART｜身體乳，護手霜，唇凍，滾珠瓶", "option": "白花香護手霜", "price": 600, "in_stock": true, "qty": ""},
{"id": "5840", "parent": "4184", "name": "JILL STUART｜身體乳，護手霜，唇凍，滾珠瓶", "option": "奶茶護手霜", "price": 600, "in_stock": true, "qty": ""},
{"id": "5841", "parent": "4184", "name": "JILL STUART｜身體乳，護手霜，唇凍，滾珠瓶", "option": "莓果護手霜", "price": 600, "in_stock": true, "qty": ""},
{"id": "5843", "parent": "4184", "name": "JILL STUART｜身體乳，護手霜，唇凍，滾珠瓶", "option": "白花香唇凍", "price": 700, "in_stock": true, "qty": ""},
{"id": "5844", "parent": "4184", "name": "JILL STUART｜身體乳，護手霜，唇凍，滾珠瓶", "option": "奶茶唇凍", "price": 700, "in_stock": true, "qty": ""},
{"id": "5852", "parent": "4184", "name": "JILL STUART｜身體乳，護手霜，唇凍，滾珠瓶", "option": "白花香滾珠瓶", "price": 780, "in_stock": true, "qty": ""},
{"id": "5851", "parent": "4184", "name": "JILL STUART｜身體乳，護手霜，唇凍，滾珠瓶", "option": "奶茶滾珠瓶", "price": 780, "in_stock": true, "qty": ""},
{"id": "5853", "parent": "4184", "name": "JILL STUART｜身體乳，護手霜，唇凍，滾珠瓶", "option": "莓果滾珠瓶", "price": 780, "in_stock": true, "qty": ""},
{"id": "6997", "parent": "3980", "name": "♡許願客製化代購♡", "option": "jeying1994", "price": 650, "in_stock": true, "qty": ""},
{"id": "6998", "parent": "3980", "name": "♡許願客製化代購♡", "option": "bzyfag63297", "price": 3600, "in_stock": true, "qty": ""},
{"id": "6976", "parent": "3980", "name": "♡許願客製化代購♡", "option": "effielin22", "price": 2540, "in_stock": true, "qty": ""},
{"id": "6734", "parent": "3980", "name": "♡許願客製化代購♡", "option": "vick12340803", "price": 1420, "in_stock": true, "qty": ""},
{"id": "6010", "parent": "3980", "name": "♡許願客製化代購♡", "option": "fyfy.ss", "price": 2710, "in_stock": true, "qty": ""},
{"id": "5616", "parent": "3980", "name": "♡許願客製化代購♡", "option": "tomonana", "price": 6730, "in_stock": true, "qty": ""},
{"id": "5708", "parent": "3980", "name": "♡許願客製化代購♡", "option": "vivianhi2002", "price": 16690, "in_stock": true, "qty": ""},
{"id": "5449", "parent": "3980", "name": "♡許願客製化代購♡", "option": "dloveu791022", "price": 22950, "in_stock": true, "qty": ""},
{"id": "5424", "parent": "3980", "name": "♡許願客製化代購♡", "option": "jenny_8156", "price": 4460, "in_stock": true, "qty": ""},
{"id": "5426", "parent": "3980", "name": "♡許願客製化代購♡", "option": "queenbeelin", "price": 2880, "in_stock": true, "qty": ""},
{"id": "5425", "parent": "3980", "name": "♡許願客製化代購♡", "option": "fa9_8hk_08", "price": 12600, "in_stock": true, "qty": ""},
{"id": "5427", "parent": "3980", "name": "♡許願客製化代購♡", "option": "mitukiaki", "price": 1520, "in_stock": true, "qty": ""},
{"id": "127", "parent": "124", "name": "JILL STUART｜綻放光澤感潤唇膏", "option": "01 baby petal 純正粉", "price": 1120, "in_stock": true, "qty": ""},
{"id": "128", "parent": "124", "name": "JILL STUART｜綻放光澤感潤唇膏", "option": "02 morning chill 清澈藍", "price": 1120, "in_stock": true, "qty": ""},
{"id": "129", "parent": "124", "name": "JILL STUART｜綻放光澤感潤唇膏", "option": "03 heroine's choice 櫻桃紅", "price": 1120, "in_stock": true, "qty": ""},
{"id": "130", "parent": "124", "name": "JILL STUART｜綻放光澤感潤唇膏", "option": "04 bloom mood 煙需粉", "price": 1120, "in_stock": true, "qty": ""},
{"id": "131", "parent": "124", "name": "JILL STUART｜綻放光澤感潤唇膏", "option": "05 amber tomato 琥珀紅", "price": 1120, "in_stock": true, "qty": ""},
{"id": "132", "parent": "124", "name": "JILL STUART｜綻放光澤感潤唇膏", "option": "06 until midnigh 暗紫色", "price": 1120, "in_stock": true, "qty": ""},
{"id": "133", "parent": "124", "name": "JILL STUART｜綻放光澤感潤唇膏", "option": "07 magnolia dress 純正紅", "price": 1120, "in_stock": true, "qty": ""}
];

/**
 * 云云代購 — 免費後台（Google Apps Script + Google 試算表）
 *
 * 安裝：見同資料夾「安裝說明.md」。第一次部署後在編輯器執行 setup() 一次。
 * 前台把部署網址填進 assets/yy-config.js 的 gasUrl。
 */

const SHEETS = {
  orders:   { name: '訂單',     head: ['訂單編號', '下單時間', '狀態', '客戶姓名', 'Email', '電話', '會員帳號', '商品明細', '件數', '小計', '折扣', '運費', '總計', '運送方式', '取貨門市', '收件地址', '付款方式', '訂單備註', '訂單來源', '來源細節', '進站頁面', '裝置', '管理備註', 'okey', 'data'] },
  members:  { name: '會員',     head: ['Email', '姓名', '電話', '註冊時間', '最後登入', '訂單數', '消費總額', 'salt', 'hash', 'profile'] },
  catalog:  { name: '商品庫存', head: ['商品ID', '父商品ID', '商品名稱', '規格', '價格', '有貨', '庫存數量', '已售出'] },
  coupons:  { name: '折價券',   head: ['代碼', '類型', '折扣', '最低消費', '使用上限', '已使用', '到期日', '啟用', '說明'] },
  messages: { name: '留言',     head: ['時間', '姓名', 'Email', '內容', '頁面', '已處理'] },
  settings: { name: '設定',     head: ['項目', '值', '說明'] },
  products: { name: '商品',     head: ['商品ID', '商品名稱', '售價', '原價', '分類', '簡短說明', '商品介紹', '圖片', '縮圖', '規格名稱', '規格', '上架', '建立時間', '更新時間', '貨號', '推薦商品', '原站商品', '已刪除'] }
};

const DEFAULT_SETTINGS = [
  ['店名', 'A.Neuf-yunyun JP', '寄信時使用的店名'],
  ['通知Email', '', '新訂單、新留言通知寄到這裡（留空＝試算表擁有者）'],
  ['寄送客戶確認信', '是', '下單後寄訂單確認信給客人（是／否）'],
  ['ATM轉帳資訊', '', '顯示在訂單完成頁與確認信，例如：銀行代碼／帳號／戶名'],
  ['下一張訂單編號', '7001', '系統自動遞增，不用改'],
  ['網站網址', 'https://yunyun-ec.com/', '信件中的連結'],
  ['下一個商品ID', '900001', '後台新增商品時自動遞增，不用改']
];
const HIDDEN_SETTINGS = ['下一張訂單編號', '下一個商品ID'];
const NEW_ID_BASE = 900000;   // 後台新增的商品 ID 從 900001 起跳，不會和原本 WooCommerce 商品衝突

// 與前台 assets/yy-config.js 的 shipping 保持一致
const SHIPPING = [
  { id: 'cvs_711',    label: '超商取貨 7-ELEVEN｜滿三千免運', cost: 60, freeOver: 3000, countries: ['TW'], store: true, map: 'https://emap.pcsc.com.tw/' },
  { id: 'cvs_family', label: '超商取貨 全家｜滿三千免運',     cost: 60, freeOver: 3000, countries: ['TW'], store: true, map: 'https://www.family.com.tw/Marketing/zh/Map' },
  { id: 'sf_express', label: '順豐宅配 | 運費到付($95起)｜滿六千免運', cost: 0, countries: ['TW'] },
  { id: 'sf_hkmo',    label: '順豐宅配 | 運費到付', cost: 0, countries: ['HK', 'MO'] }
];
const PAYMENTS = { ry_ecpay_atm: 'ATM 虛擬帳號', stripe: '信用卡 / 簽帳金融卡', stripe_cc: '信用卡 / 簽帳金融卡', stripe_applepay: 'Apple Pay', stripe_googlepay: 'Google Pay' };
const STATUSES = ['待付款', '處理中', '已出貨', '已完成', '已取消', '已退費'];

/* ================= entry ================= */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'catalog') return out(withErr(() => apiCatalog()));
  return out({ ok: true, service: 'yunyun-backend' });
}
function doPost(e) {
  let req = {};
  const body = (e && e.postData && e.postData.contents) || '{}';
  if (body.length > 12e6) return out({ ok: false, error: '資料太大' });
  try { req = JSON.parse(body); } catch (x) { return out({ ok: false, error: '資料格式錯誤' }); }
  return out(withErr(() => route(req)));
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function withErr(fn) {
  try { const r = fn(); return Object.assign({ ok: true }, r || {}); }
  catch (x) { return { ok: false, error: String(x && x.message || x) }; }
}
function route(q) {
  const A = {
    catalog: apiCatalog, coupon: apiCoupon, register: apiRegister, login: apiLogin, me: apiMe,
    save_profile: apiSaveProfile, change_password: apiChangePassword, lost_password: apiLostPassword, reset_password: apiResetPassword,
    my_orders: apiMyOrders, order_get: apiOrderGet, place_order: apiPlaceOrder, contact: apiContact,
    admin_login: apiAdminLogin, admin_overview: admin(apiAdminOverview), admin_orders: admin(apiAdminOrders),
    admin_order_update: admin(apiAdminOrderUpdate), admin_members: admin(apiAdminMembers),
    admin_catalog: admin(apiAdminCatalog), admin_catalog_update: admin(apiAdminCatalogUpdate),
    admin_coupons: admin(apiAdminCoupons), admin_coupon_save: admin(apiAdminCouponSave), admin_coupon_delete: admin(apiAdminCouponDelete),
    admin_messages: admin(apiAdminMessages), admin_message_done: admin(apiAdminMessageDone),
    admin_settings: admin(apiAdminSettings), admin_settings_save: admin(apiAdminSettingsSave), admin_password: admin(apiAdminPassword),
    admin_products: admin(apiAdminProducts), admin_product_save: admin(apiAdminProductSave), admin_product_delete: admin(apiAdminProductDelete), admin_product_status: admin(apiAdminProductStatus),
    admin_upload_image: admin(apiAdminUploadImage)
  };
  if (!q || typeof q !== 'object' || !Object.prototype.hasOwnProperty.call(A, q.action)) throw new Error('未知的操作');
  const f = A[q.action];
  if (!f) throw new Error('未知的操作');
  return f(q);
}
function admin(fn) { return function (q) { verify(q.token, 'admin'); return fn(q); }; }
function isDemo() { return false; }   // 展示模式（yy-demo.js）會覆寫成 true

/* ================= setup ================= */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(k => sheet(k));
  const st = sheet('settings');
  if (st.getLastRow() < 2) st.getRange(2, 1, DEFAULT_SETTINGS.length, 3).setValues(DEFAULT_SETTINGS);
  const cat = sheet('catalog');
  if (cat.getLastRow() < 2 && typeof CATALOG_SEED !== 'undefined') {
    const rows = CATALOG_SEED.map(r => [String(r.id), String(r.parent || ''), r.name, r.option, r.price, !!r.in_stock, r.qty === '' ? '' : r.qty, 0]);
    cat.getRange(2, 1, rows.length, 2).setNumberFormat('@');
    cat.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  } else seedMissing();
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SECRET')) props.setProperty('SECRET', Utilities.getUuid() + Utilities.getUuid());
  if (!props.getProperty('ADMIN_HASH')) setAdminPass('yunyun' + Math.floor(1000 + Math.random() * 9000), true);
  const s1 = ss.getSheets()[0]; if (s1.getName() === '工作表1' || s1.getName() === 'Sheet1') { if (s1.getLastRow() === 0) ss.deleteSheet(s1); }
  Logger.log('完成。後台初始密碼：' + (props.getProperty('ADMIN_INIT') || '(已設定過)'));
}
// 新版多出來的原站規格（例如原本動態載入的指甲油色號）→ 補進商品庫存；後台改過的商品不動
function seedMissing() {
  if (typeof CATALOG_SEED === 'undefined') return 0;
  const have = {}, managed = {};
  readAll('catalog').forEach(r => have[String(r['商品ID'])] = 1);
  readAll('products').forEach(r => { if (String(r['商品名稱'])) managed[String(r['商品ID'])] = 1; });
  const add = CATALOG_SEED.filter(r => !have[String(r.id)] && !managed[String(r.parent || r.id)]);
  add.forEach(r => append('catalog', { '商品ID': String(r.id), '父商品ID': String(r.parent || ''), '商品名稱': r.name, '規格': r.option, '價格': r.price, '有貨': !!r.in_stock, '庫存數量': r.qty === '' ? '' : r.qty, '已售出': 0 }));
  // 原本只有一列（沒有規格）的商品，現在有規格了 → 移除那一列
  const parents = {}; add.forEach(r => { if (r.parent) parents[String(r.parent)] = 1; });
  readAll('catalog').filter(r => parents[String(r['商品ID'])] && !String(r['父商品ID'])).map(r => r._row).sort((a, b) => b - a).forEach(n => sheet('catalog').deleteRow(n));
  if (add.length) dropCatalogCache();
  return add.length;
}
function setAdminPass(p, isInitial) {
  const props = PropertiesService.getScriptProperties();
  const salt = Utilities.getUuid();
  // ADMIN_VER 變更 → 舊的後台登入全部失效（換密碼＝把其他裝置踢出去）
  props.setProperties({ ADMIN_SALT: salt, ADMIN_HASH: pwHash(p, salt), ADMIN_VER: Utilities.getUuid().slice(0, 8) });
  // only the generated first password is kept (so setup can print it); a password you choose is never stored in plain text
  if (isInitial) props.setProperty('ADMIN_INIT', p); else props.deleteProperty('ADMIN_INIT');
}

/* ================= sheet helpers ================= */
function sheet(k) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const def = SHEETS[k];
  let sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.head.length).setValues([def.head]).setFontWeight('bold').setBackground('#f6dfe7');
    sh.setFrozenRows(1);
  } else if (!_headOk[k]) {
    // 舊版試算表少了新欄位 → 自動在最右邊補上欄名（原有資料不動）
    const cur = sh.getRange(1, 1, 1, def.head.length).getValues()[0];
    def.head.forEach((h, j) => { if (cur[j] === '' || cur[j] === null || cur[j] === undefined) sh.getRange(1, j + 1).setValue(h); });
  }
  _headOk[k] = 1;
  return sh;
}
const _headOk = {};
function readAll(k) {
  const sh = sheet(k), head = SHEETS[k].head, n = sh.getLastRow();
  if (n < 2) return [];
  const vals = sh.getRange(2, 1, n - 1, head.length).getValues();
  return vals.map((r, i) => { const o = { _row: i + 2 }; head.forEach((h, j) => o[h] = r[j]); return o; });
}
// 文字一律加 ' 存成「純文字」（' 在試算表裡不會顯示，讀回來也沒有）：
//  1) 客人輸入以 = + - @ 開頭時，試算表不會當成公式執行（公式注入）
//  2) 0912…、001、1/2 這類文字不會被試算表自動轉成數字或日期
function cell(v) {
  if (v === undefined || v === null) return '';
  return typeof v === 'string' && v !== '' ? "'" + v : v;
}
function writeRow(k, row, obj) {
  const head = SHEETS[k].head;
  sheet(k).getRange(row, 1, 1, head.length).setValues([head.map(h => cell(obj[h]))]);
}
function setCell(k, row, col, v) { sheet(k).getRange(row, SHEETS[k].head.indexOf(col) + 1).setValue(cell(v)); }
function append(k, obj) { const head = SHEETS[k].head; sheet(k).appendRow(head.map(h => cell(obj[h]))); }
// 輸入清理：去控制字元、去頭尾空白、限制長度
function str(v, max) { return String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max || 200); }
function int(v, lo, hi) { const n = Number(v); return Number.isFinite(n) && Math.floor(n) === n && n >= lo && n <= hi ? n : null; }
const EMAIL_RE = /^[^@\s|<>"'(),;:\\]{1,64}@[^@\s|<>"'(),;:\\]{1,190}\.[A-Za-z]{2,24}$/;
function emailOf(v) { const e = str(v, 254).toLowerCase(); if (!EMAIL_RE.test(e)) throw new Error('請提供有效的電子郵件地址。'); return e; }
function safeUrl(u) {   // 只允許站內相對路徑或 http(s)，擋掉 javascript: 之類
  u = str(u, 400);
  if (/^[a-z][a-z0-9+.\-]*:/i.test(u) && !/^https?:\/\//i.test(u)) return '';
  return /["'<>\s\\`]/.test(u) ? '' : u;
}
function settings() {
  const o = {}; readAll('settings').forEach(r => o[r['項目']] = r['值']);
  return o;
}
function setSetting(key, v) {
  const r = readAll('settings').find(x => x['項目'] === key);
  if (r) setCell('settings', r._row, '值', v); else append('settings', { '項目': key, '值': v });
}
function bool(v) { return v === true || v === 'TRUE' || v === 'true' || v === '是' || v === 1 || v === '1'; }
function num(v) { return v === '' || v === null || v === undefined ? null : Number(v); }

/* ================= crypto / tokens ================= */
function pwHash(pass, salt) {
  let h = salt + '|' + pass;
  for (let i = 0; i < 200; i++) h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
  return h;
}
function secret() { return PropertiesService.getScriptProperties().getProperty('SECRET'); }
function hmac(p) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(p, secret())); }
// 固定時間比對，避免用回應時間猜出簽章／密碼雜湊
function safeEq(a, b) {
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0, n = Math.max(a.length, b.length); i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
// token = base64(角色|帳號|到期|綁定碼).HMAC；綁定碼：會員＝密碼雜湊尾碼、後台＝ADMIN_VER → 換密碼後舊登入自動失效
function sign(role, sub, days, tag) {
  const p = [role, sub, Date.now() + days * 864e5, tag || ''].join('|');
  return Utilities.base64EncodeWebSafe(p, Utilities.Charset.UTF_8) + '.' + hmac(p);
}
function unpack(tok) {
  tok = String(tok || '');
  const i = tok.indexOf('.');
  if (i < 1 || tok.length > 800) return null;
  let p;
  try { p = Utilities.newBlob(Utilities.base64DecodeWebSafe(tok.slice(0, i))).getDataAsString('UTF-8'); } catch (e) { return null; }
  return safeEq(hmac(p), tok.slice(i + 1)) ? p.split('|') : null;
}
function adminVer() { return PropertiesService.getScriptProperties().getProperty('ADMIN_VER') || ''; }
function verify(tok, role) {
  const a = unpack(tok);
  if (!a || a[0] !== role) throw new Error('請重新登入');
  if (!(Number(a[2]) > Date.now())) throw new Error('登入已逾時，請重新登入');
  if (role === 'admin' && !safeEq(a[3], adminVer())) throw new Error('請重新登入');
  return a;
}
function userTag(r) { return String(r['hash']).slice(-10); }
function userToken(r) { return sign('user', String(r['Email']).toLowerCase(), 30, userTag(r)); }
function authUser(tok) {
  const a = verify(tok, 'user'), r = memberRow(a[1]);
  if (!r || !safeEq(userTag(r), a[3])) throw new Error('請重新登入');
  return r;
}
function throttle(key, max) {
  const c = CacheService.getScriptCache(), n = Number(c.get(key) || 0);
  if (n >= max) throw new Error('嘗試次數過多，請 15 分鐘後再試。');
  return () => c.put(key, String(n + 1), 900);
}

/* ================= catalog / stock ================= */
// 公開：{ items: { 商品ID: [有貨1/0, 剩餘數量|null, 價格] }, products: [後台新增且上架的商品] }
function apiCatalog() {
  const c = CacheService.getScriptCache(), hit = c.get('catalog');
  if (hit) { try { return JSON.parse(hit); } catch (e) { } }
  const items = {};
  readAll('catalog').forEach(r => { items[String(r['商品ID'])] = [bool(r['有貨']) ? 1 : 0, num(r['庫存數量']), Number(r['價格'])]; });
  const rows = readAll('products');
  const res = {
    items,
    products: rows.filter(r => bool(r['上架']) && !bool(r['已刪除']) && String(r['商品名稱'])).map(r => productOut(r)),
    off: rows.filter(r => isOrigRow(r) && (!bool(r['上架']) || bool(r['已刪除']))).map(r => String(r['商品ID']))   // 下架／刪除的原站商品
  };
  const js = JSON.stringify(res);
  if (js.length < 90000) c.put('catalog', js, 120);   // CacheService 單筆上限 100KB
  return res;
}
function dropCatalogCache() { CacheService.getScriptCache().remove('catalog'); }

/* ================= coupons ================= */
function couponRow(code) {
  code = str(code, 40).toLowerCase();
  if (!code) return null;
  return readAll('coupons').find(r => String(r['代碼']).trim().toLowerCase() === code);
}
function couponType(t) { return String(t).indexOf('%') >= 0 || /百分|percent/i.test(t) ? 'percent' : 'fixed'; }
function couponCheck(code, sub) {
  code = str(code, 40);
  const r = couponRow(code);
  if (!r || !bool(r['啟用'])) throw new Error('折價券「' + code + '」不存在！');
  if (r['到期日'] && new Date(r['到期日']).getTime() + 864e5 < Date.now()) throw new Error('此折價券已過期。');
  if (num(r['使用上限']) && Number(r['已使用'] || 0) >= Number(r['使用上限'])) throw new Error('此折價券已達使用上限。');
  const min = Math.max(0, Number(r['最低消費']) || 0);
  if (min && sub < min) throw new Error('此折價券的最低消費金額為 NT$' + min.toLocaleString() + '。');
  const type = couponType(r['類型']);
  let amount = Math.max(0, Number(r['折扣']) || 0);
  if (type === 'percent') amount = Math.min(100, amount);
  return { r, def: { code: String(r['代碼']).trim().toLowerCase(), type, amount, min } };
}
function apiCoupon(q) {
  const bad = throttle('coupon-fail', 80);   // 防止有人一直亂猜折價券代碼
  try { return { coupon: couponCheck(q.code, Math.max(0, Number(q.subtotal) || 0)).def }; }
  catch (e) { bad(); throw e; }
}
function couponAmount(def, sub) { sub = Math.max(0, sub); return Math.max(0, Math.min(sub, def.type === 'percent' ? Math.round(sub * def.amount / 100) : def.amount)); }

/* ================= members ================= */
function memberRow(email) { email = String(email || '').trim().toLowerCase(); if (!email) return null; return readAll('members').find(r => String(r['Email']).toLowerCase() === email); }
function password(v) {
  const p = String(v === undefined || v === null ? '' : v);
  if (p.length < 6) throw new Error('密碼至少需要 6 個字元。');
  if (p.length > 200) throw new Error('密碼太長。');
  return p;
}
function newMember(email, pass) {
  const salt = Utilities.getUuid(), now = new Date(), hash = pwHash(pass, salt);
  append('members', { 'Email': email, '註冊時間': now, '最後登入': now, '訂單數': 0, '消費總額': 0, 'salt': salt, 'hash': hash, 'profile': '{}' });
  return { 'Email': email, 'hash': hash };
}
function profileOf(r) { try { return JSON.parse(r['profile'] || '{}') || {}; } catch (e) { return {}; } }
function apiRegister(q) {
  const email = emailOf(q.email), pass = password(q.password);
  const hit = throttle('register', 40); hit();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let m;
  try {
    if (memberRow(email)) throw new Error('已有帳號使用您的電子郵件地址註冊。請登入。');
    m = newMember(email, pass);
  } finally { lock.releaseLock(); }
  return { email, token: userToken(m) };
}
function apiLogin(q) {
  const email = str(q.email, 254).toLowerCase();
  const fail = throttle('login:' + email, 8), failAll = throttle('login-all', 200);
  const r = memberRow(email);
  if (!r) { failAll(); throw new Error('使用者名稱或電子郵件 ' + email + ' 尚未在網站中註冊。'); }
  if (!safeEq(pwHash(String(q.password || '').slice(0, 200), r['salt']), r['hash'])) { fail(); failAll(); throw new Error('使用者名稱或電子郵件 ' + email + ' 的密碼不正確。'); }
  setCell('members', r._row, '最後登入', new Date());
  return { email, token: userToken(r), profile: profileOf(r) };
}
function apiMe(q) { const r = authUser(q.token); return { email: String(r['Email']).toLowerCase(), profile: profileOf(r) }; }
// 只接受會員資料欄位（billing_/shipping_/account_ 開頭），每欄限長
function cleanFields(o, re, maxKeys) {
  const out = {};
  if (!o || typeof o !== 'object') return out;
  Object.keys(o).slice(0, maxKeys || 40).forEach(k => { if (re.test(k)) out[k] = str(o[k], k === 'order_comments' ? 1000 : 200); });
  return out;
}
const PROFILE_KEY = /^(billing|shipping|account)_[a-z0-9_]{1,30}$/;
function apiSaveProfile(q) {
  const r = authUser(q.token);
  const p = Object.assign(profileOf(r), cleanFields(q.profile, PROFILE_KEY, 60));
  setCell('members', r._row, 'profile', JSON.stringify(p));
  const name = str((p.billing_last_name || p.account_last_name || '') + (p.billing_first_name || p.account_first_name || ''), 100);
  if (name) setCell('members', r._row, '姓名', name);
  if (p.billing_phone) setCell('members', r._row, '電話', p.billing_phone);
  return { profile: p };
}
function apiChangePassword(q) {
  const r = authUser(q.token);
  const hit = throttle('chpw:' + r['Email'], 8);
  if (!safeEq(pwHash(String(q.old || '').slice(0, 200), r['salt']), r['hash'])) { hit(); throw new Error('目前密碼不正確。'); }
  const pass = password(q.password), salt = Utilities.getUuid(), hash = pwHash(pass, salt);
  setCell('members', r._row, 'salt', salt); setCell('members', r._row, 'hash', hash);
  return { token: userToken({ 'Email': r['Email'], 'hash': hash }) };   // 舊裝置的登入隨之失效，這台換發新的
}
function apiLostPassword(q) {
  const email = str(q.email, 254).toLowerCase();
  const hit = throttle('lost:' + email, 3); hit();
  const hitAll = throttle('lost-all', 30); hitAll();   // 保護每日寄信額度
  const r = memberRow(email);
  if (r) {
    // 一次性連結：1 小時內有效，且綁定目前的密碼雜湊（改過密碼就失效）
    const p = ['reset', email, Date.now() + 36e5, String(r['hash']).slice(0, 12)].join('|');
    const key = Utilities.base64EncodeWebSafe(p, Utilities.Charset.UTF_8) + '.' + hmac(p);
    const S = settings();
    const link = siteUrl(S) + 'my-account/lost-password/?key=' + encodeURIComponent(key) + '&login=' + encodeURIComponent(email);
    mail(email, '【' + S['店名'] + '】密碼重設要求', '<p>您好，</p><p>有人要求重設以下帳號的密碼：' + h(email) + '</p><p>若這不是您本人的操作，請忽略此郵件，您的密碼不會有任何變更。</p><p>若要重設密碼，請點擊下方連結（1 小時內有效）：</p><p><a href="' + h(link) + '" style="display:inline-block;background:#b45a8a;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none">重設密碼</a></p>');
  }
  return {};
}
function apiResetPassword(q) {
  const email = str(q.email, 254).toLowerCase(), key = String(q.key || '').slice(0, 800);
  const hit = throttle('reset:' + email, 6); hit();
  const bad = () => new Error('此密碼重設連結無效或已過期，請重新申請。');
  const a = unpack(key), r = memberRow(email);
  if (!a || a[0] !== 'reset' || a[1] !== email || !(Number(a[2]) > Date.now()) || !r || !safeEq(String(r['hash']).slice(0, 12), a[3])) throw bad();
  const pass = password(q.password), salt = Utilities.getUuid(), hash = pwHash(pass, salt);
  setCell('members', r._row, 'salt', salt); setCell('members', r._row, 'hash', hash);
  setCell('members', r._row, '最後登入', new Date());
  return { email, token: userToken({ 'Email': email, 'hash': hash }), profile: profileOf(r) };
}

/* ================= orders ================= */
function apiMyOrders(q) {
  const email = String(authUser(q.token)['Email']).toLowerCase();
  const list = readAll('orders').filter(r => String(r['會員帳號']).toLowerCase() === email || String(r['Email']).toLowerCase() === email)
    .map(orderData).reverse();
  return { orders: list };
}
function orderData(r) { let o = {}; try { o = JSON.parse(r['data'] || '{}'); } catch (e) { } o.status = r['狀態']; return o; }
function apiOrderGet(q) {
  const key = String(q.key || '');
  if (!/^wc_order_[a-z0-9]{8,20}$/.test(key)) throw new Error('找不到這筆訂單。');
  const r = readAll('orders').find(x => String(x['訂單編號']) === String(q.number) && safeEq(x['okey'], key));
  if (!r) throw new Error('找不到這筆訂單。');
  return { order: orderData(r), bankInfo: settings()['ATM轉帳資訊'] || '' };
}
const MAX_LINES = 50, MAX_QTY = 99;
function apiPlaceOrder(q) {
  const o = (q.order && typeof q.order === 'object') ? q.order : {};
  const b = cleanFields(o.billing, /^billing_[a-z0-9_]{1,30}$/, 30);
  const email = emailOf(b.billing_email); b.billing_email = email;
  ['billing_last_name', 'billing_first_name', 'billing_phone'].forEach(k => { if (!b[k]) throw new Error('請填寫完整的收件人資訊。'); });
  const hit = throttle('order:' + email, 12); hit();
  const hitAll = throttle('order-all', 300); hitAll();
  const shipA = o.shipping ? cleanFields(o.shipping, /^shipping_[a-z0-9_]{1,30}$/, 30) : null;
  const payment = str(o.payment, 40);
  if (!Object.prototype.hasOwnProperty.call(PAYMENTS, payment)) throw new Error('請選擇付款方式。');
  const raw = Array.isArray(o.items) ? o.items : [];
  if (raw.length > MAX_LINES) throw new Error('購物車商品項目太多，請分批下單。');
  // 同一商品／規格合併成一行；數量必須是 1～99 的整數
  const merged = {}, orderIds = [];
  raw.forEach(i => {
    if (!i || typeof i !== 'object') return;
    const id = String(int(i.vid, 1, 1e12) || int(i.pid, 1, 1e12) || '');
    const qty = int(i.qty, 1, MAX_QTY);
    if (!id || qty === null) throw new Error('購物車資料有誤，請重新整理後再試。');
    if (!merged[id]) { merged[id] = { id, pid: int(i.pid, 1, 1e12) || 0, vid: int(i.vid, 1, 1e12) || 0, qty: 0, url: safeUrl(i.url), hint: str(i.name, 120) }; orderIds.push(id); }
    merged[id].qty += qty;
    if (merged[id].qty > MAX_QTY) throw new Error('單一商品最多購買 ' + MAX_QTY + ' 件。');
  });
  if (!orderIds.length) throw new Error('您的購物車目前是空的。');

  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  let order, token = null;
  try {
    const cat = readAll('catalog'), byId = {};
    cat.forEach(r => byId[String(r['商品ID'])] = r);
    const offline = {};   // 後台新增但已下架的商品
    readAll('products').forEach(r => { if (!bool(r['上架'])) offline[String(r['商品ID'])] = 1; });
    // 1) 價格一律以試算表為準（客人瀏覽器送來的價格完全不採用）＋驗庫存
    let sub = 0;
    const lines = orderIds.map(id => {
      const i = merged[id], r = byId[id];
      if (!r || offline[id] || offline[String(r['父商品ID'])]) throw new Error('「' + (i.hint || id) + '」已下架，請從購物車移除後再試。');
      if (i.vid && String(r['父商品ID']) !== String(i.pid)) throw new Error('購物車資料有誤，請重新整理後再試。');
      const nm = r['商品名稱'] + (r['規格'] ? ' - ' + r['規格'] : '');
      const price = Number(r['價格']);
      if (!Number.isFinite(price) || price < 0) throw new Error('「' + nm + '」價格設定有誤，請聯絡我們。');
      if (!bool(r['有貨'])) throw new Error('很抱歉，「' + nm + '」已售完，請從購物車移除後再試。');
      const left = num(r['庫存數量']);
      if (left !== null && left < i.qty) throw new Error('很抱歉，「' + nm + '」庫存不足（剩 ' + Math.max(0, left) + ' 件）。');
      sub += price * i.qty;
      return { r, id, pid: i.pid || int(r['父商品ID'], 1, 1e12) || Number(id), vid: i.vid, name: nm, qty: i.qty, price, url: i.url };
    });
    // 2) 折價券（同一張不能用兩次、最多 5 張）
    const discounts = [], seen = {};
    let disc = 0;
    (Array.isArray(o.coupons) ? o.coupons : []).slice(0, 5).forEach(code => {
      const k = str(code, 40).toLowerCase(); if (!k || seen[k]) return; seen[k] = 1;
      const c = couponCheck(k, sub);
      const a = couponAmount(c.def, sub - disc);
      disc += a; discounts.push({ code: c.def.code, amount: a, row: c.r._row, used: Number(c.r['已使用'] || 0) });
    });
    disc = Math.min(disc, sub);
    // 3) 運費（以伺服器的運送設定計算）
    const country = str((shipA && shipA.shipping_country) || b.billing_country || 'TW', 3).toUpperCase();   // 與前台一致：有填「運送到不同地址」就以收件國家為準
    const sm = SHIPPING.find(m => m.id === o.shipId && (!m.countries || m.countries.indexOf(country) >= 0));
    if (!sm) throw new Error('沒有適用於您地址的運送方式。');
    const cvsStore = str(o.cvsStore, 120);
    if (sm.store && !cvsStore) throw new Error('請填寫取貨門市。');
    const shipCost = sm.freeOver && sub >= sm.freeOver ? 0 : sm.cost;
    const total = Math.max(0, sub - disc) + shipCost;
    // 4) 會員：已登入 or 結帳時建立帳號
    let account = '';
    if (q.token) { try { account = String(authUser(q.token)['Email']).toLowerCase(); } catch (x) { } }
    if (!account && o.accountPassword) {
      if (memberRow(email)) throw new Error('已有帳號使用您的電子郵件地址註冊。請登入。');
      const m = newMember(email, password(o.accountPassword));
      account = email; token = userToken(m);
    }
    // 5) 編號、扣庫存、折價券使用次數
    const S = settings();
    const number = String(int(S['下一張訂單編號'], 1, 1e12) || 7001);
    setSetting('下一張訂單編號', Number(number) + 1);
    lines.forEach(l => {
      const left = num(l.r['庫存數量']);
      if (left !== null) {
        setCell('catalog', l.r._row, '庫存數量', left - l.qty);
        if (left - l.qty <= 0) setCell('catalog', l.r._row, '有貨', false);
      }
      setCell('catalog', l.r._row, '已售出', Number(l.r['已售出'] || 0) + l.qty);
    });
    discounts.forEach(d => setCell('coupons', d.row, '已使用', d.used + 1));
    dropCatalogCache();

    const now = new Date(), src = (o.source && typeof o.source === 'object') ? o.source : {};
    order = {
      number, key: 'wc_order_' + Utilities.getUuid().replace(/-/g, '').slice(0, 13), date: now.getTime(), status: '待付款',
      billing: b, shipping: shipA && shipA.shipping_address_1 ? shipA : null, note: str(o.note, 1000),
      items: lines.map(l => ({ pid: l.pid, vid: l.vid, name: l.name, qty: l.qty, price: l.price, url: l.url })),
      subtotal: sub, discounts: discounts.map(d => ({ code: d.code, amount: d.amount })), shippingLabel: sm.label, shippingCost: shipCost,
      cvsStore, total, payment, paymentLabel: PAYMENTS[payment], account,
      source: { label: str(src.label, 40), detail: str(src.detail, 200), landing: str(src.landing, 300), device: str(src.device, 20) }
    };
    const A = order.shipping || b, P = order.shipping ? 'shipping_' : 'billing_';
    append('orders', {
      '訂單編號': number, '下單時間': now, '狀態': '待付款', '客戶姓名': b.billing_last_name + b.billing_first_name,
      'Email': email, '電話': b.billing_phone, '會員帳號': account,
      '商品明細': lines.map(l => l.name + ' ×' + l.qty).join('\n'), '件數': lines.reduce((s, l) => s + l.qty, 0),
      '小計': sub, '折扣': disc, '運費': shipCost, '總計': total, '運送方式': sm.label, '取貨門市': cvsStore,
      '收件地址': [A[P + 'postcode'], A[P + 'state'], A[P + 'city'], A[P + 'address_1'], A[P + 'address_2']].filter(Boolean).join(' '),
      '付款方式': order.paymentLabel, '訂單備註': order.note,
      '訂單來源': order.source.label || '直接造訪', '來源細節': order.source.detail, '進站頁面': order.source.landing, '裝置': order.source.device,
      'okey': order.key, 'data': JSON.stringify(order)
    });
    if (account) {
      const m = memberRow(account);
      if (m) {
        setCell('members', m._row, '訂單數', Number(m['訂單數'] || 0) + 1);
        setCell('members', m._row, '消費總額', Number(m['消費總額'] || 0) + total);
        const pr = profileOf(m); Object.keys(b).forEach(k => pr[k] = b[k]);
        setCell('members', m._row, 'profile', JSON.stringify(pr));
        setCell('members', m._row, '姓名', b.billing_last_name + b.billing_first_name);
        setCell('members', m._row, '電話', b.billing_phone);
      }
    }
  } finally { lock.releaseLock(); }

  // 6) 通知（失敗不影響下單）
  const S = settings();
  try { mail(adminEmail(S), '【新訂單 #' + order.number + '】' + b.billing_last_name + b.billing_first_name + '　NT$' + order.total.toLocaleString(), orderMail(order, S, true)); } catch (x) { }
  if (bool(S['寄送客戶確認信'])) { try { mail(email, '【' + S['店名'] + '】已收到您的訂單 #' + order.number, orderMail(order, S, false), true); } catch (x) { } }
  return { order, token, bankInfo: S['ATM轉帳資訊'] || '' };
}

/* ================= contact ================= */
function apiContact(q) {
  const name = str(q.name, 100), msg = str(q.message, 3000), email = str(q.email, 254);
  if (!name || !msg) throw new Error('請填寫完整');
  const hit = throttle('contact:' + email.toLowerCase(), 5); hit();
  const hitAll = throttle('contact-all', 40); hitAll();
  append('messages', { '時間': new Date(), '姓名': name, 'Email': email, '內容': msg, '頁面': str(q.page, 300), '已處理': false });
  try { mail(adminEmail(settings()), '【網站留言】' + name, '<p><b>' + h(name) + '</b>（' + h(email) + '）</p><p style="white-space:pre-wrap">' + h(msg) + '</p><p style="color:#888">' + h(str(q.page, 300)) + '</p>'); } catch (x) { }
  return {};
}

/* ================= mail ================= */
function adminEmail(S) { return S['通知Email'] || Session.getEffectiveUser().getEmail(); }
function siteUrl(S) { let u = String(S['網站網址'] || '').trim(); if (!/^https?:\/\//.test(u)) u = 'https://yunyun-ec.com/'; return /\/$/.test(u) ? u : u + '/'; }
function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function money(n) { return 'NT$' + Number(n || 0).toLocaleString(); }
// customer=true：寄給客人的信；每日額度快用完時保留給「新訂單通知」
function mail(to, subject, html, customer) {
  if (!to) return;
  try { if (customer && MailApp.getRemainingDailyQuota() <= 10) return; } catch (e) { }
  MailApp.sendEmail({ to: String(to), subject: String(subject).replace(/[\r\n]+/g, ' ').slice(0, 200), htmlBody: html, name: str(settings()['店名'], 60).replace(/[<>"]/g, '') || '云云代購' });
}
function orderMail(o, S, forAdmin) {
  const b = o.billing, site = siteUrl(S);
  const rows = o.items.map(i => '<tr><td style="padding:10px 12px;border-bottom:1px solid #f0dfe5">' + h(i.name) + ' × ' + i.qty + '</td><td style="padding:10px 12px;border-bottom:1px solid #f0dfe5;text-align:right">' + money(i.price * i.qty) + '</td></tr>').join('');
  const foot = [['小計', money(o.subtotal)]].concat(o.discounts.map(d => ['折扣（' + h(d.code) + '）', '-' + money(d.amount)]))
    .concat([['運送方式', h(o.shippingLabel) + (o.shippingCost ? '　' + money(o.shippingCost) : '') + (o.cvsStore ? '<br>門市：' + h(o.cvsStore) : '')], ['付款方式', h(o.paymentLabel)], ['總計', '<b>' + money(o.total) + '</b>']])
    .map(r => '<tr><th style="padding:10px 12px;text-align:left;font-weight:normal;color:#7d6870">' + r[0] + '</th><td style="padding:10px 12px;text-align:right">' + r[1] + '</td></tr>').join('');
  const pay = o.payment === 'ry_ecpay_atm' && S['ATM轉帳資訊'] ? '<div style="margin:18px 0;padding:14px 16px;background:#fff8fb;border:1px solid #efd3df;border-radius:10px"><b>付款資訊</b><br><span style="white-space:pre-wrap">' + h(S['ATM轉帳資訊']) + '</span></div>' : '';
  const src = forAdmin ? '<p style="color:#7d6870">訂單來源：' + h((o.source && o.source.label) || '直接造訪') + (o.source && o.source.detail ? '（' + h(o.source.detail) + '）' : '') + '</p>' : '';
  return '<div style="font-family:Arial,\'Noto Sans TC\',sans-serif;max-width:560px;margin:auto;color:#3a2b30;line-height:1.7">' +
    '<h2 style="color:#b45a8a;margin:0 0 6px">' + (forAdmin ? '新訂單 #' + h(o.number) : '謝謝您的訂購！') + '</h2>' +
    '<p>' + (forAdmin ? h(b.billing_last_name + b.billing_first_name) + '　' + h(b.billing_phone) + '　' + h(b.billing_email) : '我們已收到您的訂單 <b>#' + h(o.number) + '</b>，將盡快為您處理。') + '</p>' + src + pay +
    '<table style="width:100%;border-collapse:collapse;margin:14px 0">' + rows + foot + '</table>' +
    (o.note ? '<p>備註：' + h(o.note) + '</p>' : '') +
    (forAdmin ? '' : '<p><a href="' + h(site + 'checkout-2/?order-received=' + encodeURIComponent(o.number) + '&key=' + encodeURIComponent(o.key)) + '" style="color:#b45a8a">查看訂單</a></p>') + '</div>';
}

/* ================= admin ================= */
function apiAdminLogin(q) {
  const fail = throttle('admin-login', 10);
  const p = PropertiesService.getScriptProperties();
  if (!safeEq(pwHash(String(q.password || '').slice(0, 200), p.getProperty('ADMIN_SALT')), p.getProperty('ADMIN_HASH'))) { fail(); throw new Error('密碼錯誤'); }
  return { token: sign('admin', 'admin', 14, adminVer()) };
}
function apiAdminPassword(q) {
  const p = PropertiesService.getScriptProperties();
  if (!safeEq(pwHash(String(q.old || '').slice(0, 200), p.getProperty('ADMIN_SALT')), p.getProperty('ADMIN_HASH'))) throw new Error('目前密碼錯誤');
  const np = String(q.password || '');
  if (np.length < 8 || np.length > 200) throw new Error('新密碼至少 8 個字元');
  setAdminPass(np); p.deleteProperty('ADMIN_INIT');
  return { token: sign('admin', 'admin', 14, adminVer()) };   // 其他裝置的後台登入全部失效，這台換發新的
}
function orderSummary(r) {
  return {
    number: String(r['訂單編號']), date: new Date(r['下單時間']).getTime(), status: r['狀態'], name: r['客戶姓名'], email: r['Email'], phone: String(r['電話']),
    account: r['會員帳號'], items: r['商品明細'], qty: r['件數'], subtotal: r['小計'], discount: r['折扣'], shipping: r['運費'], total: r['總計'],
    shipMethod: r['運送方式'], store: r['取貨門市'], address: r['收件地址'], payment: r['付款方式'], note: r['訂單備註'],
    source: r['訂單來源'], sourceDetail: r['來源細節'], landing: r['進站頁面'], device: r['裝置'], adminNote: r['管理備註']
  };
}
function apiAdminOverview() {
  const orders = readAll('orders').map(orderSummary);
  const now = new Date(), d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const valid = o => o.status !== '已取消' && o.status !== '已退費';
  const sum = l => l.reduce((s, o) => s + Number(o.total || 0), 0);
  const today = orders.filter(o => o.date >= d0 && valid(o)), month = orders.filter(o => o.date >= m0 && valid(o));
  const src = {}; orders.filter(o => o.date >= Date.now() - 30 * 864e5 && valid(o)).forEach(o => { const k = o.source || '直接造訪'; src[k] = src[k] || { n: 0, total: 0 }; src[k].n++; src[k].total += Number(o.total || 0); });
  const byStatus = {}; STATUSES.forEach(s => byStatus[s] = 0); orders.forEach(o => byStatus[o.status] = (byStatus[o.status] || 0) + 1);
  const days = []; for (let i = 13; i >= 0; i--) { const a = d0 - i * 864e5, z = a + 864e5; const l = orders.filter(o => o.date >= a && o.date < z && valid(o)); days.push({ d: a, n: l.length, total: sum(l) }); }
  const cat = readAll('catalog');
  const low = cat.filter(r => bool(r['有貨']) && num(r['庫存數量']) !== null && num(r['庫存數量']) <= 2).map(r => ({ id: String(r['商品ID']), name: r['商品名稱'], option: r['規格'], qty: num(r['庫存數量']) }));
  const top = {}; cat.forEach(r => { const k = r['商品名稱']; top[k] = (top[k] || 0) + Number(r['已售出'] || 0); });
  const members = readAll('members');
  return {
    today: { n: today.length, total: sum(today) }, month: { n: month.length, total: sum(month) },
    pending: byStatus['待付款'] || 0, toShip: byStatus['處理中'] || 0, byStatus, sources: src, days, low,
    top: Object.keys(top).map(k => ({ name: k, sold: top[k] })).filter(x => x.sold > 0).sort((a, b) => b.sold - a.sold).slice(0, 6),
    members: members.length, newMembers: members.filter(m => new Date(m['註冊時間']).getTime() >= Date.now() - 30 * 864e5).length,
    unread: readAll('messages').filter(m => !bool(m['已處理'])).length,
    recent: orders.slice(-6).reverse(), statuses: STATUSES
  };
}
function apiAdminOrders() { return { orders: readAll('orders').map(orderSummary).reverse(), statuses: STATUSES }; }
function apiAdminOrderUpdate(q) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let r;
  try {
    r = readAll('orders').find(x => String(x['訂單編號']) === String(q.number));
    if (!r) throw new Error('找不到訂單');
    if (q.adminNote !== undefined) setCell('orders', r._row, '管理備註', str(q.adminNote, 2000));
    if (q.status && q.status !== r['狀態']) {
      if (STATUSES.indexOf(q.status) < 0) throw new Error('狀態錯誤');
      const o = orderData(r);
      const wasOff = r['狀態'] === '已取消' || r['狀態'] === '已退費', isOff = q.status === '已取消' || q.status === '已退費';
      if (wasOff !== isOff) restock(o.items || [], isOff ? 1 : -1);
      setCell('orders', r._row, '狀態', q.status);
    }
  } finally { lock.releaseLock(); }
  if (q.notify && q.status && STATUSES.indexOf(q.status) >= 0) {
    const S = settings();
    const o = orderData(r), tracking = str(q.tracking, 300);
    const msg = { '處理中': '我們已確認收到款項，正在為您準備商品。', '已出貨': '您的商品已經出貨囉！' + (tracking ? '<br>追蹤資訊：' + h(tracking) : ''), '已完成': '訂單已完成，謝謝您的支持！', '已取消': '您的訂單已取消，如有疑問請與我們聯繫。', '已退費': '您的訂單已退費。' }[q.status];
    if (msg) try { mail(r['Email'], '【' + S['店名'] + '】訂單 #' + r['訂單編號'] + ' ' + q.status, '<div style="font-family:Arial,sans-serif;line-height:1.8;color:#3a2b30"><h2 style="color:#b45a8a">訂單 #' + h(r['訂單編號']) + '：' + q.status + '</h2><p>' + h((o.billing || {}).billing_last_name || '') + h((o.billing || {}).billing_first_name || '') + ' 您好，</p><p>' + msg + '</p><p><a href="' + h(siteUrl(S) + 'my-account/#orders') + '" style="color:#b45a8a">查看我的訂單</a></p></div>', true); } catch (x) { }
  }
  return { order: orderSummary(readAll('orders').find(x => String(x['訂單編號']) === String(q.number))) };
}
function restock(items, dir) {
  const cat = readAll('catalog'), byId = {};
  cat.forEach(r => byId[String(r['商品ID'])] = r);
  items.forEach(i => {
    const r = byId[String(i.vid && Number(i.vid) ? i.vid : i.pid)]; if (!r) return;
    const qty = int(i.qty, 1, 1e6); if (!qty) return;
    const left = num(r['庫存數量']);
    if (left !== null) {
      const n = Math.max(0, left + dir * qty);
      setCell('catalog', r._row, '庫存數量', n);
      if (dir > 0 && n > 0) setCell('catalog', r._row, '有貨', true);
      if (dir < 0 && n <= 0) setCell('catalog', r._row, '有貨', false);
    }
    setCell('catalog', r._row, '已售出', Math.max(0, Number(r['已售出'] || 0) - dir * qty));
  });
  dropCatalogCache();
}
function apiAdminMembers() {
  return { members: readAll('members').map(m => ({ email: m['Email'], name: m['姓名'], phone: String(m['電話']), created: new Date(m['註冊時間']).getTime(), last: m['最後登入'] ? new Date(m['最後登入']).getTime() : 0, orders: Number(m['訂單數'] || 0), spent: Number(m['消費總額'] || 0) })).reverse() };
}
function catalogItem(r) { return { id: String(r['商品ID']), parent: String(r['父商品ID']), name: r['商品名稱'], option: r['規格'], price: Number(r['價格']), inStock: bool(r['有貨']), qty: num(r['庫存數量']), sold: Number(r['已售出'] || 0) }; }
function apiAdminCatalog() { return { items: readAll('catalog').map(catalogItem) }; }
function apiAdminCatalogUpdate(q) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const cat = readAll('catalog'), byId = {};
    cat.forEach(r => byId[String(r['商品ID'])] = r);
    (Array.isArray(q.items) ? q.items : []).slice(0, 2000).forEach(u => {
      const r = byId[String(u.id)]; if (!r) return;
      if (u.price !== undefined && u.price !== null && u.price !== '') {
        const pr = int(u.price, 0, 10000000); if (pr === null) throw new Error('「' + r['商品名稱'] + '」的價格必須是 0 以上的整數');
        setCell('catalog', r._row, '價格', pr);
      }
      if (u.qty !== undefined) {
        const qn = u.qty === null || u.qty === '' ? '' : int(u.qty, 0, 1000000);
        if (qn === null) throw new Error('「' + r['商品名稱'] + '」的庫存數量必須是 0 以上的整數');
        setCell('catalog', r._row, '庫存數量', qn);
        if (qn !== '' && qn <= 0) setCell('catalog', r._row, '有貨', false);
      }
      if (u.inStock !== undefined && !(u.qty !== undefined && u.qty !== null && u.qty !== '' && Number(u.qty) <= 0)) setCell('catalog', r._row, '有貨', !!u.inStock);
    });
  } finally { lock.releaseLock(); }
  syncProductPrices();
  dropCatalogCache();
  return apiAdminCatalog();
}
function apiAdminCoupons() {
  return { coupons: readAll('coupons').map(r => ({ code: r['代碼'], type: couponType(r['類型']), amount: Number(r['折扣'] || 0), min: Number(r['最低消費'] || 0), limit: num(r['使用上限']), used: Number(r['已使用'] || 0), expires: r['到期日'] ? Utilities.formatDate(new Date(r['到期日']), 'Asia/Taipei', 'yyyy-MM-dd') : '', enabled: bool(r['啟用']), note: r['說明'] })) };
}
function apiAdminCouponSave(q) {
  const c = (q.coupon && typeof q.coupon === 'object') ? q.coupon : {};
  const code = str(c.code, 30);
  if (!/^[\w\-]{2,30}$/.test(code)) throw new Error('代碼只能用英文、數字、底線、減號（2–30 字）');
  const type = c.type === 'percent' ? 'percent' : 'fixed';
  const amount = int(c.amount, 0, type === 'percent' ? 100 : 10000000);
  if (amount === null) throw new Error(type === 'percent' ? '折扣 % 必須是 0～100 的整數' : '折抵金額必須是 0 以上的整數');
  const min = c.min === '' || c.min === undefined || c.min === null ? 0 : int(c.min, 0, 10000000);
  if (min === null) throw new Error('最低消費必須是 0 以上的整數');
  const limit = c.limit === '' || c.limit === undefined || c.limit === null || Number(c.limit) === 0 ? '' : int(c.limit, 1, 1000000);
  if (limit === null) throw new Error('可使用次數必須是整數');
  const expires = str(c.expires, 10);
  if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) throw new Error('到期日格式錯誤');
  const obj = { '代碼': code, '類型': type === 'percent' ? '百分比%' : '固定金額', '折扣': amount, '最低消費': min, '使用上限': limit, '到期日': expires, '啟用': !!c.enabled, '說明': str(c.note, 200) };
  const r = couponRow(c.original || code), dup = couponRow(code);
  if (dup && (!r || dup._row !== r._row)) throw new Error('已經有同代碼的折價券「' + code + '」');
  if (r) { obj['已使用'] = r['已使用'] || 0; writeRow('coupons', r._row, obj); } else { obj['已使用'] = 0; append('coupons', obj); }
  return apiAdminCoupons();
}
function apiAdminCouponDelete(q) { const r = couponRow(q.code); if (r) sheet('coupons').deleteRow(r._row); return apiAdminCoupons(); }
function apiAdminMessages() { return { messages: readAll('messages').map(m => ({ row: m._row, date: new Date(m['時間']).getTime(), name: m['姓名'], email: m['Email'], message: m['內容'], page: m['頁面'], done: bool(m['已處理']) })).reverse() }; }
function apiAdminMessageDone(q) {
  const row = int(q.row, 2, sheet('messages').getLastRow());
  if (row === null) throw new Error('找不到這則留言');
  setCell('messages', row, '已處理', !!q.done);
  return apiAdminMessages();
}
function apiAdminSettings() {
  return { settings: readAll('settings').filter(r => HIDDEN_SETTINGS.indexOf(r['項目']) < 0).map(r => ({ key: r['項目'], value: String(r['值']), note: r['說明'] })), sheetUrl: isDemo() ? '' : SpreadsheetApp.getActiveSpreadsheet().getUrl(), initPass: !!PropertiesService.getScriptProperties().getProperty('ADMIN_INIT'), demo: isDemo() };
}
function apiAdminSettingsSave(q) {
  const known = {}; readAll('settings').forEach(r => known[r['項目']] = 1);
  const v = (q.values && typeof q.values === 'object') ? q.values : {};
  Object.keys(v).forEach(k => {
    if (!known[k] || HIDDEN_SETTINGS.indexOf(k) >= 0) return;
    let x = str(v[k], 2000);
    if (k === '網站網址') { if (!/^https?:\/\/[^\s"'<>]+$/.test(x)) throw new Error('網站網址必須以 https:// 開頭'); if (!/\/$/.test(x)) x += '/'; }
    if (k === '通知Email' && x) x = emailOf(x);
    setSetting(k, x);
  });
  return apiAdminSettings();
}

/* ================= 後台新增商品（自動產生商品頁 p/?id=商品ID） ================= */
function listOf(v) { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function origOf(r) { try { const o = JSON.parse(r['原站商品'] || 'null'); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } }
function isOrigRow(r) { return !!origOf(r); }
function productOut(r, withStock) {
  const id = String(r['商品ID']), og = origOf(r);
  const o = {
    id, name: String(r['商品名稱']), price: Number(r['售價']) || 0, was: num(r['原價']), cats: listOf(r['分類']).map(Number),
    short: String(r['簡短說明'] || ''), desc: String(r['商品介紹'] || ''), imgs: listOf(r['圖片']), thumb: String(r['縮圖'] || ''),
    optName: String(r['規格名稱'] || ''), vars: listOf(r['規格']).map(v => ({ id: String(v.id), name: String(v.name), price: Number(v.price) || 0, img: String(v.img || '') })),
    t: new Date(r['建立時間']).getTime() || 0, published: bool(r['上架']),
    sku: String(r['貨號'] || ''), ups: listOf(r['推薦商品']).map(String)
  };
  if (og) { o.orig = true; o.keepImgs = !!og.keepImgs; o.keepDesc = !!og.keepDesc; if (!o.name) o.statusOnly = true; }
  if (bool(r['已刪除'])) o.deleted = true;
  if (withStock) {
    const byId = {}; readAll('catalog').forEach(c => byId[String(c['商品ID'])] = c);
    const st = cid => { const c = byId[cid]; return c ? { qty: num(c['庫存數量']), inStock: bool(c['有貨']), sold: Number(c['已售出'] || 0), price: Number(c['價格']) } : { qty: null, inStock: true, sold: 0 }; };
    if (o.vars.length) o.vars.forEach(v => Object.assign(v, st(v.id))); else Object.assign(o, { stock: st(id) });
  }
  return o;
}
function productRow(id) { id = String(id || ''); return id ? readAll('products').find(r => String(r['商品ID']) === id) : null; }
function apiAdminProducts() {
  const cat = readAll('catalog'), byId = {}; cat.forEach(c => byId[String(c['商品ID'])] = c);
  return {
    items: cat.map(catalogItem),
    products: readAll('products').map(r => {
      const o = productOut(r);
      const st = cid => { const c = byId[cid]; return c ? { qty: num(c['庫存數量']), inStock: bool(c['有貨']), sold: Number(c['已售出'] || 0), price: Number(c['價格']) } : { qty: null, inStock: true, sold: 0 }; };
      if (o.vars.length) o.vars.forEach(v => Object.assign(v, st(v.id))); else o.stock = st(o.id);
      return o;
    }).reverse()
  };
}
function nextProductId() {
  const S = settings();
  let n = int(S['下一個商品ID'], 1, 1e12) || NEW_ID_BASE + 1;
  const used = {}; readAll('catalog').forEach(r => used[String(r['商品ID'])] = 1);
  while (used[String(n)] || n <= NEW_ID_BASE) n++;
  setSetting('下一個商品ID', n + 1);
  return String(n);
}
function cleanImage(u) {
  u = String(u || '');
  if (/^https:\/\/[^\s"'<>\\`]{8,1500}$/.test(u)) return u;
  if (/^wp-content\/uploads\/[^\s"'<>\\`?#%]{1,400}$/.test(u) && u.indexOf('..') < 0) return u;   // 原站商品圖（網站內）
  if (isDemo() && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(u) && u.length < 3e6) return u;
  throw new Error('圖片網址格式錯誤，請重新上傳圖片');
}
// 原站商品＝商品庫存裡本來就有的商品（ID 不超過 900000）
function origExists(id, cat) {
  id = String(id || '');
  if (!/^\d{1,12}$/.test(id) || Number(id) > NEW_ID_BASE) return false;
  return (cat || readAll('catalog')).some(r => String(r['商品ID']) === id || String(r['父商品ID']) === id);
}
function apiAdminProductSave(q) {
  const p = (q.product && typeof q.product === 'object') ? q.product : {};
  const isOrig = p.orig === true;
  const name = str(p.name, 150);
  if (!name) throw new Error('請填寫商品名稱');
  const price = int(p.price, 0, 10000000);
  if (price === null) throw new Error('售價必須是 0 以上的整數');
  const was = p.was === '' || p.was === null || p.was === undefined ? '' : int(p.was, 0, 10000000);
  if (was === null) throw new Error('原價必須是整數');
  if (was !== '' && was <= price) throw new Error('原價要比售價高，才會顯示成特價（不需要特價就留空）');
  const cats = (Array.isArray(p.cats) ? p.cats : []).map(c => int(c, 1, 1e9)).filter(c => c !== null).slice(0, 20);
  const imgs = (Array.isArray(p.imgs) ? p.imgs : []).slice(0, isOrig ? 80 : 12).map(cleanImage);   // 原站商品最多有 56 張圖
  const thumb = p.thumb ? cleanImage(p.thumb) : (imgs[0] || '');
  if (!imgs.length) throw new Error('請至少上傳一張商品圖片');
  const optName = str(p.optName, 30) || '款式';
  const vin = (Array.isArray(p.vars) ? p.vars : []).slice(0, 40);
  const qtyOf = v => v === undefined ? undefined : (v === null || v === '' ? '' : int(v, 0, 1000000));
  const vars = vin.map(v => {
    const vn = str(v && v.name, 60);
    if (!vn) throw new Error('每個規格都要填名稱');
    const vp = v.price === '' || v.price === null || v.price === undefined ? price : int(v.price, 0, 10000000);
    if (vp === null) throw new Error('規格「' + vn + '」的價格必須是整數');
    const vq = qtyOf(v.qty); if (vq === null) throw new Error('規格「' + vn + '」的庫存數量必須是整數');
    return { id: v.id ? String(v.id) : '', name: vn, price: vp, qty: vq, img: v.img ? cleanImage(v.img) : '' };
  });
  const sku = str(p.sku, 40);
  const ups = (Array.isArray(p.ups) ? p.ups : []).map(x => int(Number(x), 1, 1e12)).filter(x => x !== null).map(String).slice(0, 12);
  const seenN = {}; vars.forEach(v => { if (seenN[v.name]) throw new Error('規格名稱「' + v.name + '」重複了'); seenN[v.name] = 1; });
  const singleQty = qtyOf(p.qty); if (singleQty === null) throw new Error('庫存數量必須是整數');
  const total = JSON.stringify(imgs).length;
  if (!isDemo() && total > 45000) throw new Error('圖片太多了，請減少幾張');

  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let id;
  try {
    const cat = readAll('catalog'), byId = {};
    cat.forEach(r => byId[String(r['商品ID'])] = r);
    const old = p.id ? productRow(p.id) : null;
    if (isOrig) { if (!origExists(p.id, cat)) throw new Error('找不到這個原站商品'); }
    else if (p.id && (!old || isOrigRow(old))) throw new Error('找不到這個商品（可能已被刪除）');
    id = isOrig ? String(p.id) : old ? String(old['商品ID']) : nextProductId();
    const oldVars = old ? listOf(old['規格']) : [];
    // 規格 ID 沿用（訂單、庫存才對得上）：新商品看自己存過的規格；原站商品看商品庫存裡屬於它的規格
    const mine = v => oldVars.some(o => String(o.id) === v.id) || (byId[v.id] && String(byId[v.id]['父商品ID']) === id);
    const usedV = {};
    vars.forEach(v => { if (!v.id || !mine(v) || usedV[v.id]) v.id = nextProductId(); usedV[v.id] = 1; });
    const published = p.published !== false;
    // 商品庫存分頁：單一規格＝一列（ID＝商品ID）；多規格＝每個規格一列（父商品ID＝商品ID）
    const want = vars.length ? vars.map(v => ({ id: v.id, parent: id, option: v.name, price: v.price, qty: v.qty })) : [{ id, parent: '', option: '', price, qty: singleQty }];
    const keep = {};
    want.forEach(w => {
      keep[w.id] = 1;
      const r = byId[w.id];
      const row = { '商品ID': w.id, '父商品ID': w.parent, '商品名稱': name, '規格': w.option, '價格': w.price,
        '有貨': r ? bool(r['有貨']) : true, '庫存數量': r ? r['庫存數量'] : '', '已售出': r ? Number(r['已售出'] || 0) : 0 };
      if (w.qty !== undefined) { row['庫存數量'] = w.qty; row['有貨'] = w.qty === '' ? (r && num(r['庫存數量']) === null ? bool(r['有貨']) : true) : w.qty > 0; }
      if (r) writeRow('catalog', r._row, row); else append('catalog', row);
    });
    // 刪掉被移除的規格列（由下往上刪，列號才不會跑掉）
    cat.filter(r => (String(r['商品ID']) === id || String(r['父商品ID']) === id) && !keep[String(r['商品ID'])])
      .map(r => r._row).sort((a, b) => b - a).forEach(n => sheet('catalog').deleteRow(n));
    const now = new Date();
    const row = { '商品ID': id, '商品名稱': name, '售價': price, '原價': was, '分類': JSON.stringify(cats), '簡短說明': str(p.short, 500),
      '商品介紹': str(p.desc, 20000), '圖片': JSON.stringify(imgs), '縮圖': thumb, '規格名稱': vars.length ? optName : '',
      '規格': JSON.stringify(vars.map(v => v.img ? { id: v.id, name: v.name, price: v.price, img: v.img } : { id: v.id, name: v.name, price: v.price })), '上架': published,
      '建立時間': old && old['建立時間'] ? old['建立時間'] : now, '更新時間': now, '貨號': sku, '推薦商品': JSON.stringify(ups.filter(u => u !== id)),
      '原站商品': isOrig ? JSON.stringify({ keepImgs: p.keepImgs === true, keepDesc: p.keepDesc === true }) : '', '已刪除': false };
    if (old) writeRow('products', old._row, row); else append('products', row);
  } finally { lock.releaseLock(); }
  dropCatalogCache();
  return { id, product: productOut(productRow(id), true) };
}
// 原站商品沒有資料列時，建立一列只記狀態（商品名稱空白＝內容照原站）
function origStatusRow(id, on, del) {
  const now = new Date();
  append('products', { '商品ID': id, '上架': on, '已刪除': del, '原站商品': JSON.stringify({ statusOnly: true }), '建立時間': now, '更新時間': now,
    '分類': '[]', '圖片': '[]', '規格': '[]', '推薦商品': '[]' });
}
// 上架／下架；上架也會把「已刪除」的商品還原
function apiAdminProductStatus(q) {
  const id = String(q.id || ''), on = q.published === true;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const r = productRow(id);
    if (r) { setCell('products', r._row, '上架', on); if (on) setCell('products', r._row, '已刪除', false); setCell('products', r._row, '更新時間', new Date()); }
    else if (origExists(id)) origStatusRow(id, on, false);
    else throw new Error('找不到這個商品');
  } finally { lock.releaseLock(); }
  dropCatalogCache();
  return apiAdminProducts();
}
function apiAdminProductDelete(q) {
  const id = String(q.id || '');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const r = productRow(id);
    if ((r && isOrigRow(r)) || (!r && origExists(id))) {
      // 原站商品：網站上隱藏、不能下單；庫存資料保留，之後可以「還原」
      if (r) { setCell('products', r._row, '已刪除', true); setCell('products', r._row, '上架', false); setCell('products', r._row, '更新時間', new Date()); }
      else origStatusRow(id, false, true);
    } else {
      if (!r) throw new Error('找不到這個商品');
      readAll('catalog').filter(c => String(c['商品ID']) === id || String(c['父商品ID']) === id).map(c => c._row).sort((a, b) => b - a).forEach(n => sheet('catalog').deleteRow(n));
      sheet('products').deleteRow(r._row);
    }
  } finally { lock.releaseLock(); }
  dropCatalogCache();
  return apiAdminProducts();
}
// 庫存頁改了價格 → 同步到商品分頁（單一規格的售價、多規格的各規格價）
function syncProductPrices() {
  const byId = {}; readAll('catalog').forEach(c => byId[String(c['商品ID'])] = c);
  readAll('products').forEach(r => {
    const id = String(r['商品ID']), vars = listOf(r['規格']);
    if (!String(r['商品名稱'])) return;   // 只記上下架狀態的原站商品
    if (vars.length) {
      let ch = false; vars.forEach(v => { const c = byId[String(v.id)]; if (c && Number(c['價格']) !== Number(v.price)) { v.price = Number(c['價格']); ch = true; } });
      if (ch) setCell('products', r._row, '規格', JSON.stringify(vars));
    } else if (byId[id] && Number(byId[id]['價格']) !== Number(r['售價'])) setCell('products', r._row, '售價', Number(byId[id]['價格']));
  });
}
// 圖片：base64 → 存到 Google 雲端硬碟「云云代購商品圖片」資料夾，公開檢視 → 回傳圖片網址
function apiAdminUploadImage(q) {
  const d = String(q.data || '');
  const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+\/=]+)$/.exec(d);
  if (!m) throw new Error('只接受 JPG／PNG／WebP／GIF 圖片');
  if (m[2].length > 8e6) throw new Error('圖片太大（上限約 6MB）');
  return { url: storeImage(d, m[1], m[2], str(q.name, 80).replace(/[^\w.\-一-鿿]/g, '_') || 'image') };
}
function storeImage(dataUrl, mime, b64, name) {
  const blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, Date.now() + '_' + name);
  const props = PropertiesService.getScriptProperties();
  let folder = null;
  const fid = props.getProperty('IMG_FOLDER');
  if (fid) { try { folder = DriveApp.getFolderById(fid); } catch (e) { folder = null; } }
  if (!folder) { folder = DriveApp.createFolder('云云代購商品圖片'); props.setProperty('IMG_FOLDER', folder.getId()); }
  const f = folder.createFile(blob);
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://lh3.googleusercontent.com/d/' + f.getId();
}


  /* ---------- 展示模式專屬覆寫 ---------- */
  function isDemo() { return true; }
  function storeImage(dataUrl) { return dataUrl; }   // 圖片直接存在瀏覽器裡（正式版存 Google 雲端硬碟）

  var ready = false;
  function init() {
    load();
    if (!ready) {
      if (!SS.getSheetByName('設定')) { setup(); setAdminPass('demo1234'); PropertiesService.getScriptProperties().deleteProperty('ADMIN_INIT'); }
      Object.keys(SHEETS).forEach(function (k) { sheet(k); });   // 舊版展示資料自動補上新分頁
      seedMissing();   // 新版多出來的原站規格補進庫存
      var root = window.YY_DEMO_ROOT;
      if (root && settings()['網站網址'] !== root) setSetting('網站網址', root);
      save(); ready = true;
    }
  }
  function run(fn) {
    try {
      init();
      var r = JSON.parse(fn().s);
      save();
      return r;
    } catch (e) {
      bookRaw = null; book = null; ready = false;   // 寫入失敗 → 丟掉記憶體裡的變更，下次重新讀取
      if (e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message))) return { ok: false, error: '展示模式的瀏覽器儲存空間已滿（多半是圖片太多）。請刪掉幾個商品或圖片，或到後台「設定」清除展示資料。' };
      return { ok: false, error: '展示模式發生錯誤：' + (e && e.message || e) };
    }
  }
  window.YY_DEMO = {
    post: function (obj) { return run(function () { return doPost({ postData: { contents: JSON.stringify(obj) } }); }); },
    get: function (params) { return run(function () { return doGet({ parameter: params || {} }); }); },
    mails: function () { try { return JSON.parse(LSget(MAILS) || '[]'); } catch (e) { return []; } },
    reset: function () { [BOOK, PROPS, CACHE, MAILS].forEach(function (k) { localStorage.removeItem(k); }); book = bookRaw = null; ready = false; },
    usage: function () { var n = 0; [BOOK, PROPS, CACHE, MAILS].forEach(function (k) { n += (LSget(k) || '').length; }); return n; }
  };
})();
