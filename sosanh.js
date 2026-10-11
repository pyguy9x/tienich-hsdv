// So sánh 3 cột: Trang web (tcxdd đang mở) – Đám mây – Sửa. Lưu mục đã sửa lên mây.
(() => {
'use strict';
var $ = function(id) { return document.getElementById(id); };
function esc(s) { return String(s == null ? '' : s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;'); }
function ru(s) { return String(s == null ? '' : s).toLowerCase().split(' ').filter(function(x) { return x; }).join(' '); }
function mang(a) { return Array.isArray(a) ? a : Object.values(a || {}).filter(function(x) { return x; }); }

// ---------- Mã bí mật ----------
var FB_URL = 'https://hung-da4c1-default-rtdb.asia-southeast1.firebasedatabase.app';
var MA_MAC_DINH = 'uPjRMZvtogiFls0X2n71sd5o098RcsPdVfxjPUBm';
var CO_CHROME = (typeof chrome !== 'undefined') && !!(chrome.storage && chrome.storage.local);
function getSecret() { return $('secret').value.trim(); }
async function napSecret() {
  var v = '';
  try {
    if (CO_CHROME) v = (await chrome.storage.local.get('ssSecret')).ssSecret || '';
    else v = localStorage.getItem('ssSecret') || '';
  } catch (e) {}
  $('secret').value = v || MA_MAC_DINH;
}
async function nhoSecret() {
  try {
    var v = getSecret();
    if (CO_CHROME) await chrome.storage.local.set({ ssSecret: v });
    else localStorage.setItem('ssSecret', v);
  } catch (e) {}
}

// ---------- Làm sạch dữ liệu Firebase (key . $ # [ ] / thành _) ----------
function sachChuoiFb(s) {
  var r = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c === 65534 || c === 65535 || c === 127) continue;
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) continue;
    if (c >= 55296 && c <= 57343) {
      var hi = c <= 56319;
      var nx = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      var pv = i > 0 ? s.charCodeAt(i - 1) : 0;
      if ((hi && nx >= 56320 && nx <= 57343) || (!hi && pv >= 55296 && pv <= 56319)) { r += s[i]; }
      continue;
    }
    r += s[i];
  }
  return r;
}
function sachKhoaFb(k) { return sachChuoiFb(String(k)).split('.').join('_').split('$').join('_').split('#').join('_').split('[').join('_').split(']').join('_').split('/').join('_') || '_'; }
function sachFb(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') return sachChuoiFb(v);
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map(sachFb);
  if (typeof v === 'object') {
    var o = {};
    for (var k in v) {
      if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
      var x = v[k];
      if (x === undefined) continue;
      o[sachKhoaFb(k)] = sachFb(x);
    }
    return o;
  }
  return String(v);
}
function sachFbRoot(o) {
  if (o === undefined || o === null || typeof o !== 'object' || Array.isArray(o)) return sachFb(o);
  var r = {};
  for (var k in o) {
    if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
    r[k] = sachFb(o[k]);
  }
  return r;
}
async function fb(method, path, body) {
  var secret = getSecret();
  if (!secret) throw new Error('Chưa nhập mã bí mật.');
  var url = (path ? FB_URL + '/' + path + '.json' : FB_URL + '/.json') + '?auth=' + encodeURIComponent(secret);
  var r = await fetch(url, { method: method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(sachFbRoot(body)) });
  var t = await r.text();
  if (!r.ok) { var m = t; try { m = JSON.parse(t).error || t; } catch (e) {} throw new Error('Lỗi máy chủ: ' + m); }
  return t ? JSON.parse(t) : null;
}

// ---------- Cấu hình các mục ----------
var QTCT_TRUONG = [['fromDate', 'Từ tháng/năm'], ['toDate', 'Đến tháng/năm'], ['nationId', 'Quốc gia'], ['companyName', 'Tên tổ chức'], ['partyPositionIds', 'Chức vụ đảng (cách nhau dấu ;)'], ['concurrentPartyPosition', 'Chức vụ Đảng kiêm nhiệm'], ['companyPosition', 'Chức danh, chức vụ, nghề nghiệp'], ['note', 'Ghi chú']];
var QH_TRUONG = [['type', 'Phân loại'], ['familyMemberId', 'Quan hệ'], ['isPartyMember', 'Là đảng viên'], ['fullName', 'Họ và tên'], ['identifyNo', 'Số căn cước'], ['birthDate', 'Năm sinh'], ['currentStatus', 'Tình trạng (qua đời/ly hôn)'], ['finishedYear', 'Năm qua đời/ly hôn'], ['currentJob', 'Công việc'], ['nationalityId', 'Quốc tịch'], ['nationId', 'Nơi ở hiện nay'], ['residentPlace', 'Chi tiết nơi ở'], ['hometown', 'Quê quán'], ['note', 'Ghi chú']];
var KT_TRUONG = [['householdAnnualIncome', 'Tổng thu nhập hộ/năm (đồng)'], ['perCapitaAnnualIncome', 'Thu nhập bình quân đầu người (đồng)'], ['economicActivity', 'Hoạt động kinh tế'], ['countWorker', 'Số lao động thuê mướn'], ['nhaCapLoai', 'Nhà được cấp/thuê – loại'], ['nhaCapDienTich', 'Nhà được cấp/thuê – m2'], ['nhaMuaLoai', 'Nhà tự mua/xây – loại'], ['nhaMuaDienTich', 'Nhà tự mua/xây – m2'], ['datCap', 'Đất được cấp (m2)'], ['datMua', 'Đất tự mua (m2)'], ['datTrangTrai', 'Đất trang trại (ha)'], ['taiSan1Ten', 'Tài sản 1 – tên'], ['taiSan1GiaTri', 'Tài sản 1 – giá trị (đồng)'], ['taiSan2Ten', 'Tài sản 2 – tên'], ['taiSan2GiaTri', 'Tài sản 2 – giá trị (đồng)'], ['taiSan3Ten', 'Tài sản 3 – tên'], ['taiSan3GiaTri', 'Tài sản 3 – giá trị (đồng)']];
var SECS = [
  { ma: 'b1', so: 'B1', ten: 'Thông tin cơ bản', cloud: 'hoSo', kieu: 'form', truong: TRUONG_HO_SO.map(function(t) { return [t[0], t[1]]; }) },
  { ma: 'qtct', so: 'B2', ten: 'Quá trình công tác', cloud: 'quaTrinhCongTac', kieu: 'ds', truong: QTCT_TRUONG },
  { ma: 'qh', so: 'B8', ten: 'Quan hệ gia đình', cloud: 'quanHeGiaDinh', kieu: 'ds', truong: QH_TRUONG },
  { ma: 'kt', so: 'B9', ten: 'Hoàn cảnh kinh tế', cloud: 'hoanCanhKinhTe', kieu: 'form', truong: KT_TRUONG },
  { ma: 'dd', so: 'B6', ten: 'Đặc điểm lịch sử', cloud: 'dacDiemLichSu', kieu: 'form', truong: TRUONG_DD.map(function(t) { return [t[0], t[1]]; }) }
];
Object.keys(DS_THEM).forEach(function(b) {
  var c = DS_THEM[b];
  SECS.push({ ma: b, so: c.so, ten: c.ten, cloud: b, kieu: 'ds', truong: c.truong.map(function(t) { return [t[0], t[1]]; }) });
});

// ---------- Đọc trang tcxdd (hàm tự chứa, chạy trong tab đích) ----------
function dumpTrang() {
  var out = { forms: {}, tables: [] };
  document.querySelectorAll('[formcontrolname]').forEach(function(h) {
    var k = h.getAttribute('formcontrolname');
    if (!k || out.forms[k] !== undefined) return;
    var v = '';
    var tag = h.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') v = h.value || '';
    else if (tag === 'VTS-SELECT' || h.querySelector('vts-select-top-control')) {
      var t = h.querySelector('vts-select-top-control');
      v = t ? t.innerText.trim() : h.innerText.trim();
      if (v.slice(0, 2) === '--') v = '';
    } else if (h.querySelector('input[type=checkbox]')) {
      v = h.querySelector('input[type=checkbox]').checked ? 'Có' : '';
    } else {
      var lab = h.querySelector('label.vts-radio-wrapper-checked');
      v = lab ? lab.innerText.trim() : h.innerText.trim();
    }
    out.forms[k] = v;
  });
  document.querySelectorAll('table').forEach(function(tb) {
    if (tb.offsetParent === null) return;
    var rows = [];
    tb.querySelectorAll('tr').forEach(function(tr, ri) {
      if (ri > 40) return;
      var cells = [];
      tr.querySelectorAll('th,td').forEach(function(td, ci) {
        if (ci > 12) return;
        var s = td.innerText.trim();
        if (s) cells.push(s);
      });
      if (cells.length) rows.push(cells.join(' | '));
    });
    if (rows.length) out.tables.push(rows);
  });
  return out;
}
async function tabTcxdd() {
  if (!CO_CHROME || !chrome.tabs || !chrome.tabs.query || !chrome.scripting || !chrome.scripting.executeScript) throw new Error('Trang so sánh đang mở ngoài extension nên không đọc được tab tcxdd. Hãy mở đúng bằng địa chỉ extension: vào chrome://extensions (bật chế độ nhà phát triển), xem ID của tiện ích Điền hồ sơ đảng viên, rồi mở chrome-extension://ID/sosanh.html');
  var tabs = await chrome.tabs.query({ url: 'https://tcxdd.dcs.vn/*' });
  if (!tabs.length) throw new Error('Chưa mở trang tcxdd.dcs.vn. Hãy mở hồ sơ đảng viên trên trang rồi bấm lại.');
  var act = tabs.filter(function(t) { return t.active; })[0] || tabs[0];
  return act.id;
}

// ---------- State ----------
var DS = [];
var CUR = null;
var MUC = 'b1';
function thongBao(t, lop) {
  var tb = $('tb');
  tb.innerHTML = '';
  if (t) {
    var d = document.createElement('div');
    d.className = 'thongbao ' + (lop || 'ok');
    d.textContent = t;
    tb.append(d);
  }
}

// ---------- Tải danh sách hồ sơ trên mây ----------
async function taiDuLieu() {
  $('tai').disabled = true;
  thongBao('Đang tải danh sách hồ sơ…', 'ok');
  try {
    await nhoSecret();
    var ds = await fb('GET', 'dsHoSo');
    DS = Object.entries(ds || {}).map(function(p) {
      var id = p[0], x = p[1] || {};
      return { id: id, ten: x.ten || '', cccd: x.cccd || '', ngaySinh: x.ngaySinh || '', nguoiNhap: x.nguoiNhap || '', capNhat: x.capNhat || '' };
    });
    DS.sort(function(a, b) { return String(a.ten).localeCompare(String(b.ten), 'vi'); });
    $('lanTai').textContent = 'Đã tải ' + DS.length + ' hồ sơ lúc ' + new Date().toLocaleTimeString('vi-VN');
    thongBao('Đã tải ' + DS.length + ' hồ sơ.', 'ok');
    veDs();
  } catch (e) { thongBao('Lỗi: ' + e.message, 'loi'); }
  $('tai').disabled = false;
}
function veDs() {
  var q = ru($('tim').value);
  var box = $('ds');
  box.innerHTML = '';
  DS.filter(function(d) {
    return !q || ru(d.ten).indexOf(q) >= 0 || ru(d.cccd).indexOf(q) >= 0 || ru(d.id).indexOf(q) >= 0;
  }).forEach(function(d) {
    var o = document.createElement('div');
    o.className = 'hs' + (CUR && CUR.id === d.id ? ' on' : '');
    var b = document.createElement('b');
    b.textContent = d.ten || '(chưa có họ tên)';
    var s = document.createElement('small');
    s.textContent = 'CCCD: ' + (d.cccd || '—') + ' · mã ' + d.id;
    o.append(b, s);
    o.onclick = function() { chonHoSo(d.id); };
    box.append(o);
  });
}

// ---------- Chọn hồ sơ ----------
async function chonHoSo(id) {
  thongBao('Đang tải hồ sơ ' + id + '…', 'ok');
  try {
    var rec = await fb('GET', 'hoso/' + encodeURIComponent(id));
    var idx = DS.filter(function(d) { return d.id === id; })[0] || {};
    CUR = { id: id, ten: idx.ten || '', rec: rec || {}, trang: {}, trangDong: {} };
    $('khuHoSo').hidden = false;
    $('khuRong').hidden = true;
    $('tenHs').textContent = (CUR.ten || '(chưa có họ tên)') + ' · mã ' + id;
    $('ttHs').textContent = 'CCCD ' + (idx.cccd || '—') + (idx.nguoiNhap ? ' · người nhập ' + idx.nguoiNhap : '');
    thongBao('', '');
    veDs();
    veTabs();
    veMuc();
  } catch (e) { thongBao('Lỗi: ' + e.message, 'loi'); }
}
function secHienTai() { return SECS.filter(function(s) { return s.ma === MUC; })[0] || SECS[0]; }
function veTabs() {
  var t = $('tabs');
  t.innerHTML = '';
  SECS.forEach(function(s) {
    var b = document.createElement('button');
    b.textContent = s.so + ' ' + s.ten;
    if (s.ma === MUC) b.className = 'on';
    b.onclick = function() { MUC = s.ma; veTabs(); veMuc(); };
    t.append(b);
  });
}
function giaTriMay(sec) {
  var v = CUR.rec[sec.cloud];
  if (sec.kieu === 'ds') return mang(v).filter(function(x) { return x && typeof x === 'object'; });
  return (v && typeof v === 'object') ? v : {};
}

// ---------- Đọc trang web ----------
async function docTrang() {
  var sec = secHienTai();
  try {
    thongBao('Đang đọc trang tcxdd…', 'ok');
    var tabId = await tabTcxdd();
    var inj = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: dumpTrang });
    var dump = inj && inj[0] && inj[0].result;
    if (!dump) throw new Error('Không đọc được nội dung trang.');
    CUR.trang[sec.ma] = dump;
    thongBao('Đã đọc trang web (' + Object.keys(dump.forms).length + ' ô, ' + dump.tables.length + ' bảng).', 'ok');
    veMuc();
  } catch (e) { thongBao('Lỗi đọc trang: ' + e.message, 'loi'); }
}

// ---------- Vẽ mục 3 cột ----------
function hangForm(sec, key, nhan, gTrang, gMay) {
  var tr = document.createElement('tr');
  var khac = gTrang !== '' && gMay !== '' && ru(gTrang) !== ru(gMay);
  if (khac) tr.className = 'khac';
  var td0 = document.createElement('td'); td0.textContent = nhan;
  var td1 = document.createElement('td'); td1.className = 'goc'; td1.textContent = gTrang;
  var td2 = document.createElement('td'); td2.className = 'may'; td2.textContent = gMay;
  var td3 = document.createElement('td');
  var inp = document.createElement('input');
  inp.className = 'sua'; inp.value = gMay; inp.dataset.k = key;
  var bT = document.createElement('button'); bT.className = 'nho'; bT.textContent = '← Trang'; bT.title = 'Chép giá trị từ trang web sang ô sửa';
  bT.onclick = function() { inp.value = gTrang; };
  var bM = document.createElement('button'); bM.className = 'nho'; bM.textContent = 'Mây'; bM.title = 'Đặt lại ô sửa theo đám mây';
  bM.onclick = function() { inp.value = gMay; };
  td3.append(inp, document.createTextNode(' '), bT, document.createTextNode(' '), bM);
  tr.append(td0, td1, td2, td3);
  return tr;
}
function veMuc() {
  var box = $('khuMuc');
  box.innerHTML = '';
  if (!CUR) return;
  var sec = secHienTai();
  var dump = CUR.trang[sec.ma] || null;
  var head = document.createElement('div');
  head.className = 'hang';
  head.style.marginBottom = '8px';
  var h = document.createElement('b');
  h.textContent = sec.so + ' ' + sec.ten;
  var bDoc = document.createElement('button');
  bDoc.textContent = 'Đọc trang web';
  bDoc.title = 'Mở đúng mục này trên tcxdd rồi bấm để đọc giá trị đang hiện trên trang';
  bDoc.onclick = docTrang;
  var bLuu = document.createElement('button');
  bLuu.className = 'xanh';
  bLuu.textContent = 'Lưu mục này lên mây';
  bLuu.title = 'Ghi cột Sửa lên đám mây (ô trống trong form nghĩa là xóa key đó)';
  bLuu.onclick = luuMuc;
  if (sec.kieu === 'form') {
    var bGhi = document.createElement('button');
    bGhi.textContent = 'Ghi cột Sửa ra trang';
    bGhi.title = 'Tự điền ô text/ngày ra trang web; ô xổ xuống hiện popup trên trang để bạn chọn tay (không tự bấm Lưu trên trang)';
    bGhi.onclick = ghiRaTrang;
    head.append(bGhi);
  }
  var ghi = document.createElement('span');
  ghi.className = 'mo';
  ghi.textContent = dump ? 'Đã đọc trang web.' : 'Chưa đọc trang web – mở đúng mục trên tcxdd rồi bấm “Đọc trang web”.';
  head.append(h, bDoc, bLuu, ghi);
  box.append(head);
  var tb = document.createElement('table');
  tb.className = 'ss';
  var trh = document.createElement('tr');
  ['Trường', 'Trang web', 'Đám mây', 'Sửa (mặc định theo mây)'].forEach(function(t) {
    var th = document.createElement('th');
    th.textContent = t;
    trh.append(th);
  });
  tb.append(trh);
  if (sec.kieu === 'form') {
    var may = giaTriMay(sec);
    var forms = dump ? dump.forms : {};
    var keys = sec.truong.map(function(t) { return t[0]; });
    Object.keys(may).forEach(function(k) { if (keys.indexOf(k) < 0 && k.slice(0, 2) !== '__') keys.push(k); });
    Object.keys(forms).forEach(function(k) { if (keys.indexOf(k) < 0) keys.push(k); });
    var nhanCua = {};
    sec.truong.forEach(function(t) { nhanCua[t[0]] = t[1]; });
    keys.forEach(function(k) {
      tb.append(hangForm(sec, k, nhanCua[k] || k, forms[k] == null ? '' : String(forms[k]), may[k] == null ? '' : String(may[k])));
    });
  } else {
    if (dump && dump.tables.length) {
      var pre = document.createElement('div');
      pre.className = 'mo';
      pre.textContent = 'Bảng đang hiện trên trang (' + dump.tables.length + ' bảng):';
      box.append(pre);
      dump.tables.forEach(function(rows) {
        var d = document.createElement('div');
        d.className = 'pre bangtrang';
        rows.forEach(function(r, i) {
          var p = document.createElement('div');
          p.textContent = (i + 1) + '. ' + r;
          d.append(p);
        });
        box.append(d);
      });
    } else {
      var mo = document.createElement('div');
      mo.className = 'mo';
      mo.textContent = 'Mục dạng danh sách: cột Trang web chỉ để nhìn đối chiếu (bấm “Đọc trang web” khi đang mở bảng này trên trang). Sửa trực tiếp từng ô ở cột Sửa.';
      box.append(mo);
    }
    var rows = giaTriMay(sec);
    var nhanCua2 = {};
    sec.truong.forEach(function(t) { nhanCua2[t[0]] = t[1]; });
    rows.forEach(function(row, i) {
      var rh = document.createElement('tr');
      var th = document.createElement('td');
      th.colSpan = 4;
      var b = document.createElement('b');
      b.textContent = 'Dòng ' + (i + 1);
      var bX = document.createElement('button');
      bX.className = 'nho';
      bX.textContent = 'Xóa dòng này';
      bX.style.marginLeft = '8px';
      bX.onclick = function() { rows.splice(i, 1); veMuc(); };
      var bD = document.createElement('button');
      bD.className = 'nho';
      bD.textContent = 'Đọc dòng này từ trang';
      bD.title = 'Mở dòng tương ứng trên trang tcxdd để đọc chi tiết từng ô vào cột Trang web';
      bD.style.marginLeft = '8px';
      bD.onclick = function() { docDong(sec.ma, i); };
      th.append(b, bX, bD);
      rh.append(th);
      tb.append(rh);
      var pd = ((CUR.trangDong[sec.ma] || {})[i]) || {};
      sec.truong.forEach(function(t) {
        var k = t[0];
        var v = row[k] == null ? '' : String(row[k]);
        var g = pd[k] == null ? '' : String(pd[k]);
        tb.append(hangForm(sec, i + '.' + k, 'D' + (i + 1) + ' – ' + t[1], g, v));
      });
      Object.keys(row).forEach(function(k) {
        if (k.slice(0, 2) === '__' || nhanCua2[k]) return;
        var g2 = pd[k] == null ? '' : String(pd[k]);
        tb.append(hangForm(sec, i + '.' + k, 'D' + (i + 1) + ' – ' + k, g2, row[k] == null ? '' : String(row[k])));
      });
    });
    var bThem = document.createElement('button');
    bThem.textContent = '+ Thêm dòng';
    bThem.style.marginTop = '8px';
    bThem.onclick = function() { rows.push({}); CUR.rec[sec.cloud] = rows; veMuc(); };
    box.append(tb, bThem);
    return;
  }
  box.append(tb);
}

// ---------- Lưu mục lên mây ----------
function docSuaForm() {
  var o = {};
  document.querySelectorAll('#khuMuc input.sua').forEach(function(inp) {
    var v = inp.value.trim();
    o[inp.dataset.k] = v === '' ? null : v;
  });
  return o;
}
async function luuMuc() {
  var sec = secHienTai();
  try {
    var body;
    if (sec.kieu === 'form') {
      body = {};
      body[sec.cloud] = docSuaForm();
    } else {
      var rows = [];
      var map = {};
      document.querySelectorAll('#khuMuc input.sua').forEach(function(inp) {
        var p = inp.dataset.k.split('.');
        var i = Number(p[0]), k = p.slice(1).join('.');
        map[i] = map[i] || {};
        var v = inp.value.trim();
        if (v !== '') map[i][k] = v;
      });
      Object.keys(map).sort(function(a, b) { return a - b; }).forEach(function(i) {
        if (Object.keys(map[i]).length) rows.push(map[i]);
      });
      body = {};
      body[sec.cloud] = rows.length ? rows : null;
    }
    await fb('PATCH', 'hoso/' + encodeURIComponent(CUR.id), body);
    if (sec.ma === 'qtct' || sec.ma === 'qh') {
      var dem = {};
      dem[sec.ma === 'qtct' ? 'soCongTac' : 'soNguoiThan'] = (body[sec.cloud] || []).length;
      await fb('PATCH', 'dsHoSo/' + encodeURIComponent(CUR.id), dem).catch(function() {});
    }
    var lai = await fb('GET', 'hoso/' + encodeURIComponent(CUR.id));
    CUR.rec = lai || {};
    thongBao('Đã lưu ' + sec.so + ' ' + sec.ten + ' lên đám mây.', 'ok');
    veMuc();
  } catch (e) { thongBao('Không lưu được: ' + e.message, 'loi'); }
}

var KIEU_TRUONG = {};
TRUONG_HO_SO.forEach(function(t) { KIEU_TRUONG[t[0]] = t[2]; });
TRUONG_DD.forEach(function(t) { KIEU_TRUONG[t[0]] = t[2]; });
function apiGhiTrang(fields) {
  function datText(h, v) {
    var tag = h.tagName;
    var el = (tag === 'INPUT' || tag === 'TEXTAREA') ? h : h.querySelector('input, textarea');
    if (!el || el.disabled || el.readOnly) return false;
    try {
      var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var d = Object.getOwnPropertyDescriptor(proto, 'value');
      if (d && d.set) d.set.call(el, v); else el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) { return false; }
  }
  var tu = 0, tay = [], loi = [];
  fields.forEach(function(f) {
    var hs = document.querySelectorAll('[formcontrolname="' + f.key + '"]');
    var h = hs && hs[0];
    if (!h) { loi.push(f.key); return; }
    if (f.kieu === 'select' || f.kieu === 'org' || f.kieu === 'multi') {
      var cur = '';
      var tc = h.querySelector('vts-select-top-control');
      cur = tc ? tc.innerText.trim() : h.innerText.trim();
      tay.push({ key: f.key, nhan: f.nhan || f.key, goiY: f.value, hien: cur });
      return;
    }
    if (f.kieu === 'radio') {
      var ok = false;
      h.querySelectorAll('label').forEach(function(l) { if (!ok && l.innerText.trim() === f.value) { l.click(); ok = true; } });
      if (ok) tu++; else loi.push(f.key);
      return;
    }
    if (f.kieu === 'check') {
      var cb = h.querySelector('input[type=checkbox]');
      if (!cb) { loi.push(f.key); return; }
      var muon = (f.value === 'Có' || f.value === 'co' || f.value === 'true' || f.value === '1');
      if (cb.checked !== muon) cb.click();
      tu++;
      return;
    }
    if (datText(h, f.value)) tu++; else loi.push(f.key);
  });
  return { tu: tu, tay: tay, loi: loi };
}
function apiPanelTay(rows) {
  var cu = document.getElementById('__ss_ghi');
  if (cu) cu.remove();
  var hop = document.createElement('div');
  hop.id = '__ss_ghi';
  hop.style.cssText = 'position:fixed;z-index:2147483600;right:12px;top:12px;width:330px;max-height:80vh;overflow:auto;background:#fff;border:2px solid #b91c1c;border-radius:10px;padding:10px 12px;font:13px/1.5 Segoe UI,Arial,sans-serif;color:#1f2937;box-shadow:0 6px 24px rgba(0,0,0,.3)';
  var t = document.createElement('b');
  t.textContent = 'Ô xổ xuống (' + rows.length + ') – bạn chọn tay trên trang';
  hop.appendChild(t);
  rows.forEach(function(r) {
    var d = document.createElement('div');
    d.style.cssText = 'border-top:1px solid #e5e7eb;margin-top:8px;padding-top:8px';
    var lb = document.createElement('div');
    lb.textContent = r.nhan;
    lb.style.fontWeight = '700';
    var gy = document.createElement('div');
    gy.textContent = 'Nên chọn: ' + r.goiY + (r.hien ? ' (đang: ' + r.hien + ')' : ' (đang trống)');
    gy.style.color = '#b91c1c';
    var b = document.createElement('button');
    b.textContent = 'Tới ô này';
    b.style.cssText = 'margin-top:4px;padding:4px 10px;border-radius:6px;border:1px solid #9ca3af;background:#fff;cursor:pointer;font-weight:600';
    b.onclick = function() {
      var h = document.querySelector('[formcontrolname="' + r.key + '"]');
      if (!h) return;
      h.scrollIntoView({ block: 'center' });
      var y = h.style.outline;
      h.style.outline = '3px solid #dc2626';
      setTimeout(function() { h.style.outline = y; }, 2500);
      var tc = h.querySelector('vts-select-top-control');
      if (tc) tc.click();
    };
    d.appendChild(lb); d.appendChild(gy); d.appendChild(b);
    hop.appendChild(d);
  });
  var dong = document.createElement('button');
  dong.textContent = 'Đóng (chọn xong thì bấm Lưu trên trang)';
  dong.style.cssText = 'margin-top:10px;width:100%;padding:6px;border-radius:6px;background:#b91c1c;color:#fff;border:none;cursor:pointer;font-weight:700';
  dong.onclick = function() { hop.remove(); };
  hop.appendChild(dong);
  document.body.appendChild(hop);
  return true;
}
async function ghiRaTrang() {
  var sec = secHienTai();
  if (sec.kieu !== 'form') { thongBao('Mục dạng danh sách chưa hỗ trợ ghi ra trang.', 'loi'); return; }
  var nhanCua = {};
  sec.truong.forEach(function(t) { nhanCua[t[0]] = t[1]; });
  var ds = [];
  document.querySelectorAll('#khuMuc input.sua').forEach(function(inp) {
    var v = inp.value.trim();
    if (v === '') return;
    ds.push({ key: inp.dataset.k, kieu: KIEU_TRUONG[inp.dataset.k] || 'text', nhan: nhanCua[inp.dataset.k] || inp.dataset.k, value: v });
  });
  if (!ds.length) { thongBao('Cột Sửa đang trống, không có gì để ghi.', 'loi'); return; }
  try {
    thongBao('Đang ghi ra trang web…', 'ok');
    var tabId = await tabTcxdd();
    var r1 = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: apiGhiTrang, args: [ds] });
    var kq = r1 && r1[0] && r1[0].result;
    if (!kq) throw new Error('Không ghi được vào trang.');
    if (kq.tay.length) await chrome.scripting.executeScript({ target: { tabId: tabId }, func: apiPanelTay, args: [kq.tay] });
    var msg = 'Đã tự điền ' + kq.tu + ' ô text/ngày/radio/check ra trang.';
    if (kq.loi.length) msg += ' Không ghi được (' + kq.loi.length + '): ' + kq.loi.join(', ') + '.';
    if (kq.tay.length) msg += ' Còn ' + kq.tay.length + ' ô xổ xuống trong popup trên trang – bạn chọn tay rồi bấm Lưu trên trang.';
    else msg += ' Bạn kiểm tra rồi bấm Lưu trên trang.';
    thongBao(msg, 'ok');
  } catch (e) { thongBao('Lỗi ghi ra trang: ' + e.message, 'loi'); }
}
function apiMoDong(job) { return window.__dhsMoDong(job.buoc, job.parts); }
async function docDong(secMa, i) {
  var sec = SECS.filter(function(s) { return s.ma === secMa; })[0];
  if (!sec || !CUR) return;
  var rows = giaTriMay(sec);
  var row = rows[i] || {};
  var parts = Object.keys(row).map(function(k) { return row[k]; }).filter(function(v) { return typeof v === 'string' && v.trim() !== ''; }).sort(function(a, b) { return b.length - a.length; }).slice(0, 3);
  if (!parts.length) { thongBao('Dòng trên mây đang trống, không có gì để đối chiếu.', 'loi'); return; }
  try {
    thongBao('Đang mở dòng ' + (i + 1) + ' trên trang để đọc…', 'ok');
    var tabId = await tabTcxdd();
    await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['fields.js', 'fill.js', 'fill_ds.js', 'fill_kt.js', 'auto.js'] });
    var r = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: apiMoDong, args: [{ buoc: secMa, parts: parts }] });
    var kq = r && r[0] && r[0].result;
    if (!kq || !kq.ok) throw new Error(kq ? kq.loi : 'Không đọc được dòng.');
    CUR.trangDong[sec.ma] = CUR.trangDong[sec.ma] || {};
    CUR.trangDong[sec.ma][i] = kq.dong;
    thongBao('Đã đọc dòng ' + (i + 1) + ' từ trang vào cột Trang web.', 'ok');
    veMuc();
  } catch (e) { thongBao('Lỗi đọc dòng: ' + e.message, 'loi'); }
}
$('tai').onclick = taiDuLieu;
$('tim').oninput = veDs;
$('secret').onchange = nhoSecret;
napSecret();
})();
