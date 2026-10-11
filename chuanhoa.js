// Trang xem toàn bộ dữ liệu đám mây + chuẩn hóa Tỉnh/Xã (v0.8.9.5).
// Nguyên tắc: KHÔNG tự ghi lên đám mây. Chuẩn hóa ra bảng đối chiếu, người dùng xem rồi mới bấm Ghi.
(() => {
  "use strict";
  window.addEventListener("error", (e) => {
    try {
      const b = document.getElementById("tb");
      if (b) { b.innerHTML = ""; const d = document.createElement("div"); d.className = "thongbao loi"; d.textContent = "Lỗi trang: " + (e.message || e.error); b.append(d); }
    } catch (x) {}
  });
  const FB_URL = "https://hung-da4c1-default-rtdb.asia-southeast1.firebasedatabase.app";
  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...con) => { const e = document.createElement(tag); Object.assign(e, props); con.forEach((c) => e.append(c)); return e; };

  // ---------- Chuẩn hóa chữ ----------
  const kd = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
  const sach = (s) => String(s == null ? "" : s).normalize("NFC").replace(/[\u2018\u2019\u201c\u201d]/g, "'").replace(/[\u200b-\u200d\ufeff]/g, "").replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
  const HOA = (s) => s.replace(/\p{Lu}/gu, (c) => c.toLowerCase()).replace(/\p{Ll}/gu, (c) => c.toUpperCase());
const vietTieuDe = (s) => sach(s).toLowerCase().replace(/\p{L}/gu, (c, i, str) => (i === 0 || /[\s(\-']/.test(str[i - 1])) ? c.toUpperCase() : c);
  // Sửa chính tả tiền tố mà không đụng phần còn lại: "Xa Mu A" -> "Xã Mu A" (sau đó từ điển lo phần tên)
  const suaTienTo = (v) => {
    const s = sach(v), m = s.match(/^(\S+)\s+(\S.*)$/);
    if (!m) return "";
    const sua = CHINH_TA_TIEN_TO[kd(m[1]) + " "];
    return sua ? sua + m[2] : "";
  };

  // Tiền tố hành chính: dùng để nhận ra giá trị đã đúng chuẩn và để học từ điển từ dữ liệu sẵn có
  const TIEN_TO = ["Tỉnh", "Thành phố", "Xã", "Phường", "Thị trấn", "Đặc khu"];
  const CHINH_TA_TIEN_TO = { "tinh ": "Tỉnh ", "thanh pho ": "Thành phố ", "xa ": "Xã ", "phuong ": "Phường ", "thi tran ": "Thị trấn ", "dac khu ": "Đặc khu ", "tp ": "Thành phố ", "thp ": "Thành phố " };
  const tachTienTo = (v) => {
    const s = sach(v);
    for (const t of TIEN_TO) if (kd(s).startsWith(kd(t) + " ")) return { tienTo: t, ten: s.slice(t.length).trim() };
    return { tienTo: "", ten: s };
  };

  // Khoảng cách Levenshtein chuẩn hóa 0..1 – dùng để đo "gần chính xác"
  function giaDong(a, b) {
    a = kd(a); b = kd(b);
    if (a === b) return 1;
    if (!a.length || !b.length) return 0;
    const n = a.length, m = b.length;
    if (Math.abs(n - m) / Math.max(n, m) > 0.6) return 0;
    let p = new Array(m + 1), c = new Array(m + 1);
    for (let j = 0; j <= m; j++) p[j] = j;
    for (let i = 1; i <= n; i++) {
      c[0] = i;
      for (let j = 1; j <= m; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      [p, c] = [c, p];
    }
    return 1 - p[m] / Math.max(n, m);
  }

  // ---------- Các nhóm Tỉnh/Xã trong hồ sơ ----------
  const NHOM = [
    { ten: "05) Nơi khai sinh", tinh: "birthProvinceId", xa: "birthCommuneId" },
    { ten: "06) Quê quán", tinh: "hometownProvinceId", xa: "hometownCommuneId" },
    { ten: "07) Nơi thường trú", tinh: "residentProvinceId", xa: "residentCommuneId" },
    { ten: "Tạm trú", tinh: "residentTempProvinceId", xa: "residentTempCommuneId" },
    { ten: "Nơi ở hiện nay", tinh: "currentResidentProvinceId", xa: "currentResidentCommuneId" },
  ];
  const KHOA_DM = NHOM.flatMap((n) => [n.tinh, n.xa]);
  const LA_TINH = (k) => /ProvinceId$/.test(k);

  // ---------- Firebase ----------
  const MA_MAC_DINH = "uPjRMZvtogiFls0X2n71sd5o098RcsPdVfxjPUBm";
  const CO_CHROME = typeof chrome !== "undefined" && !!(chrome.storage && chrome.storage.local);
  // Đọc/ghi: trong tiện ích dùng chrome.storage, mở file trực tiếp thì dùng localStorage
  const KHO = {
    async get(k) {
      if (CO_CHROME) { try { return (await chrome.storage.local.get(k))[k]; } catch (e) {} }
      try { const v = localStorage.getItem("ch_" + k); return v == null ? undefined : JSON.parse(v); } catch (e) { return undefined; }
    },
    async set(kv) {
      if (CO_CHROME) { try { await chrome.storage.local.set(kv); return; } catch (e) {} }
      try { for (const [kk, vv] of Object.entries(kv)) localStorage.setItem("ch_" + kk, JSON.stringify(vv)); } catch (e) {}
    },
  };
  function sachChuoiFb(s){var r="";for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c===65534||c===65535||c===127)continue;if(c<32&&c!==9&&c!==10&&c!==13)continue;if(c>=55296&&c<=57343){var hi=c<=56319;var nx=i+1<s.length?s.charCodeAt(i+1):0;var pv=i>0?s.charCodeAt(i-1):0;if((hi&&nx>=56320&&nx<=57343)||(!hi&&pv>=55296&&pv<=56319)){r+=s[i];}continue;}r+=s[i];}return r;}
  function sachKhoaFb(k){return sachChuoiFb(String(k)).split(".").join("_").split("$").join("_").split("#").join("_").split("[").join("_").split("]").join("_").split("/").join("_")||"_";}
  function sachFb(v){if(v===undefined||v===null)return null;if(typeof v==="string")return sachChuoiFb(v);if(typeof v==="number")return Number.isFinite(v)?v:null;if(typeof v==="boolean")return v;if(Array.isArray(v))return v.map(sachFb);if(typeof v==="object"){var o={};for(var k in v){if(!Object.prototype.hasOwnProperty.call(v,k))continue;var x=v[k];if(x===undefined)continue;o[sachKhoaFb(k)]=sachFb(x);}return o;}return String(v);}
  function sachFbRoot(o){if(o===undefined||o===null||typeof o!=="object"||Array.isArray(o))return sachFb(o);var r={};for(var k in o){if(!Object.prototype.hasOwnProperty.call(o,k))continue;r[k]=sachFb(o[k]);}return r;}
  async function fb(method, path, body) {
    const secret = $("secret").value.trim();
    if (!secret) throw new Error("Chưa nhập mã bí mật cơ sở dữ liệu.");
    const url = (path ? `${FB_URL}/${path}.json` : `${FB_URL}/.json`) + `?auth=${encodeURIComponent(secret)}` + (method === "GET" && !path ? "&shallow=true" : "");
    const r = await fetch(url,
      { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(sachFbRoot(body)) });
    const t = await r.text();
    if (!r.ok) { let m = t; try { m = JSON.parse(t).error || t; } catch (e) {} throw new Error(r.status === 401 || /permission|auth/i.test(m) ? "Sai mã bí mật hoặc không có quyền." : `Lỗi ${r.status}: ${m}`); }
    return t ? JSON.parse(t) : null;
  }
  $("secret").value = MA_MAC_DINH;
  KHO.get("fbSecret").then((v) => { if (v) $("secret").value = v; });
  $("secret").onchange = () => KHO.set({ fbSecret: $("secret").value.trim() });

  function thongBao(t, lop) { $("tb").innerHTML = ""; if (t) $("tb").append(el("div", { className: "thongbao " + (lop || "ok"), textContent: t })); }

  // ---------- Từ điển (người dùng/AI xác nhận) ----------
  const KHOA_TUDIEN = "fbChuanHoa";
  let TUDIEN = { tinh: {}, xa: {} };   // kd(giá trị gốc) -> giá trị chuẩn
  let HOC = { tinh: {}, xa: {} };      // tự học từ dữ liệu sẵn có (không lưu)
  let DS = [];                         // hồ sơ đầy đủ
  let SOI = {};                        // id -> thay đổi chờ ghi {key: giá trị mới}
  let tabHienTai = "tx", loc = { q: "", k: "" };

  const docTudien = async () => {
    const t = (await KHO.get(KHOA_TUDIEN)) || {};
    TUDIEN = { tinh: t.tinh || {}, xa: t.xa || {} };
  };
  const ghiTudien = () => KHO.set({ [KHOA_TUDIEN]: TUDIEN }).catch(() => {});
  const loaiCua = (k) => (LA_TINH(k) ? "tinh" : "xa");
  const timTuDien = (loai, gt) => {
    const key = kd(gt), v = TUDIEN[loai][key] || HOC[loai][key] || "";
    if (!v) return "";
    // cùng khóa sau khi bỏ dấu nhưng khác dấu thật ("Xã Mậu Â" vs "Xã Mậu A") thì không chấp nhận ngay
    const ttV = tachTienTo(v), ttG = tachTienTo(sach(gt));
    return ttV.ten.toLowerCase() === ttG.ten.toLowerCase() ? v : "";
  };
  // tra từ điển theo tên đã bỏ tiền tố; phải khớp cả dấu để không nhầm "Mậu Â" với "Mậu A"
  const timTheoTen = (loai, ten) => {
    const g = String(ten).toLowerCase();
    for (const nguon of [TUDIEN[loai], HOC[loai]]) {
      const hit = Object.values(nguon).find((v) => { const t = tachTienTo(v); return t.tienTo && t.ten.toLowerCase() === g; });
      if (hit) return hit;
    }
    return "";
  };
  const datTuDien = (loai, gt, chuan) => { TUDIEN[loai][kd(gt)] = chuan; ghiTudien(); };

  // ---------- Chuẩn hóa ----------
  // trả { gt, nhan, muc } – muc: "chinh" (chắc chắn) | "goiy" | "nghi" | ""
  function chuanHoa(gt, k) {
    const loai = loaiCua(k);
    const g0 = sach(gt);
    if (!g0) return { gt: "", nhan: "Ô trống – không có dữ liệu để chuẩn hóa", muc: "" };
    const { tienTo, ten } = tachTienTo(g0);
    let out = g0, nhan = "", muc = "";

    // 1) Lỗi chính tả tiền tố: "Xa Mu A" -> "Xã Mậu A" (giữ nguyên phần còn lại)
    const sua = suaTienTo(g0);
    if (sua && sua !== g0) { out = sua; muc = "chinh"; nhan = "sửa chính tả tiền tố"; }
    // 2) Viết HOA TOÀN BỘ: "TỈNH LÀO CAI" -> "Tỉnh Lào Cai"
    else if (g0 === HOA(g0)) { out = vietTieuDe(g0); muc = "chinh"; nhan = "viết hoa toàn bộ"; }

    // 3) Tra từ điển (đúng chính tả, hoặc khớp bỏ tiền tố)
    const td = timTuDien(loai, g0) || (ten ? timTheoTen(loai, ten) : "");
    if (td && sach(td) !== out) {
      const ttD = tachTienTo(sach(td));
      if (tienTo && ttD.tienTo && tienTo !== ttD.tienTo) return { gt: g0, nhan: `xung đột tiền tố: dữ liệu “${tienTo}” ≠ từ điển “${ttD.tienTo}” – cần xem tay`, muc: "nghi" };
      out = sach(td); muc = "chinh"; nhan = "theo từ điển đã xác nhận";
    }

    // 4) Gần chính xác: so tên đã bỏ tiền tố với tên chuẩn trong từ điển (kể cả chỉ khác dấu)
    if (!td && ten) {
      const nguon = { ...HOC[loai], ...TUDIEN[loai] };
      const ds = Object.values(nguon).map((v) => {
        const t = tachTienTo(v);
        return [v, giaDong(ten, t.tienTo ? t.ten : v)];
      }).filter((x) => x[1] >= 0.78).sort((a, b) => b[1] - a[1]);
      const ung = [];
      for (const [v, d] of ds) if (!ung.some((u) => u[0] === v)) ung.push([v, d]);
      if (ung.length && (ung.length === 1 || ung[0][1] - ung[1][1] >= 0.05)) {
        const ttU = tachTienTo(sach(ung[0][0]));
        if (tienTo && ttU.tienTo && tienTo !== ttU.tienTo) return { gt: g0, nhan: `xung đột tiền tố: dữ liệu “${tienTo}” ≠ gợi ý “${ttU.tienTo}” – cần xem tay`, muc: "nghi" };
        out = sach(ung[0][0]); muc = "goiy";
        nhan = ung[0][1] >= 0.995 ? `khác mỗi dấu với “${ung[0][0]}”` : `gần giống “${ung[0][0]}” (${Math.round(ung[0][1] * 100)}%)`;
      }
    }

    // 5) Còn lại: giá trị đã có tiền tố hành chính đầy đủ thì coi là đúng chuẩn, ngược lại đánh dấu AI nghi ngờ
    if (!muc) {
      if (!ten) return { gt: g0, nhan: "không có tên (chỉ có tiền tố?)", muc: "nghi" };
      if (tienTo) return { gt: g0, nhan: `đã có tiền tố “${tienTo}” nhưng chưa có trong từ điển – nên xác nhận 1 lần`, muc: "" };
      if (loai === "xa") return { gt: g0, nhan: `thiếu/chưa có tiền tố Xã–Phường–Thị trấn (đang là “${g0}”)`, muc: "nghi" };
      return { gt: g0, nhan: `chưa có tiền tố tỉnh/thành phố (đang là “${g0}”)`, muc: "nghi" };
    }
    return { gt: out, nhan, muc };
  }

  // Tự học: giá trị đã có tiền tố đúng trong dữ liệu = chuẩn, dùng làm từ điển tạm cho các bản ghi khác
  function hocTuDien() {
    HOC = { tinh: {}, xa: {} };
    const nhom = {};
    for (const x of DS) for (const k of KHOA_DM) {
      const loai = loaiCua(k), g = sach(x.hoSo && x.hoSo[k]); if (!g) continue;
      const { tienTo, ten } = tachTienTo(g); if (!tienTo || !ten) continue;
      const hh = ((nhom[loai] = nhom[loai] || {})[kd(g)] = nhom[loai][kd(g)] || {});
      hh[sach(g)] = (hh[sach(g)] || 0) + 1;
    }
    for (const loai of ["tinh", "xa"]) for (const [key, hh] of Object.entries(nhom[loai] || {})) {
      const tot = Object.entries(hh).sort((a, b) => b[1] - a[1])[0];
      if (tot && !TUDIEN[loai][key]) HOC[loai][key] = tot[0];
    }
  }

  // ---------- Tải dữ liệu ----------
  async function taiTatCa() {
    $("tai").disabled = true; thongBao("Đang tải danh sách hồ sơ…", "ok"); $("lanTai").textContent = "";
    try {
      const ds0 = await fb("GET", "dsHoSo");
      const ids = Object.keys(ds0 || {});
      if (!ids.length) { thongBao("Đám mây chưa có hồ sơ nào.", "warn"); return; }
      DS = [];
      let xong = 0;
      for (let i = 0; i < ids.length; i += 6) {
        const lo = ids.slice(i, i + 6);
        const rs = await Promise.all(lo.map((id) => fb("GET", "hoso/" + encodeURIComponent(id)).catch(() => null)));
        lo.forEach((id, j) => { const r = rs[j]; if (r) DS.push({ id, ...(ds0[id] || {}), hoSo: r.hoSo || {}, raw: r }); });
        xong += lo.length;
        $("lanTai").textContent = `Đã tải ${xong}/${ids.length} hồ sơ…`;
        thongBao(`Đang tải chi tiết hồ sơ… ${xong}/${ids.length}`, "ok");
      }
      $("lanTai").textContent = `Đã tải ${DS.length} hồ sơ lúc ${new Date().toLocaleTimeString("vi-VN")}`;
      thongBao(`Đã tải ${DS.length} hồ sơ. Bấm “Chuẩn hóa (xem trước)” để xem đối chiếu.`, "ok");
      quet(); veTong(); veTatca();
      NGHI = gomNghi(); veNghi();
      KIEMTRA = gomKiemTra(); veKiemTra();
    } catch (e) { thongBao("Lỗi: " + e.message, "loi"); }
    finally { $("tai").disabled = false; }
  }

  // ---------- Quét & tạo danh sách thay đổi ----------
  function quet() {
    hocTuDien();
    SOI = {};
    let nDoi = 0, nNghi = 0;
    for (const x of DS) {
      const hs = x.hoSo, doi = {};
      for (const k of KHOA_DM) {
        if (!sach(hs[k])) continue;
        const r = chuanHoa(hs[k], k);
        if (r.muc === "nghi") nNghi++;
        if (r.muc && sach(hs[k]) !== r.gt) doi[k] = r.gt;
      }
      if (Object.keys(doi).length) { SOI[x.id] = doi; nDoi++; }
    }
    $("luu").disabled = !nDoi;
    $("boLuu").disabled = !nDoi;
    veTong(nDoi, nNghi);
    veTx(); veTudien();
  }

  // ---------- Tổng quan ----------
  function veTong(nDoi, nNghi) {
    const box = $("tong"); box.innerHTML = "";
    const gia = [];
    for (const x of DS) for (const k of KHOA_DM) { const g = sach(x.hoSo && x.hoSo[k]); if (g) gia.push(g); }
    const o = (b, t, lop) => el("div", { className: "o " + (lop || "") }, el("b", { textContent: String(b) }), el("span", { textContent: t }));
    box.append(o(DS.length, "hồ sơ đã tải"));
    box.append(o(gia.length, "ô Tỉnh/Xã có dữ liệu"));
    box.append(o(new Set(gia.map(kd)).size, "giá trị Tỉnh/Xã khác nhau"));
    box.append(o(Object.keys(TUDIEN.tinh).length + Object.keys(TUDIEN.xa).length, "mục trong từ điển"));
    if (nDoi != null) box.append(o(nDoi, "hồ sơ sẽ được chuẩn hóa", "vang"));
    if (nNghi != null) box.append(o(nNghi, "ô AI nghi ngờ về chính tả", "can"));
  }

  // ---------- Bảng Tỉnh/Xã + AI nghi ngờ ----------
  function locDs() {
    const q = kd(loc.q);
    return DS.filter((x) => {
      if (q && !kd(`${x.ten} ${x.cccd} ${x.id}`).includes(q)) return false;
      if (loc.k === "nghi") return !!(x.hoSo && KHOA_DM.some((k) => sach(x.hoSo[k]) && chuanHoa(x.hoSo[k], k).muc === "nghi"));
      if (loc.k === "doi") return !!SOI[x.id];
      if (loc.k === "sach") return !SOI[x.id] && !(x.hoSo && KHOA_DM.some((k) => sach(x.hoSo[k]) && chuanHoa(x.hoSo[k], k).muc === "nghi"));
      return true;
    });
  }
  function oNhan(g, r) {
    const g0 = sach(g);
    if (!g0) return el("span", { className: "mo", textContent: "–" });
    const span = el("span", { textContent: r.muc && r.gt !== g0 ? r.gt : g0 });
    if (r.muc === "goiy") span.className = "goiy";
    if (r.muc === "nghi") span.className = "nghi";
    if (!r.muc) span.className = "moiNho";
    if (r.muc && r.gt !== g0) span.append(el("div", { className: "mo" }, el("span", { className: "doi", textContent: g0 }), " → ", el("b", { textContent: r.gt })));
    span.append(el("div", { className: "mo", textContent: r.nhan }));
    return span;
  }

  function veTx() {
    const box = $("khuTx"); box.innerHTML = "";
    const ds = locDs(), chiDo = $("chiDo").checked;
    const cell = (x, k) => {
      const g = sach(x.hoSo && x.hoSo[k]);
      const r = g ? chuanHoa(g, k) : { gt: "", nhan: "", muc: "" };
      return { g, r, doi: !!(r.muc && r.gt !== g), nghi: r.muc === "nghi", o: oNhan(g, r) };
    };
    // nhóm nào thực sự cần hiện
    const nhomHien = NHOM.filter((n) => {
      if (!chiDo) return true;
      return ds.some((x) => { const a = cell(x, n.tinh), b = cell(x, n.xa); return a.doi || a.nghi || b.doi || b.nghi; });
    });
    const the = el("tr", {}, el("th", { textContent: "Hồ sơ" }));
    for (const n of nhomHien) the.append(el("th", { textContent: n.ten + " – Tỉnh" }), el("th", { textContent: n.ten + " – Xã/Phường" }));
    the.append(el("th", { textContent: "AI nghi ngờ về chính tả" }));
    const tb = el("table", {}, el("thead", {}, the));
    const tbody = el("tbody");
    for (const x of ds) {
      const nghi = [];
      const tr = el("tr", {}, el("td", {}, el("b", { textContent: x.ten || "(chưa có họ tên)" }), el("div", { className: "mo", textContent: `${x.cccd || x.id} · ${x.trangThai || "chưa nhập"}` })));
      for (const n of nhomHien) for (const k of [n.tinh, n.xa]) {
        const c = cell(x, k);
        if (c.nghi) nghi.push(`${n.ten}: “${c.g}” – ${c.r.nhan}`);
        tr.append(el("td", {}, c.o));
      }
      tr.append(el("td", { className: nghi.length ? "nghi" : "mo" }, nghi.length ? el("div", {}, nghi.map((t) => el("div", { textContent: "⚠ " + t }))) : el("span", { textContent: "Không có" })));
      tbody.append(tr);
    }
    tb.append(tbody);
    box.append(el("div", { className: "cuoi" }, tb));
    if (!ds.length) box.append(el("p", { className: "mo", textContent: "Không có hồ sơ phù hợp." }));
  }

  // ---------- Thẻ "Trường AI nghi ngờ → sửa lên đám mây" ----------
  // Gom HẾT các ô AI nghi ngờ: từ dữ liệu app quét (nghi/lyDo trên đám mây) + từ chuẩn hóa Tỉnh/Xã
  const NHAN_KT = { householdAnnualIncome: "Tổng thu nhập hộ/năm (đồng)", perCapitaAnnualIncome: "Thu nhập bình quân đầu người (đồng)", economicActivity: "Hoạt động kinh tế", countWorker: "Số lao động thuê mướn", nhaCapLoai: "Nhà được cấp/thuê – loại", nhaCapDienTich: "Nhà được cấp/thuê – m2", nhaMuaLoai: "Nhà tự mua/xây – loại", nhaMuaDienTich: "Nhà tự mua/xây – m2", datCap: "Đất được cấp (m2)", datMua: "Đất tự mua (m2)", datTrangTrai: "Đất trang trại (ha)", taiSan1Ten: "Tài sản 1 – tên", taiSan1GiaTri: "Tài sản 1 – giá trị (đồng)", taiSan2Ten: "Tài sản 2 – tên", taiSan2GiaTri: "Tài sản 2 – giá trị (đồng)", taiSan3Ten: "Tài sản 3 – tên", taiSan3GiaTri: "Tài sản 3 – giá trị (đồng)" };
  const NHAN_QH = { type: "Phân loại", familyMemberId: "Quan hệ", isPartyMember: "Là đảng viên", fullName: "Họ và tên", identifyNo: "Số căn cước", birthDate: "Năm sinh", currentStatus: "Tình trạng (đã qua đời/ly hôn)", finishedYear: "Đã qua đời/ly hôn năm", currentJob: "Công việc", nationalityId: "Quốc tịch", nationId: "Nơi ở hiện nay", residentPlace: "Chi tiết nơi ở", hometown: "Quê quán", note: "Ghi chú" };
  const NHAN_CT = { nationId: "Quốc gia", fromDate: "Từ tháng/năm", toDate: "Đến tháng/năm", companyName: "Tên tổ chức", partyPositionIds: "Chức vụ đảng", concurrentPartyPosition: "Chức vụ Đảng kiêm nhiệm", companyPosition: "Chức danh, chức vụ, nghề nghiệp", note: "Ghi chú" };
  const nhanTruong = (nhom, k) => {
    const tu = (arr) => { const t = (arr || []).find((x) => x[0] === k); return t ? t[1] : ""; };
    if (nhom === "b1" && typeof TRUONG_HO_SO !== "undefined") return tu(TRUONG_HO_SO) || k;
    if (nhom === "dd" && typeof TRUONG_DD !== "undefined") return tu(TRUONG_DD) || k;
    if (nhom === "kt") return NHAN_KT[k] || k;
    if (nhom === "qh") return NHAN_QH[k] || k;
    if (nhom === "ct") return NHAN_CT[k] || k;
    if (typeof DS_THEM !== "undefined" && DS_THEM[nhom]) return tu(DS_THEM[nhom].truong) || k;
    return k;
  };
  const tenNhom = (nhom) => {
    if (nhom === "b1") return "B1 Thông tin cơ bản";
    if (nhom === "dd") return "B6 Đặc điểm lịch sử";
    if (nhom === "kt") return "B9 Hoàn cảnh kinh tế";
    if (nhom === "ct") return "B2 Quá trình công tác";
    if (nhom === "qh") return "B8 Quan hệ gia đình";
    if (typeof DS_THEM !== "undefined" && DS_THEM[nhom]) return `${DS_THEM[nhom].so} ${DS_THEM[nhom].ten}`;
    return nhom;
  };
  let NGHI = [];
  let chiChuaSua = true;
  const goiYNghi = (nhom, k, cu) => {
    if (nhom !== "b1" || !/(Province|Commune)Id$/.test(k)) return "";
    const ch = chuanHoa(cu, k);
    return ch.muc && ch.gt !== sach(cu) ? ch.gt : "";
  };
  function gomNghi() {
    const ds = [];
    const day = (a) => (Array.isArray(a) ? a : Object.values(a || {})).map(String);
    const mangK = (a) => {
      if (Array.isArray(a)) return a.map((o, i) => [String(i), o]).filter((x) => x[1] && typeof x[1] === "object");
      return Object.entries(a || {}).filter((x) => x[1] && typeof x[1] === "object");
    };
    for (const x of DS) {
      const r = x.raw || {}, hs = x.hoSo || {}, lyDo = r.lyDo || {}, nghi = r.nghi || {};
      const lyd = (nhom, ma) => (lyDo[nhom] || {})[ma] || (lyDo[nhom] || {})[String(ma).replace(/\./g, "_")] || "";
      for (const [nhom, dich] of [["b1", hs], ["dd", r.dacDiemLichSu || {}], ["kt", r.hoanCanhKinhTe || {}]]) {
        for (const k of day(nghi[nhom])) {
          if (dich[k] == null) continue;
          const cu = String(dich[k]);
          ds.push({ id: x.id, ten: x.ten || "", cccd: x.cccd || "", nhom, kieu: nhom, key: k, truong: nhanTruong(nhom, k), cu, lyDo: lyd(nhom, k) || "AI chưa chắc", goiY: goiYNghi(nhom, k, cu), xong: false });
        }
      }
      const nhoms = [["ct", "quaTrinhCongTac"], ["qh", "quanHeGiaDinh"], ...Object.keys(typeof DS_THEM !== "undefined" ? DS_THEM : {}).map((b) => [b, b])];
      for (const [nhom, raw] of nhoms) {
        const arr = mangK(r[raw]);
        for (const ma of day(nghi[nhom])) {
          const m = String(ma).match(/^(\d+)\.(\w+)$/);
          if (!m) continue;
          const hit = arr.find((z) => z[0] === m[1]);
          if (!hit || hit[1][m[2]] == null) continue;
          ds.push({ id: x.id, ten: x.ten || "", cccd: x.cccd || "", nhom, kieu: "bang", raw, idx: hit[0], key: m[2], truong: `${nhanTruong(nhom, m[2])} (dòng ${m[1]})`, cu: String(hit[1][m[2]]), lyDo: lyd(nhom, ma) || "AI chưa chắc", goiY: "", xong: false });
        }
      }
    }
    for (const x of DS) {
      const hs = x.hoSo || {};
      for (const k of KHOA_DM) {
        const g = sach(hs[k]); if (!g) continue;
        const ch = chuanHoa(g, k);
        if ((ch.muc === "nghi" || ch.muc === "goiy") && ch.gt !== g && !ds.some((o) => o.id === x.id && o.key === k && o.kieu === "b1"))
          ds.push({ id: x.id, ten: x.ten || "", cccd: x.cccd || "", nhom: "b1", kieu: "b1", key: k, truong: nhanTruong("b1", k), cu: g, lyDo: ch.nhan, goiY: ch.muc === "goiy" ? ch.gt : "", muc: ch.muc, xong: false });
      }
    }
    return ds;
  }
  function veNghi() {
    const box = $("khuNghi"); box.innerHTML = "";
    if (!DS.length) { box.append(el("p", { className: "mo", textContent: "Chưa tải dữ liệu." })); return; }
    const q = kd(loc.q);
    const ds = NGHI.filter((o) => (!chiChuaSua || !o.xong) && (!q || kd(`${o.ten} ${o.cccd} ${o.id} ${o.truong} ${o.cu}`).includes(q)));
    const lam = el("div", { className: "hang", style: "margin-bottom:8px" },
      el("span", { className: "mo", textContent: `${ds.length} trường AI nghi ngờ` + (NGHI.some((o) => o.xong) ? ` (${NGHI.filter((o) => o.xong).length} đã sửa)` : "") }),
      el("label", {}, el("input", { type: "checkbox", checked: chiChuaSua, onchange: (e) => { chiChuaSua = e.target.checked; veNghi(); } }), " Chỉ hiện chưa sửa"));
    const tb = el("table", {}, el("thead", {}, el("tr", {},
      el("th", { textContent: "Hồ sơ" }), el("th", { textContent: "Mục – Trường AI nghi ngờ" }),
      el("th", { textContent: "Dữ liệu gốc trên đám mây" }), el("th", { textContent: "Lý do AI" }),
      el("th", { textContent: "Dữ liệu chuẩn sẽ sửa" }), el("th", { textContent: "" }))));
    const tb2 = el("tbody");
    for (const o of ds) {
      const inp = el("input", { className: "chi", value: o.goiY || o.cu, title: "Sửa giá trị chuẩn ở đây rồi bấm nút bên phải" });
      const nut = el("button", { className: "xanh nho", textContent: o.xong ? "✔ Đã sửa" : "✔ Sửa đúng, đẩy lên đám mây" });
      nut.disabled = o.xong;
      nut.onclick = () => dayNghi(o, inp.value, nut);
      tb2.append(el("tr", {},
        el("td", {}, el("b", { textContent: o.ten || "(chưa có họ tên)" }), el("div", { className: "mo", textContent: o.cccd || o.id })),
        el("td", {}, el("b", { textContent: tenNhom(o.nhom) }), el("div", { className: "mo", textContent: o.truong })),
        el("td", { textContent: o.cu }),
        el("td", { className: "nghi", textContent: o.lyDo }),
        el("td", {}, inp),
        el("td", {}, nut)));
    }
    tb.append(tb2);
    box.append(lam, el("div", { className: "cuoi" }, tb));
    if (!ds.length) box.append(el("p", { className: "mo", textContent: "Không có trường AI nghi ngờ phù hợp." }));
  }
  async function dayNghi(o, moi, nut) {
    moi = sach(moi);
    if (!moi) return thongBao("Chưa nhập dữ liệu chuẩn để sửa.", "warn");
    if (moi === o.cu) return thongBao("Dữ liệu chuẩn trùng với dữ liệu gốc, không cần ghi.", "warn");
    nut.disabled = true; nut.textContent = "Đang ghi…";
    let body;
    if (o.kieu === "b1") body = { hoSo: { [o.key]: moi } };
    else if (o.kieu === "dd") body = { dacDiemLichSu: { [o.key]: moi } };
    else if (o.kieu === "kt") body = { hoanCanhKinhTe: { [o.key]: moi } };
    else body = { [o.raw]: { [o.idx]: { [o.key]: moi } } };
    try {
      await fb("PATCH", "hoso/" + encodeURIComponent(o.id), body);
      const x = DS.find((z) => z.id === o.id);
      if (x) {
        if (o.kieu === "b1") x.hoSo[o.key] = moi;
        else if (o.kieu === "dd") (x.raw.dacDiemLichSu = x.raw.dacDiemLichSu || {})[o.key] = moi;
        else if (o.kieu === "kt") (x.raw.hoanCanhKinhTe = x.raw.hoanCanhKinhTe || {})[o.key] = moi;
        else if (x.raw[o.raw] && x.raw[o.raw][o.idx]) x.raw[o.raw][o.idx][o.key] = moi;
      }
      if (o.kieu === "b1" && SOI[o.id]) { delete SOI[o.id][o.key]; if (!Object.keys(SOI[o.id]).length) delete SOI[o.id]; $("luu").disabled = !Object.keys(SOI).length; $("boLuu").disabled = !Object.keys(SOI).length; }
      o.xong = true; o.cu = moi;
      nut.textContent = "✔ Đã sửa";
      thongBao(`Đã sửa “${o.truong}” của ${o.ten || o.id} trên đám mây.`, "ok");
      quet(); veNghi(); veKiemTra();
    } catch (e) { nut.disabled = false; nut.textContent = "✔ Sửa đúng, đẩy lên đám mây"; thongBao("Không ghi được: " + e.message, "loi"); }
  }

  // ---------- Thẻ "Tên – Ngày – CCCD" ----------
  // Liệt kê các ô ngày tháng / họ tên / CCCD sai định dạng hoặc nghi ngờ, AI gợi ý sửa, nút đẩy từng ô
  const NGAY_THANG = new Set(["fromDate", "toDate"]);
  const NGAY_NGAY = new Set(["birthDate", "officialJoinPartyDate", "officialRecognitionDate", "decidedRecognitionDate", "recruitmentDate", "joinYouthUnionDate", "enlistmentDate", "dischargeDate", "exemptionDate", "officialJoinPartyDate2", "officialRecognitionDate2", "rejoinDate", "leaveDate", "medalDecisionDate", "issueDate", "establishedDate"]);
  const NGAY_NAM = new Set(["year", "incentiveDate", "disciplineDate", "medalDecisionYear", "finishedYear"]);
  const TEN_KEYS = new Set(["currentFullName", "alias", "intro1FirstJoinFullName", "intro2FirstJoinFullName", "fullName"]);
  const CCCD_KEYS = new Set(["identifyNo", "identifyNoOld"]);
  const phanLoaiKT = (nhom, k) => {
    if (CCCD_KEYS.has(k)) return "cccd";
    if (NGAY_THANG.has(k)) return "thang";
    if (NGAY_NAM.has(k) || (nhom === "qh" && k === "birthDate")) return "nam";
    if (NGAY_NGAY.has(k)) return "ngay";
    if (TEN_KEYS.has(k)) return "ten";
    return "";
  };
  const hopNgay = (d, m, y) => {
    d = +d; m = +m; y = +y;
    if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100)) return false;
    const t = new Date(y, m - 1, d);
    return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
  };
  // cheDo: "ngay" (dd/mm/yyyy hoặc mm/yyyy) | "thang" (thêm yyyy) | "nam" (chỉ yyyy)
  function ktNgay(gt, cheDo) {
    const g0 = sach(gt);
    if (!g0) return null;
    const s = g0.replace(/[.\-]/g, "/").replace(/\s+/g, "").replace(/[Oo]/g, "0").replace(/[lI]/g, "1");
    if (/[a-zà-ỹ]/i.test(s)) return { vanDe: `chứa ký tự chữ (“${g0}”)`, goiY: "" };
    let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      if (cheDo === "nam") return { vanDe: `ô năm nhưng ghi cả ngày (“${g0}”)`, goiY: m[3] };
      return hopNgay(m[1], m[2], m[3]) ? (s !== g0 ? { vanDe: "khác định dạng chuẩn", goiY: s } : null) : { vanDe: `ngày không tồn tại (“${g0}”)`, goiY: "" };
    }
    m = s.match(/^(\d{2})\/(\d{4})$/);
    if (m) {
      if (+m[1] < 1 || +m[1] > 12 || +m[2] < 1900 || +m[2] > 2100) return { vanDe: `tháng/năm không hợp lệ (“${g0}”)`, goiY: "" };
      return s !== g0 ? { vanDe: "khác định dạng chuẩn", goiY: s } : null;
    }
    m = s.match(/^(\d{4})$/);
    if (m) {
      if (cheDo === "ngay") return { vanDe: `thiếu ngày/tháng (“${g0}”)`, goiY: "" };
      return (+m[1] >= 1900 && +m[1] <= 2100) ? (s !== g0 ? { vanDe: "khác định dạng chuẩn", goiY: s } : null) : { vanDe: `năm không hợp lệ (“${g0}”)`, goiY: "" };
    }
    return { vanDe: `không đúng định dạng ${cheDo === "nam" ? "yyyy" : cheDo === "thang" ? "mm/yyyy" : "dd/mm/yyyy"} (“${g0}”)`, goiY: "" };
  }
  function ktTen(gt) {
    const g0 = sach(gt);
    if (!g0) return null;
    if (/\d/.test(g0)) return { vanDe: `tên chứa số (“${g0}”)`, goiY: "" };
    if (/[^a-zA-Zà-ỹÀ-Ỹ\s'’.\-]/.test(g0)) return { vanDe: `tên chứa ký tự lạ (“${g0}”)`, goiY: "" };
    const tieuDe = vietTieuDe(g0);
    if (tieuDe !== g0) return { vanDe: "chưa viết hoa chuẩn tên riêng", goiY: tieuDe };
    if (g0.normalize("NFD").replace(/[̀-ͯ]/g, "") === g0 && !/[đĐ]/.test(g0) && /[a-zà-ỹ]/i.test(g0)) return { vanDe: "tên không dấu, cần kiểm tra", goiY: "" };
    return null;
  }
  function ktCccd(gt) {
    const g0 = sach(gt);
    if (!g0) return null;
    const s = g0.replace(/[\s.\-]/g, "").replace(/[Oo]/g, "0").replace(/[lI]/g, "1");
    if (/^\d+$/.test(s) && (s.length === 9 || s.length === 12)) return s !== g0 ? { vanDe: "thừa khoảng trắng/dấu phân cách", goiY: s } : null;
    if (!/^\d+$/.test(s)) return { vanDe: `chứa ký tự không phải số (“${g0}”)`, goiY: "" };
    return { vanDe: `không phải 9/12 số (đang ${s.length} số: “${g0}”)`, goiY: "" };
  }
  let KIEMTRA = [];
  let chiChuaSuaKT = true;
  const TEN_LOAI_KT = { ngay: "ngày", thang: "tháng", nam: "năm", ten: "tên", cccd: "CCCD" };
  function gomKiemTra() {
    const ds = [];
    const mangK = (a) => {
      if (Array.isArray(a)) return a.map((o, i) => [String(i), o]).filter((x) => x[1] && typeof x[1] === "object");
      return Object.entries(a || {}).filter((x) => x[1] && typeof x[1] === "object");
    };
    const xet = (o, loai, cu) => {
      if (!sach(cu)) return;
      const r = loai === "cccd" ? ktCccd(cu) : loai === "ten" ? ktTen(cu) : ktNgay(cu, loai);
      if (r) ds.push({ ...o, truong: `${o.truong} · kiểm tra ${TEN_LOAI_KT[loai]}`, cu: String(cu), lyDo: r.vanDe, goiY: r.goiY || "", xong: false });
    };
    for (const x of DS) {
      const r = x.raw || {}, hs = x.hoSo || {};
      const coBan = { id: x.id, ten: x.ten || "", cccd: x.cccd || "" };
      for (const [nhom, dich] of [["b1", hs], ["dd", r.dacDiemLichSu || {}], ["kt", r.hoanCanhKinhTe || {}]])
        for (const k of Object.keys(dich)) {
          const loai = phanLoaiKT(nhom, k);
          if (loai) xet({ ...coBan, nhom, kieu: nhom, key: k, truong: nhanTruong(nhom, k) }, loai, dich[k]);
        }
      const nhoms = [["ct", "quaTrinhCongTac"], ["qh", "quanHeGiaDinh"], ...Object.keys(typeof DS_THEM !== "undefined" ? DS_THEM : {}).map((b) => [b, b])];
      for (const [nhom, raw] of nhoms)
        for (const [idx, dong] of mangK(r[raw]))
          for (const k of Object.keys(dong)) {
            const loai = phanLoaiKT(nhom, k);
            if (loai) xet({ ...coBan, nhom, kieu: "bang", raw, idx, key: k, truong: `${nhanTruong(nhom, k)} (dòng ${idx})` }, loai, dong[k]);
          }
    }
    return ds;
  }
  function veKiemTra() {
    const box = $("khuKiemTra"); box.innerHTML = "";
    if (!DS.length) { box.append(el("p", { className: "mo", textContent: "Chưa tải dữ liệu." })); return; }
    const q = kd(loc.q);
    const ds = KIEMTRA.filter((o) => (!chiChuaSuaKT || !o.xong) && (!q || kd(`${o.ten} ${o.cccd} ${o.id} ${o.truong} ${o.cu}`).includes(q)));
    const lam = el("div", { className: "hang", style: "margin-bottom:8px" },
      el("span", { className: "mo", textContent: `${ds.length} ô tên/ngày/CCCD cần xem` + (KIEMTRA.some((o) => o.xong) ? ` (${KIEMTRA.filter((o) => o.xong).length} đã sửa)` : "") }),
      el("button", { className: "nho", textContent: "⬇ Xuất danh sách cho AI", onclick: () => xuatFile("cho-ai-ten-ngay-cccd.json", ds.map((o) => ({ id: o.id, ten: o.ten, nhom: tenNhom(o.nhom), truong: o.truong, giaTri: o.cu, vanDe: o.lyDo, goiY: o.goiY }))) }),
      el("label", {}, el("input", { type: "checkbox", checked: chiChuaSuaKT, onchange: (e) => { chiChuaSuaKT = e.target.checked; veKiemTra(); } }), " Chỉ hiện chưa sửa"));
    const tb = el("table", {}, el("thead", {}, el("tr", {},
      el("th", { textContent: "Hồ sơ" }), el("th", { textContent: "Mục – Trường" }),
      el("th", { textContent: "Dữ liệu gốc" }), el("th", { textContent: "Vấn đề" }),
      el("th", { textContent: "AI sửa thành" }), el("th", { textContent: "" }))));
    const tb2 = el("tbody");
    for (const o of ds) {
      const inp = el("input", { className: "chi", value: o.goiY || o.cu, title: "Sửa giá trị chuẩn ở đây rồi bấm nút bên phải" });
      const nut = el("button", { className: "xanh nho", textContent: o.xong ? "✔ Đã sửa" : "✔ Sửa đúng, đẩy lên đám mây" });
      nut.disabled = o.xong;
      nut.onclick = () => dayNghi(o, inp.value, nut);
      tb2.append(el("tr", {},
        el("td", {}, el("b", { textContent: o.ten || "(chưa có họ tên)" }), el("div", { className: "mo", textContent: o.cccd || o.id })),
        el("td", {}, el("b", { textContent: tenNhom(o.nhom) }), el("div", { className: "mo", textContent: o.truong })),
        el("td", { textContent: o.cu }),
        el("td", { className: "nghi", textContent: o.lyDo }),
        el("td", {}, inp),
        el("td", {}, nut)));
    }
    tb.append(tb2);
    box.append(lam, el("div", { className: "cuoi" }, tb));
    if (!ds.length) box.append(el("p", { className: "mo", textContent: "Không có ô tên/ngày/CCCD nào cần xem." }));
  }

  // ---------- Từ điển ----------
  function veTudien() {
    const box = $("khuTudien"); box.innerHTML = "";
    const dem = {};
    for (const x of DS) for (const k of KHOA_DM) {
      const g = sach(x.hoSo && x.hoSo[k]); if (!g) continue;
      const loai = loaiCua(k), key = loai + "||" + kd(g);
      const o = dem[key] = dem[key] || { loai, goc: g, sl: 0, chuan: TUDIEN[loai][key] || HOC[loai][key] || "", nguon: "" };
      o.sl++;
      if (!o.chuan && tachTienTo(g).tienTo) { o.chuan = sach(g); o.nguon = "tự học"; }
      if (TUDIEN[loai][key]) { o.chuan = TUDIEN[loai][key]; o.nguon = "đã xác nhận"; }
    }
    const ds = Object.values(dem).sort((a, b) => a.loai.localeCompare(b.loai) || b.sl - a.sl);
    const tb = el("table", {}, el("thead", {}, el("tr", {},
      el("th", { textContent: "Loại" }), el("th", { textContent: "Giá trị trong dữ liệu" }), el("th", { textContent: "Số lần" }),
      el("th", { textContent: "Giá trị chuẩn (sửa ở đây)" }), el("th", { textContent: "Nguồn" }), el("th", { textContent: "" }))));
    const tb2 = el("tbody");
    for (const o of ds) {
      const inp = el("input", { className: "chi", value: o.chuan || "", placeholder: "vd: Tỉnh Lào Cai / Xã Mậu A" });
      const bt = el("button", { className: "nho", textContent: "Lưu" });
      const ap = el("button", { className: "nho", textContent: "Áp dụng cho tất cả" });
      const xoa = el("button", { className: "nho", textContent: "Bỏ từ điển" });
      const luu1 = () => { const v = sach(inp.value); if (!v) return; datTuDien(o.loai, o.goc, v); quet(); };
      bt.onclick = luu1;
      inp.onchange = luu1;
      ap.onclick = () => { const v = sach(inp.value); if (!v) return; datTuDien(o.loai, o.goc, v); quet(); thongBao(`Đã đặt “${o.goc}” → “${v}” trong từ điển. Bấm “Ghi thay đổi lên đám mây” để áp dụng cho hồ sơ.`, "ok"); };
      xoa.onclick = () => { delete TUDIEN[o.loai][kd(o.goc)]; ghiTudien(); quet(); veTudien(); };
      tb2.append(el("tr", {}, el("td", { textContent: o.loai === "tinh" ? "Tỉnh" : "Xã" }), el("td", { textContent: o.goc }), el("td", { textContent: o.sl }),
        el("td", {}, inp), el("td", { className: "mo", textContent: o.nguon || "–" }), el("td", {}, bt, ap, xoa)));
    }
    tb.append(tb2);
    const nut = el("div", { className: "hang", style: "margin:8px 0" },
      el("button", { className: "nho", textContent: "⬇ Xuất từ điển (JSON)", onclick: () => xuatFile("chuanhoa-tudien.json", TUDIEN) }),
      el("button", { className: "nho", textContent: "⬆ Nhập từ điển (JSON)", onclick: nhapTudien }));
    box.append(nut, el("div", { className: "cuoi" }, tb),
      el("p", { className: "mo", textContent: "Từ điển dùng cho mọi hồ sơ. Cột “tự học” là giá trị đã có tiền tố đúng trong dữ liệu nên lấy làm chuẩn — chỉ cần xác nhận một lần là các bản ghi khác tự đúng theo." }));
  }
  async function nhapTudien() {
    const f = await chonTep(".json");
    if (!f) return;
    try {
      const t = JSON.parse(await f.text());
      for (const loai of ["tinh", "xa"]) for (const [k, v] of Object.entries(t[loai] || {})) TUDIEN[loai][k] = v;
      await ghiTudien(); quet(); veTudien(); thongBao("Đã nhập từ điển.", "ok");
    } catch (e) { thongBao("Tệp không đúng: " + e.message, "loi"); }
  }

  // ---------- Tất cả dữ liệu ----------
  function veTatca() {
    const box = $("khuTatca"); box.innerHTML = "";
    if (!DS.length) { box.append(el("p", { className: "mo", textContent: "Chưa tải dữ liệu." })); return; }
    const ds = locDs();
    const tb = el("table", {}, el("thead", {}, el("tr", {}, el("th", { textContent: "Hồ sơ" }), el("th", { textContent: "Toàn bộ dữ liệu (JSON)" }))));
    const tb2 = el("tbody");
    for (const x of ds) {
      const pre = el("pre"); pre.textContent = JSON.stringify(x.raw, null, 2);
      tb2.append(el("tr", {}, el("td", { style: "width:220px" }, el("b", { textContent: x.ten || "(chưa có họ tên)" }), el("div", { className: "mo", textContent: `${x.cccd || x.id}` })), el("td", {}, pre)));
    }
    tb.append(tb2);
    box.append(el("div", { className: "hang", style: "margin-bottom:8px" },
      el("button", { className: "nho", textContent: `⬇ Xuất toàn bộ (${ds.length} hồ sơ) JSON`, onclick: () => xuatFile("dam-may-chuan-hoa.json", DS.map((x) => ({ id: x.id, ...x.raw }))) }),
      el("button", { className: "nho", textContent: "⬇ Xuất CSV Tỉnh/Xã", onclick: () => xuatCsv() })), el("div", { className: "cuoi" }, tb));
  }
  function xuatCsv() {
    const dong = [["id", "ten", "cccd", ...NHOM.flatMap((n) => [n.tinh, n.xa]), "nghiNgoChinhTa"]];
    for (const x of locDs()) {
      const nghi = [];
      for (const n of NHOM) for (const k of [n.tinh, n.xa]) {
        const g = sach(x.hoSo && x.hoSo[k]); if (!g) continue;
        const r = chuanHoa(g, k); if (r.muc === "nghi") nghi.push(`${k}="${g}" (${r.nhan})`);
      }
      dong.push([x.id, x.ten || "", x.cccd || "", ...NHOM.flatMap((n) => [x.hoSo[n.tinh] || "", x.hoSo[n.xa] || ""]), nghi.join("; ")]);
    }
    xuatFile("tinh-xa.csv", dong.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv;charset=utf-8");
  }

  // ---------- Kết nối AI ----------
  function veAi() {
    const box = $("khuAi"); box.innerHTML = "";
    const dem = {};
    for (const x of DS) for (const k of KHOA_DM) {
      const g = sach(x.hoSo && x.hoSo[k]); if (!g) continue;
      const loai = loaiCua(k), r = chuanHoa(g, k);
      const key = loai + "||" + g;
      const o = dem[key] = dem[key] || { loai, giaTri: g, sl: 0, tuDien: TUDIEN[loai][kd(g)] || HOC[loai][kd(g)] || "", nghi: [], goiY: [] };
      o.sl++;
      if (r.muc === "nghi" && !o.nghi.includes(r.nhan)) o.nghi.push(r.nhan);
      if (r.muc === "goiy" && r.nhan && !o.goiY.includes(r.nhan)) o.goiY.push(r.nhan);
    }
    const ds = Object.values(dem).sort((a, b) => a.loai.localeCompare(b.loai) || b.sl - a.sl);
    const goiAI = { gia: ds.map((o) => ({ loai: o.loai, giaTri: o.giaTri, soLan: o.sl, chuanDaCo: o.tuDien, goiY: o.goiY, nghiNgo: o.nghi })) };
    const ta = el("textarea", { id: "aiKq", placeholder: 'Dán kết quả AI vào đây. Chấp nhận 2 dạng:\n{"tinh":{"lào cai":"Tỉnh Lào Cai"},"xa":{"mậu a":"Xã Mậu A"}}\nhoặc\n[{"loai":"xa","tu":"mậu a","den":"Xã Mậu A"}]' });
    const bt = el("button", { className: "xanh", textContent: "⬆ Áp dụng kết quả AI" });
    bt.onclick = async () => {
      try {
        const t = JSON.parse($("aiKq").value.trim());
        let n = 0;
        if (Array.isArray(t)) for (const r of t) { if (r.loai && r.tu && r.den) { TUDIEN[r.loai][kd(r.tu)] = r.den; n++; } }
        else for (const loai of ["tinh", "xa"]) for (const [k, v] of Object.entries(t[loai] || {})) { TUDIEN[loai][k] = v; n++; }
        if (!n) throw new Error("không tìm thấy cặp nào để sửa");
        await ghiTudien(); quet(); veTudien(); thongBao(`Đã áp dụng ${n} mục từ kết quả AI. Xem lại bảng đối chiếu.`, "ok");
      } catch (e) { thongBao("Kết quả AI không đúng: " + e.message, "loi"); }
    };
    box.append(
      el("div", { className: "the" },
        el("h3", { style: "margin:0 0 6px" }, "Cách dùng"),
        el("p", { className: "mo" }, "1) Xuất danh sách giá trị Tỉnh/Xã (chỉ vài chục dòng). ",
          el("button", { className: "nho", textContent: "⬇ Xuất danh sách cho AI", onclick: () => xuatFile("cho-ai-chuan-hoa.json", goiAI) }), " ",
          el("button", { className: "nho", textContent: "⬇ Xuất cả dữ liệu thô", onclick: () => xuatFile("cho-ai-chuan-hoa-day-du.json", DS.map((x) => ({ id: x.id, ten: x.ten, cccd: x.cccd, hoSo: x.hoSo }))) })),
        el("p", { className: "mo" }, "2) Gửi cho AI, nhờ sửa chính tả: giữ đúng tên tiếng Việt, thêm tiền tố hành chính đầy đủ (Tỉnh…/Thành phố…/Xã…/Phường…/Thị trấn…/Đặc khu…), không bịa tên mới."),
        el("p", { className: "mo" }, "3) Dán JSON kết quả AI vào ô dưới rồi bấm “Áp dụng”. 4) Xem bảng đối chiếu, cuối cùng bấm “Ghi thay đổi lên đám mây”.")),
      el("div", { className: "the" }, bt, ta));
    const tb = el("table", {}, el("thead", {}, el("tr", {}, el("th", { textContent: "Loại" }), el("th", { textContent: "Giá trị trong dữ liệu" }), el("th", { textContent: "Số lần" }), el("th", { textContent: "Chuẩn hiện có" }), el("th", { textContent: "AI nghi ngờ / gợi ý" }))));
    const tb2 = el("tbody");
    for (const o of ds) tb2.append(el("tr", {}, el("td", { textContent: o.loai === "tinh" ? "Tỉnh" : "Xã" }), el("td", { textContent: o.giaTri }), el("td", { textContent: o.sl }),
      el("td", { textContent: o.tuDien || "–" }), el("td", { className: o.nghi.length ? "nghi" : "mo", textContent: [...o.nghi.map((x) => "⚠ " + x), ...o.goiY.map((x) => "≈ " + x)].join(" · ") || "–" })));
    tb.append(tb2);
    box.append(el("div", { className: "cuoi" }, tb));
  }

  // ---------- Cấu trúc đám mây ----------
  async function veCauTruc() {
    const box = $("khuCauTruc"); box.innerHTML = "";
    box.append(el("p", { className: "mo", textContent: "Đang đọc…" }));
    try {
      const goc = await fb("GET", "");
      const ds = Object.entries(goc || {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 1]);
      box.innerHTML = "";
      const tb = el("table", {}, el("thead", {}, el("tr", {}, el("th", { textContent: "Đường dẫn" }), el("th", { textContent: "Số mục" }))));
      const tb2 = el("tbody");
      for (const [k, n] of ds.sort((a, b) => b[1] - a[1])) tb2.append(el("tr", {}, el("td", { textContent: "/" + k }), el("td", { textContent: n })));
      tb.append(tb2);
      box.append(el("div", { className: "cuoi" }, tb));
    } catch (e) { box.innerHTML = ""; box.append(el("div", { className: "thongbao loi", textContent: "Lỗi: " + e.message })); }
  }

  // ---------- Ghi / bỏ thay đổi ----------
  $("luu").onclick = async () => {
    const ids = Object.keys(SOI);
    const soO = Object.values(SOI).reduce((a, b) => a + Object.keys(b).length, 0);
    if (!confirm(`Ghi ${soO} ô Tỉnh/Xã của ${ids.length} hồ sơ lên đám mây?\n\nBấm OK để ghi, Hủy để xem lại.`)) return;
    $("luu").disabled = true;
    let xong = 0, loi = [];
    for (const [i, id] of ids.entries()) {
      thongBao(`Đang ghi ${i + 1}/${ids.length}…`, "ok");
      try { await fb("PATCH", "hoso/" + encodeURIComponent(id), { hoSo: SOI[id] }); xong++; }
      catch (e) { loi.push(`${id}: ${e.message}`); }
    }
    thongBao(`Đã ghi ${xong}/${ids.length} hồ sơ.` + (loi.length ? " Lỗi: " + loi.join("; ") : ""), loi.length ? "loi" : "ok");
    if (!loi.length) { SOI = {}; $("luu").disabled = true; $("boLuu").disabled = true; quet(); }
  };
  $("boLuu").onclick = () => { SOI = {}; $("luu").disabled = true; $("boLuu").disabled = true; quet(); thongBao("Đã bỏ các thay đổi chưa ghi.", "ok"); };

  // ---------- Tiện ích ----------
  function xuatFile(ten, duLieu, mime = "application/json") {
    const b = new Blob([typeof duLieu === "string" ? "\ufeff" + duLieu : JSON.stringify(duLieu, null, 2)], { type: mime });
    const u = URL.createObjectURL(b), a = el("a", { href: u, download: ten });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
  }
  const chonTep = (accept) => new Promise((xong) => {
    const i = el("input", { type: "file", accept });
    i.onchange = () => xong(i.files[0] || null);
    i.click();
  });

  // ---------- Điều khiển ----------
  $("tai").onclick = taiTatCa;
  $("quet").onclick = () => { if (!DS.length) return thongBao("Hãy bấm “Tải toàn bộ dữ liệu” trước.", "warn"); quet(); thongBao("Đã chuẩn hóa (chưa ghi lên đám mây). Xem cột AI nghi ngờ.", "ok"); };
  $("tim").oninput = (e) => { loc.q = e.target.value; veTx(); veTatca(); veNghi(); veKiemTra(); };
  $("loc").onchange = (e) => { loc.k = e.target.value; veTx(); veTatca(); veNghi(); veKiemTra(); };
  $("chiDo").onchange = () => veTx();
  document.querySelectorAll(".tabs button").forEach((b) => b.onclick = () => {
    tabHienTai = b.dataset.tab;
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b));
    $("khuTx").hidden = tabHienTai !== "tx"; $("khuNghi").hidden = tabHienTai !== "nghi"; $("khuKiemTra").hidden = tabHienTai !== "kiemtra"; $("khuTudien").hidden = tabHienTai !== "tudien";
    $("khuTatca").hidden = tabHienTai !== "tatca"; $("khuAi").hidden = tabHienTai !== "ai";
    $("khuCauTruc").hidden = tabHienTai !== "cauTruc";
    if (tabHienTai === "tx") veTx();
    if (tabHienTai === "nghi") veNghi();
    if (tabHienTai === "kiemtra") veKiemTra();
    if (tabHienTai === "ai") veAi();
    if (tabHienTai === "cauTruc") veCauTruc();
    if (tabHienTai === "tudien") veTudien();
  });

  docTudien().then(() => {
    veTong();
    if (!CO_CHROME) thongBao("Đang mở file trực tiếp (ngoài tiện ích). Vẫn tải được dữ liệu; từ điển và mã bí mật chỉ lưu trên trình duyệt này. Khuyên dùng: mở trang này bằng nút “Xem & Chuẩn hóa” trong tiện ích.", "warn");
    else thongBao("Nhập mã bí mật rồi bấm “Tải toàn bộ dữ liệu”.", "ok");
  }).catch((e) => thongBao("Lỗi khởi động trang: " + (e && e.message), "loi"));
})();