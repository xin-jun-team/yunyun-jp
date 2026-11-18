/* 云云代購 — 站台設定（免費版：取代 WooCommerce 付費外掛）
 * gasUrl: 'demo'：展示模式（不用試算表）。後台、商品上架、會員、訂單都能操作，但資料只存在「這台裝置的這個瀏覽器」，別人看不到
 * gasUrl 填入 Google Apps Script 部署網址：正式上線。會員、訂單、庫存、商品、折價券、留言都寫進 Google 試算表，所有人看到同一份
 */
window.YY_CONFIG = {
  gasUrl: 'demo',           // 正式上線改成：https://script.google.com/macros/s/XXXX/exec
  contactEmail: 'info@yunyun-ec.com',

  // 運送方式（與「購物須知」一致）
  shipping: [
    { id: 'cvs_711',    label: '超商取貨 7-ELEVEN｜滿三千免運', cost: 60, freeOver: 3000, countries: ['TW'], store: true, map: 'https://emap.pcsc.com.tw/' },
    { id: 'cvs_family', label: '超商取貨 全家｜滿三千免運',     cost: 60, freeOver: 3000, countries: ['TW'], store: true, map: 'https://www.family.com.tw/Marketing/zh/Map' },
    { id: 'sf_express', label: '順豐宅配 | 運費到付($95起)｜滿六千免運', cost: 0, countries: ['TW'] },
    { id: 'sf_hkmo',    label: '順豐宅配 | 運費到付', cost: 0, countries: ['HK', 'MO'] }
  ],

  // 折價券（有 gasUrl 時改由試算表「折價券」分頁管理）：{ 'CODE': { type: 'percent' | 'fixed', amount: 數字, min: 最低消費 } }
  coupons: {},

  // ATM 付款說明（下單完成頁顯示）；留空則顯示「將以 Email 提供付款資訊」
  bankInfo: ''
};
