
const FB_URL = 'https://hung-da4c1-default-rtdb.asia-southeast1.firebasedatabase.app';
let DS = [];          // hồ sơ gộp từ dsHoSo + rasoat
let RS = {};          // rasoat theo id
let KHONG_TRUNG = {}; // nhóm đã đánh dấu "không phải trùng"
let tabHienTai = 'ds', sapXep = { k: 'capNhatMs', xuoi: false }, moId = null;
const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...con) => { const e = document.createElement(tag); Object.assign(e, props); con.forEach((c) => e.append(c)); return e; };
const khongDau = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
const KHOA_LS = { ql_secret: 'fbSecret', ql_nguoi: 'qlNguoi' };
const luuLS = (k, v) => { try { chrome.storage.local.set({ [KHOA_LS[k]]: v }); } catch (e) {} };
$('secret').onchange = () => luuLS('ql_secret', $('secret').value.trim());
$('nguoi').onchange = () => luuLS('ql_nguoi', $('nguoi').value.trim());

function thongBao(t, lop) { $('tb').innerHTML = ''; if (t) $('tb').append(el('div', { className: 'thongbao ' + (lop || 'ok'), textContent: t })); }
function sachChuoiFb(s){var r="";for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c===65534||c===65535||c===127)continue;if(c<32&&c!==9&&c!==10&&c!==13)continue;if(c>=55296&&c<=57343){var hi=c<=56319;var nx=i+1<s.length?s.charCodeAt(i+1):0;var pv=i>0?s.charCodeAt(i-1):0;if((hi&&nx>=56320&&nx<=57343)||(!hi&&pv>=55296&&pv<=56319)){r+=s[i];}continue;}r+=s[i];}return r;}
function sachKhoaFb(k){return sachChuoiFb(String(k)).split(".").join("_").split("$").join("_").split("#").join("_").split("[").join("_").split("]").join("_").split("/").join("_")||"_";}
function sachFb(v){if(v===undefined||v===null)return null;if(typeof v==="string")return sachChuoiFb(v);if(typeof v==="number")return Number.isFinite(v)?v:null;if(typeof v==="boolean")return v;if(Array.isArray(v))return v.map(sachFb);if(typeof v==="object"){var o={};for(var k in v){if(!Object.prototype.hasOwnProperty.call(v,k))continue;var x=v[k];if(x===undefined)continue;o[sachKhoaFb(k)]=sachFb(x);}return o;}return String(v);}
function sachFbRoot(o){if(o===undefined||o===null||typeof o!=="object"||Array.isArray(o))return sachFb(o);var r={};for(var k in o){if(!Object.prototype.hasOwnProperty.call(o,k))continue;r[k]=sachFb(o[k]);}return r;}
async function fb(method, path, body) {
  const secret = $('secret').value.trim();
  if (!secret) throw new Error('Chưa nhập mã bí mật.');
  const r = await fetch(`${FB_URL}/${path}.json?auth=${encodeURIComponent(secret)}`, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(sachFbRoot(body)) });
  const t = await r.text();
  if (!r.ok) { let m = t; try { m = JSON.parse(t).error || t; } catch (e) {} throw new Error(r.status === 401 || /permission|auth/i.test(m) ? 'Sai mã bí mật hoặc không có quyền.' : `Lỗi máy chủ ${r.status}: ${m}`); }
  return t ? JSON.parse(t) : null;
}
// "15:30:12 3/10/2026" (giờ vi-VN) hoặc ISO → mili giây
function msCua(s) {
  if (!s) return 0;
  const m = String(s).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?[ ,]+(\d{1,2})\/(\d{1,2})\/(\d{4})/) || null;
  if (m) return new Date(+m[6], +m[5] - 1, +m[4], +m[1], +m[2], +(m[3] || 0)).getTime();
  const t = Date.parse(s); return isNaN(t) ? 0 : t;
}
const mang = (a) => (Array.isArray(a) ? a : Object.values(a || {})).filter(Boolean);

async function taiDuLieu() {
  $('tai').disabled = true; thongBao('Đang tải…', 'ok');
  try {
    luuLS('ql_secret', $('secret').value.trim());
    const [ds, rs, kt] = await Promise.all([fb('GET', 'dsHoSo'), fb('GET', 'rasoat'), fb('GET', 'quanly/khongTrung').catch(() => null)]);
    RS = rs || {}; KHONG_TRUNG = kt || {};
    DS = Object.entries(ds || {}).map(([id, x]) => {
      const r = RS[id] || {}, mucs = mang(r.dsMuc), xong = r.xong || {};
      const conLai = mucs.filter((_, i) => !xong[i]).length;
      const daNhap = x.trangThai === 'đã nhập tự động' || !!r.daDong;
      const daRaSoat = /đã rà soát/i.test(r.trangThai || '');
      return { id, ten: x.ten || r.ten || '', cccd: x.cccd || r.cccd || '', ngaySinh: x.ngaySinh || '', nguoiNhap: x.nguoiNhap || '', capNhat: x.capNhat || '', capNhatMs: msCua(x.capNhat),
        vietTay: !!x.vietTay, soCT: x.soCongTac || 0, soNT: x.soNguoiThan || 0, mucs, xong, conLai, coRs: !!r.dsMuc,
        tt: daRaSoat ? 'xong' : daNhap ? 'tu' : 'chua', nguoiRaSoat: r.nguoiRaSoat || '', raSoatLuc: r.raSoatLuc || '', thongKe: r.thongKe || x.thongKeRaSoat || null };
    });
    // Hồ sơ có trong rasoat nhưng không còn trong dsHoSo: bỏ qua
    const ng = [...new Set(DS.map((d) => d.nguoiNhap).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
    const giu = $('loNguoi').value;
    $('loNguoi').innerHTML = '<option value="">Mọi người nhập</option>'; ng.forEach((n) => $('loNguoi').append(el('option', { value: n, textContent: n }))); $('loNguoi').value = giu;
    $('lanTai').textContent = 'Tải lúc ' + new Date().toLocaleTimeString('vi-VN');
    thongBao(`Đã tải ${DS.length} hồ sơ.`, 'ok');
    ve();
  } catch (e) { thongBao('Lỗi: ' + e.message, 'loi'); }
  finally { $('tai').disabled = false; }
}
$('tai').onclick = taiDuLieu;

// ---------- Tìm hồ sơ trùng ----------
function timTrung() {
  const nhom = [], dung = new Set();
  const them = (loai, khoa, ds) => {
    if (ds.length < 2) return;
    const ids = ds.map((d) => d.id).sort();
    if (ids.every((i) => dung.has(i))) return; // đã nằm trong nhóm mạnh hơn
    ids.forEach((i) => dung.add(i));
    nhom.push({ loai, khoa: loai + ':' + khoa, ds });
  };
  const theo = (f) => { const m = new Map(); DS.forEach((d) => { const k = f(d); if (k) (m.get(k) || m.set(k, []).get(k)).push(d); }); return m; };
  for (const [k, ds] of theo((d) => (/^\d{12}$/.test(String(d.cccd).replace(/\D/g, '')) ? String(d.cccd).replace(/\D/g, '') : ''))) them('Trùng số căn cước', k, ds);
  for (const [k, ds] of theo((d) => (d.ten && d.ngaySinh ? khongDau(d.ten) + '|' + d.ngaySinh : ''))) them('Trùng họ tên + ngày sinh', k, ds);
  for (const [k, ds] of theo((d) => (d.ten ? khongDau(d.ten) : ''))) them('Trùng họ tên (cần kiểm tra)', k, ds);
  nhom.forEach((g) => { g.bo = !!KHONG_TRUNG[g.khoa.replace(/[.#$\[\]/]/g, '_')]; });
  return nhom;
}
// Bản nên giữ: đã nhập tự động > nhiều dữ liệu hơn > cập nhật gần nhất
function nenGiu(ds) {
  return [...ds].sort((a, b) => (b.tt !== 'chua') - (a.tt !== 'chua') || (b.soCT + b.soNT) - (a.soCT + a.soNT) || b.capNhatMs - a.capNhatMs)[0];
}

// ---------- Vẽ giao diện ----------
const NHAN_TT = { chua: ['Chưa nhập', 'chua'], tu: ['Đã nhập tự động – chờ rà soát', 'tu'], xong: ['Đã rà soát', 'xong'] };
function locDs() {
  const q = khongDau($('tim').value), tt = $('loTT').value, ng = $('loNguoi').value, tay = $('loTay').checked, con = $('loCon').checked;
  let ds = DS.filter((d) => (!q || khongDau(`${d.ten} ${d.cccd} ${d.id} ${d.nguoiNhap}`).includes(q)) && (!tt || d.tt === tt) && (!ng || d.nguoiNhap === ng) && (!tay || d.vietTay) && (!con || d.conLai > 0));
  if (tabHienTai === 'rs') ds = ds.filter((d) => d.coRs && d.conLai > 0 && d.tt !== 'xong');
  if (tabHienTai === 'nhap') ds = ds.filter((d) => d.tt !== 'chua');
  const { k, xuoi } = sapXep, h = xuoi ? 1 : -1;
  return ds.sort((a, b) => (typeof a[k] === 'string' ? a[k].localeCompare(b[k], 'vi') : a[k] - b[k]) * h);
}
function ve() {
  const trung = timTrung(), trungConLai = trung.filter((g) => !g.bo);
  $('slTrung').textContent = trungConLai.length ? `(${trungConLai.length})` : '';
  const tongMuc = DS.reduce((s, d) => s + d.conLai, 0);
  const o = (so, nhan, lop = '') => el('div', { className: 'o ' + lop }, el('b', { textContent: String(so) }), el('span', { textContent: nhan }));
  $('tong').innerHTML = '';
  $('tong').append(o(DS.length, 'Tổng số hồ sơ'), o(DS.filter((d) => d.tt === 'chua').length, 'Chưa nhập'),
    o(DS.filter((d) => d.tt === 'tu').length, 'Đã nhập tự động – chờ rà soát', 'can'), o(DS.filter((d) => d.tt === 'xong').length, 'Đã rà soát xong', 'tot'),
    o(tongMuc, 'Mục còn cần rà soát', 'can'), o(DS.filter((d) => d.vietTay).length, 'Văn bản viết tay'), o(trungConLai.length, 'Nhóm hồ sơ trùng', 'can'));
  $('locKhu').hidden = tabHienTai === 'trung';
  $('khuDs').hidden = tabHienTai === 'trung'; $('khuTrung').hidden = tabHienTai !== 'trung';
  if (tabHienTai === 'trung') veTrung(trung); else veDs();
}
function veThongKeNhap(box, ds) {
  const xong = ds.filter((d) => d.tt === 'xong').length, tu = ds.filter((d) => d.tt === 'tu').length;
  const theoNguoi = {};
  ds.forEach((d) => { const n = d.nguoiNhap || '(chưa rõ)'; theoNguoi[n] = (theoNguoi[n] || 0) + 1; });
  const o = (so, nhan) => el('div', { className: 'o' }, el('b', { textContent: String(so) }), el('span', { textContent: nhan }));
  const kh = el('div', { className: 'tong', style: 'margin:6px 0' }, o(ds.length, 'Tổng đã nhập'), o(tu, 'Đã nhập tự động – chờ rà soát'), o(xong, 'Đã rà soát xong'), o(DS.filter((d) => d.tt === 'chua').length, 'Chưa nhập (còn lại)'));
  box.append(kh, el('div', { className: 'mo', textContent: 'Theo người nhập: ' + (Object.entries(theoNguoi).map(([n, c]) => `${n}: ${c}`).join(' · ') || '—') }));
}
function veDs() {
  const box = $('khuDs'); box.innerHTML = '';
  const ds = locDs();
  const cot = [['ten', 'Họ và tên'], ['cccd', 'CCCD / mã'], ['ngaySinh', 'Ngày sinh'], ['nguoiNhap', 'Người nhập'], ['capNhatMs', 'Cập nhật'], ['tt', 'Trạng thái'], ['conLai', 'Cần rà soát']];
  const tb = el('table'), tr = el('tr');
  cot.forEach(([k, t]) => tr.append(el('th', { textContent: t + (sapXep.k === k ? (sapXep.xuoi ? ' ▲' : ' ▼') : ''), onclick: () => { sapXep = { k, xuoi: sapXep.k === k ? !sapXep.xuoi : true }; ve(); } })));
  tb.append(el('thead', {}, tr));
  const body = el('tbody');
  ds.forEach((d) => {
    const [ntt, lop] = NHAN_TT[d.tt];
    const r = el('tr', { className: 'hs', onclick: () => { moId = moId === d.id ? null : d.id; ve(); } });
    const tenO = el('td', {}, el('b', { textContent: d.ten || '(chưa có họ tên)' }));
    if (d.vietTay) tenO.append(' ', el('span', { className: 'nhan tay', textContent: '✍ viết tay' }));
    const tk = d.coRs ? `${d.conLai}/${d.mucs.length} mục` : (d.tt === 'chua' ? '—' : 'chưa có danh sách');
    r.append(tenO, el('td', { textContent: d.cccd || d.id }), el('td', { textContent: d.ngaySinh }), el('td', { textContent: d.nguoiNhap }), el('td', { textContent: d.capNhat }),
      el('td', {}, el('span', { className: 'nhan ' + lop, textContent: ntt })), el('td', { textContent: tk }));
    body.append(r);
    if (moId === d.id) body.append(chiTiet(d, cot.length));
  });
  if (!ds.length) body.append(el('tr', {}, el('td', { colSpan: cot.length, className: 'mo', textContent: DS.length ? 'Không có hồ sơ phù hợp bộ lọc.' : 'Chưa có dữ liệu. Nhập mã bí mật rồi bấm Tải dữ liệu.' })));
  tb.append(body);
  if (tabHienTai === 'nhap') veThongKeNhap(box, ds);
  box.append(el('div', { className: 'mo', textContent: `Hiển thị ${ds.length}/${DS.length} hồ sơ` }), tb);
}
const CLASS_LOAI = (l) => (/mặc định|xem lại|Giữ dữ liệu cũ/i.test(l) ? 'md' : /Chưa|lỗi|Mục chưa/i.test(l) ? 'loi' : '');
// Hiện lại hồ sơ lên đám mây: gỡ trạng thái đã nhập/đã rà soát để nạp lại, rà soát lại (dữ liệu giữ nguyên)
async function hienLai(d, nut) {
  if (!confirm(`Hiện hồ sơ "${d.ten}" (${d.cccd || d.id}) lên đám mây để rà soát lại?\n\n- Gỡ trạng thái "đã nhập/đã rà soát"\n- Dữ liệu hồ sơ giữ nguyên`)) return;
  nut.disabled = true;
  try {
    await fb('PATCH', 'dsHoSo/' + encodeURIComponent(d.id), { trangThai: null });
    if (RS[d.id]) { await fb('PATCH', 'rasoat/' + encodeURIComponent(d.id), { trangThai: 'chờ rà soát lại' }); RS[d.id].trangThai = 'chờ rà soát lại'; }
    const x = DS.find((y) => y.id === d.id);
    if (x) x.tt = /đã rà soát/i.test((RS[d.id] || {}).trangThai || '') ? 'xong' : 'chua';
    thongBao(`Đã hiện lại hồ sơ "${d.ten}". Hồ sơ đã về trạng thái chưa nhập, nạp lại được từ tiện ích.`, 'ok');
    ve();
  } catch (e) { nut.disabled = false; thongBao('Không ghi được: ' + e.message, 'loi'); }
}
function chiTiet(d, soCot) {
  const td = el('td', { colSpan: soCot });
  td.onclick = (e) => e.stopPropagation();
  td.append(el('div', {}, el('b', { textContent: `${d.ten} · ${d.cccd || d.id}` }), ` · ${d.soCT} dòng công tác · ${d.soNT} người thân · mã ${d.id}`));
  if (d.tt !== 'chua') td.append(el('div', { className: 'hang', style: 'margin:6px 0' },
    el('button', { className: 'nho', textContent: '👁 Hiện lại lên đám mây (rà soát lại)', title: 'Gỡ trạng thái đã nhập/đã rà soát để hồ sơ hiện lại trong danh sách nạp. Dữ liệu hồ sơ giữ nguyên.', onclick: (e) => hienLai(d, e.target) })));
  if (d.tt === 'xong') td.append(el('div', { className: 'mo', textContent: `Đã rà soát bởi ${d.nguoiRaSoat || '?'} lúc ${d.raSoatLuc || '?'}` }));
  if (!d.coRs) td.append(el('div', { className: 'mo', textContent: 'Hồ sơ này chưa chạy tự động nên chưa có danh sách rà soát.' }));
  const soMuc = (t) => { const m = String(t).match(/^B(\d+)/); return m ? Number(m[1]) : 99; };
  const nhom = new Map();
  d.mucs.forEach((m, i) => {
    const g = nhom.get(m.muc) || nhom.set(m.muc, new Map()).get(m.muc);
    const r = g.get(m.truong) || g.set(m.truong, { truong: m.truong, loai: [], giaTri: '', ghiChu: [], idx: [] }).get(m.truong);
    if (!r.loai.includes(m.loai)) r.loai.push(m.loai);
    if (m.giaTri && !r.giaTri) r.giaTri = m.giaTri;
    if (m.ghiChu && !r.ghiChu.includes(m.ghiChu)) r.ghiChu.push(m.ghiChu);
    r.idx.push(i);
  });
  [...nhom.entries()].sort((a, b) => soMuc(a[0]) - soMuc(b[0])).forEach(([muc, g]) => {
    const rows = [...g.values()], so = rows.filter((r) => r.idx.some((i) => !d.xong[i])).length;
    const mg = el('details', { open: so > 0, style: 'margin:6px 0' }, el('summary', { style: 'font-weight:700;cursor:pointer' }, `${muc} (${so}/${rows.length})`));
    rows.forEach((r) => {
      const da = r.idx.every((i) => d.xong[i]);
      const cb = el('input', { type: 'checkbox', checked: da, title: 'Đã xử lý' });
      cb.onchange = async () => {
        try {
          const o = {}; r.idx.forEach((i) => (o[i] = cb.checked ? { nguoi: $('nguoi').value.trim() || '?', luc: new Date().toLocaleString('vi-VN') } : null));
          await fb('PATCH', `rasoat/${encodeURIComponent(d.id)}/xong`, o);
          r.idx.forEach((i) => { if (cb.checked) d.xong[i] = true; else delete d.xong[i]; });
          d.conLai = d.mucs.filter((_, j) => !d.xong[j]).length; ve();
        } catch (e) { cb.checked = !cb.checked; thongBao('Không ghi được: ' + e.message, 'loi'); }
      };
      mg.append(el('div', { className: 'muc' + (da ? ' da' : '') }, cb, el('div', {},
        ...r.loai.map((l) => el('span', { className: 'loai ' + CLASS_LOAI(l), textContent: l, style: 'margin-right:4px' })), ' ', el('b', { textContent: r.truong }),
        el('small', { textContent: `${r.giaTri ? 'Giá trị đã điền: ' + r.giaTri + ' · ' : ''}${r.ghiChu.join(' · ')}` }))));
    });
    td.append(mg);
  });
  const nut = el('div', { className: 'hang', style: 'margin-top:8px' });
  if (d.coRs) {
    if (d.tt === 'xong') nut.append(el('button', { textContent: '↺ Mở lại để rà soát', onclick: () => datTT(d, 'đã nhập tự động – chờ rà soát') }));
    else nut.append(el('button', { className: 'xanh', textContent: '✔ Đánh dấu đã rà soát xong', onclick: () => { if (d.conLai && !confirm(`Còn ${d.conLai} mục chưa tick. Vẫn đánh dấu đã rà soát xong?`)) return; datTT(d, 'đã rà soát'); } }));
    nut.append(el('button', { textContent: '⬇ Xuất mục rà soát (CSV)', onclick: () => csvMuc([d]) }));
  }
  nut.append(el('button', { className: 'xoa', style: 'color:#b91c1c;border-color:#b91c1c', textContent: '🗑 Xóa hồ sơ này', onclick: () => xoaHoSo(d) }));
  td.append(nut);
  return el('tr', { className: 'ct' }, td);
}
async function datTT(d, tt) {
  try {
    const x = { trangThai: tt };
    if (tt === 'đã rà soát') { x.nguoiRaSoat = $('nguoi').value.trim() || '?'; x.raSoatLuc = new Date().toLocaleString('vi-VN'); }
    await fb('PATCH', `rasoat/${encodeURIComponent(d.id)}`, x);
    d.tt = tt === 'đã rà soát' ? 'xong' : 'tu'; d.nguoiRaSoat = x.nguoiRaSoat || ''; d.raSoatLuc = x.raSoatLuc || '';
    thongBao(`Đã cập nhật trạng thái hồ sơ ${d.ten}.`, 'ok'); ve();
  } catch (e) { thongBao('Không ghi được: ' + e.message, 'loi'); }
}

// ---------- Hồ sơ trùng ----------
function veTrung(nhom) {
  const box = $('khuTrung'); box.innerHTML = '';
  const hien = nhom.filter((g) => !g.bo), bo = nhom.filter((g) => g.bo);
  box.append(el('div', { className: 'the' }, 'Tiêu chí: trùng số căn cước 12 số; trùng họ tên + ngày sinh; trùng họ tên (chỉ để kiểm tra, có thể là hai người khác nhau). ',
    'Bản đề xuất giữ: đã nhập tự động trước, rồi bản có nhiều dữ liệu hơn, rồi bản cập nhật gần nhất. Xóa là xóa vĩnh viễn trên đám mây.'));
  if (!hien.length) box.append(el('div', { className: 'thongbao ok', textContent: DS.length ? 'Không có nhóm hồ sơ trùng nào cần xử lý.' : 'Chưa có dữ liệu.' }));
  hien.forEach((g) => box.append(veNhom(g)));
  if (bo.length) {
    const sec = el('details', {}, el('summary', { textContent: `${bo.length} nhóm đã đánh dấu "không phải trùng"` }));
    bo.forEach((g) => sec.append(veNhom(g)));
    box.append(sec);
  }
}
function veNhom(g) {
  const giu = nenGiu(g.ds);
  const sec = el('div', { className: 'nhom' + (g.bo ? ' bo' : '') }, el('h3', { textContent: `${g.loai} – ${g.ds[0].ten} (${g.ds.length} bản)` }));
  const tb = el('table'), tr = el('tr');
  ['Giữ', 'Mã', 'Họ và tên', 'CCCD', 'Ngày sinh', 'Công tác / Người thân', 'Người nhập', 'Cập nhật', 'Trạng thái'].forEach((t) => tr.append(el('th', { textContent: t })));
  tb.append(el('thead', {}, tr));
  const body = el('tbody'), chon = { id: giu.id };
  g.ds.forEach((d) => {
    const rd = el('input', { type: 'radio', name: 'giu_' + g.khoa, checked: d.id === giu.id, onchange: () => (chon.id = d.id) });
    body.append(el('tr', {}, el('td', {}, rd), el('td', { textContent: d.id }), el('td', { textContent: d.ten }), el('td', { textContent: d.cccd }), el('td', { textContent: d.ngaySinh }),
      el('td', { textContent: `${d.soCT} / ${d.soNT}` }), el('td', { textContent: d.nguoiNhap }), el('td', { textContent: d.capNhat }), el('td', {}, el('span', { className: 'nhan ' + NHAN_TT[d.tt][1], textContent: NHAN_TT[d.tt][0] }))));
  });
  tb.append(body); sec.append(tb);
  const nut = el('div', { className: 'hang', style: 'padding:8px 12px' });
  nut.append(el('button', { className: 'chinh', textContent: 'Giữ bản đã chọn, xóa các bản còn lại', onclick: () => xoaTrung(g, chon.id) }));
  nut.append(el('button', { textContent: g.bo ? 'Đánh dấu lại là trùng' : 'Không phải trùng', onclick: () => datKhongTrung(g, !g.bo) }));
  sec.append(nut);
  return sec;
}
const khoaFb = (k) => k.replace(/[.#$\[\]/]/g, '_');
async function datKhongTrung(g, v) {
  try { await fb('PATCH', 'quanly/khongTrung', { [khoaFb(g.khoa)]: v ? { nguoi: $('nguoi').value.trim() || '?', luc: new Date().toLocaleString('vi-VN') } : null }); if (v) KHONG_TRUNG[khoaFb(g.khoa)] = true; else delete KHONG_TRUNG[khoaFb(g.khoa)]; ve(); }
  catch (e) { thongBao('Không ghi được: ' + e.message, 'loi'); }
}
async function xoaHoSo(d) {
  if (!confirm(`XÓA VĨNH VIỄN hồ sơ:\n• ${d.ten || '(chưa có họ tên)'} (CCCD/mã ${d.cccd || d.id}, ${d.nguoiNhap || '?'}, ${d.capNhat || '?'})\n\nXóa dữ liệu hồ sơ, danh sách rà soát và mục trong danh sách trên đám mây. Không khôi phục được.\n\nTiếp tục?`)) return;
  if (!confirm(`Xác nhận lần cuối: xóa hồ sơ "${d.ten || d.id}"?`)) return;
  try {
    const i = encodeURIComponent(d.id);
    await fb('PATCH', '', { ['dsHoSo/' + i]: null, ['hoso/' + i]: null, ['rasoat/' + i]: null });
    DS = DS.filter((x) => x.id !== d.id);
    if (moId === d.id) moId = null;
    thongBao(`Đã xóa hồ sơ ${d.ten || d.id}.`, 'ok'); ve();
  } catch (e) { thongBao('Không xóa được: ' + e.message, 'loi'); }
}
async function xoaTrung(g, giuId) {
  const xoa = g.ds.filter((d) => d.id !== giuId);
  if (!xoa.length) return;
  const giu = g.ds.find((d) => d.id === giuId);
  if (!confirm(`GIỮ: ${giu.ten} (mã ${giu.id})\n\nXÓA VĨNH VIỄN ${xoa.length} bản:\n` + xoa.map((d) => `• ${d.ten} (mã ${d.id}, ${d.nguoiNhap || '?'}, ${d.capNhat || '?'})`).join('\n') + '\n\nTiếp tục?')) return;
  try {
    const pt = {};
    xoa.forEach((d) => { const i = encodeURIComponent(d.id); pt['dsHoSo/' + i] = null; pt['hoso/' + i] = null; pt['rasoat/' + i] = null; });
    await fb('PATCH', '', pt);
    DS = DS.filter((d) => !xoa.some((x) => x.id === d.id));
    thongBao(`Đã xóa ${xoa.length} bản trùng, giữ lại ${giu.ten} (mã ${giu.id}).`, 'ok'); ve();
  } catch (e) { thongBao('Không xóa được: ' + e.message, 'loi'); }
}

// ---------- Xuất CSV ----------
function taiCsv(ten, dong) {
  const o = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const blob = new Blob(['\ufeff' + dong.map((r) => r.map(o).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = el('a', { href: URL.createObjectURL(blob), download: ten }); a.click();
}
const TT_TXT = { chua: 'Chưa nhập', tu: 'Đã nhập tự động – chờ rà soát', xong: 'Đã rà soát' };
$('xuatDs').onclick = () => {
  const ds = locDs();
  taiCsv('danh_sach_ho_so.csv', [['Họ và tên', 'CCCD', 'Mã', 'Ngày sinh', 'Người nhập', 'Cập nhật', 'Trạng thái', 'Viết tay', 'Mục cần rà soát còn lại', 'Tổng mục rà soát'],
    ...ds.map((d) => [d.ten, d.cccd, d.id, d.ngaySinh, d.nguoiNhap, d.capNhat, TT_TXT[d.tt], d.vietTay ? 'Có' : '', d.conLai, d.mucs.length])]);
};
function csvMuc(ds) {
  const dong = [['Họ và tên', 'CCCD', 'Mục', 'Trường', 'Loại', 'Giá trị đã điền', 'Ghi chú', 'Đã xử lý']];
  ds.forEach((d) => d.mucs.forEach((m, i) => dong.push([d.ten, d.cccd || d.id, m.muc, m.truong, m.loai, m.giaTri, m.ghiChu, d.xong[i] ? 'x' : ''])));
  taiCsv('muc_ra_soat.csv', dong);
}
$('xuatMuc').onclick = () => csvMuc(locDs().filter((d) => d.coRs));

document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => { tabHienTai = b.dataset.tab; document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); ve(); }));
['tim', 'loTT', 'loNguoi', 'loTay', 'loCon'].forEach((i) => ($(i).oninput = $(i).onchange = ve));
chrome.storage.local.get(['fbSecret', 'qlNguoi'], (s) => { $('secret').value = s.fbSecret || 'uPjRMZvtogiFls0X2n71sd5o098RcsPdVfxjPUBm'; $('nguoi').value = s.qlNguoi || ''; if ($('secret').value) taiDuLieu(); else ve(); });
