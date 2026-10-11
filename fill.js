// Bộ máy so sánh & điền – tiêm vào trang hồ sơ đảng viên (sau fields.js).
// Nguyên tắc: KHÔNG thay đổi ô đã có dữ liệu nếu người dùng chưa xác nhận.
(() => {
  if (window.__dhsVer === 9) return;
  window.__dhsVer = 9;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const chuan = (s) => (s == null ? "" : String(s)).normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => [...root.querySelectorAll(sel)];
  const click = (el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  const host = (key) => q(`[formcontrolname="${key}"]`);
  const TRUONG = () => window.__dhsTRUONG || window.TRUONG_HO_SO || [];
  // Ô tích (gia đình liệt sỹ, có công): file có ghi bất kỳ nội dung nào => "Có"; để trống hoặc ghi Không/0 => không tích
  const laCo = (v) => { const x = chuan(v); return !!x && !["không", "khong", "0", "false", "no", "k"].includes(x); };
  const gui = (msg) => { try { chrome.runtime.sendMessage(msg); } catch (e) {} };

  // ---------- điều khiển tạm dừng / dừng ----------
  const ctl = (window.__dhsCtl = { paused: false, stopped: false, running: false, auto: false });
  window.__dhsPause = (v) => { ctl.paused = !!v; veNutBang(); return ctl.paused; };
  window.__dhsStop = () => { ctl.stopped = true; ctl.paused = false; return true; };
  async function diemDung() {
    while (ctl.paused && !ctl.stopped) await sleep(250);
    if (ctl.stopped) throw new Error("__STOP__");
  }

  async function cho(fn, ms = 6000, buoc = 150) {
    for (let t = 0; t < ms; t += buoc) {
      const v = fn();
      if (v) return v;
      await sleep(buoc);
    }
    return null;
  }
  // Chờ có điều kiện bằng MutationObserver (nhận biết ngay khi DOM có option mới) + fallback poll 120ms.
  // Dùng thay cho sleep cứng ở các chỗ danh mục Xã/Phường tải chậm.
  function doiDoiO(fn, ms = 3000) {
    return new Promise((xong) => {
      let ob = null, tid = 0, roi = false;
      const ket = (v) => { if (roi) return; roi = true; clearInterval(tid); if (ob) ob.disconnect(); xong(v); };
      const thu = () => {
        if (roi) return true;
        let v = null;
        try { v = fn(); } catch (e) { v = null; }
        if (v) { ket(v); return true; }
        return false;
      };
      if (thu()) return;
      try { ob = new MutationObserver(thu); ob.observe(document.body, { childList: true, subtree: true }); } catch (e) { ob = null; }
      tid = setInterval(thu, 120);
      setTimeout(() => ket(null), ms);
    });
  }
  // ---------- Danh mục Quốc gia/Tỉnh/Xã: nhớ danh sách đã nạp để lần sau khỏi phải dò lại ----------
  const DM = (window.__dhsDM = { mem: new Map(), luu: 0 });
  const khoaDM = (key) => {
    const m = String(key || "").match(/^(.+?)(?:Province|Commune)Id$/);
    if (!m) return null;
    let tinh = "";
    if (/CommuneId$/.test(key)) { const hp = host(m[1] + "ProvinceId"); if (hp) tinh = chuan(q("vts-select-top-control", hp).innerText); }
    return m[1] + "|" + tinh;
  };
  function dmGhi(key, ds) {
    const k = khoaDM(key);
    if (!k || !ds || !ds.length) return;
    DM.mem.set(k, ds.map((x) => String(x).trim()).filter(Boolean));
    if (DM.luu) return;
    DM.luu = setTimeout(() => {
      DM.luu = 0;
      try { chrome.storage.session.set({ __dhsDM: Object.fromEntries(DM.mem) }).catch(() => {}); } catch (e) {}
    }, 800);
  }
  const dmCo = (key) => DM.mem.has(khoaDM(key));
  const demDM = (key) => (DM.mem.get(khoaDM(key)) || []).length;
  (async () => { try { const v = await chrome.storage.session.get("__dhsDM"); for (const [k, ds] of Object.entries(v.__dhsDM || {})) if (Array.isArray(ds) && ds.length) DM.mem.set(k, ds); } catch (e) {} })();
  function chonKhop(ds, gt) {
    const g = chuan(gt);
    let i = ds.findIndex((t) => chuan(t) === g);
    if (i < 0) i = ds.findIndex((t) => g && chuan(t).includes(g));
    return i;
  }
  function datGiaTri(el, v) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  async function dongPopup() {
    const mo = q("vts-select.vts-select-open input");
    if (mo) mo.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true }));
    const bd = q(".cdk-overlay-backdrop");
    if (bd) click(bd);
    const close = q("vts-modal-container .vtsicon-Close\\:vts");
    if (close) click(close.closest("button") || close);
    await sleep(300);
  }
  function luaChonDangMo() {
    const panes = qa(".cdk-overlay-pane").filter((p) => p.querySelector("vts-option-item"));
    return panes.length ? qa("vts-option-item", panes[panes.length - 1]) : [];
  }
  const biKhoa = (key) => {
    const h = host(key);
    if (!h) return false;
    if (h.tagName === "VTS-SELECT") return h.className.includes("vts-select-disabled");
    if (h.tagName === "INPUT" || h.tagName === "TEXTAREA") return h.disabled || h.readOnly;
    return !!q("input:disabled", h);
  };

  // Trường bắt buộc: nhãn có lớp vts-form-item-required (dấu * đỏ trên trang)
  const batBuoc = (key) => {
    let p = host(key), lab = null;
    for (let i = 0; i < 5 && p && !lab; i++) { p = p.parentElement; lab = p && p.querySelector("label:not([formcontrolname])"); }
    return !!(lab && lab.classList.contains("vts-form-item-required"));
  };
  // ---------- đọc giá trị đang có trên trang ----------
  function docLai(key, kieu) {
    const h = host(key);
    if (!h) return null;
    if (kieu === "text" || kieu === "date" || kieu === "area") return h.value || "";
    if (kieu === "check") return q("input[type=checkbox]", h)?.checked ? "Có" : "";
    if (kieu === "pk") return q("input", h)?.value || "";
    if (kieu === "radio") {
      const l = q("label.vts-radio-wrapper-checked", h);
      return l ? l.innerText.trim() : "";
    }
    const t = q("vts-select-top-control", h).innerText.trim();
    return t.startsWith("--") ? "" : t;
  }
  function giongNhau(kieu, cu, moi) {
    const a = chuan(cu), b = chuan(moi);
    if (a === b) return true;
    if (kieu === "check") return (a === "có") === laCo(moi);
    if ((kieu === "select" || kieu === "org") && a && b && a.includes(b)) return true; // VD trang hiện "Chi bộ X, Đảng bộ Y…"
    return false;
  }

  // ---------- 1. SO SÁNH (chỉ đọc, không thay đổi gì) ----------
  // opt (tùy chọn): { truong: danh sách trường khác B1 (VD mục 6), khoa: mã trường để nhận biết đúng mục, ten: tên mục }
  window.__dhsSoSanh = (duLieu, opt) => {
    window.__dhsTRUONG = (opt && opt.truong) || null;
    if (!host((opt && opt.khoa) || "currentFullName")) return { loiChung: opt && opt.ten ? `Trang hiện tại không có biểu mẫu "${opt.ten}". Mở đúng mục của hồ sơ.` : "Trang hiện tại không có biểu mẫu Thông tin cơ bản của hồ sơ đảng viên." };
    const ds = [], thieu = [];
    for (const [key, nhan, kieu] of TRUONG()) {
      const moi = String(duLieu[key] ?? "").trim();
      if (!moi) {
        // Trường không có trong dữ liệu: nếu trên trang cũng trống (đang hiển thị, không khóa) thì báo còn thiếu
        if (kieu !== "check") { try { const cu = docLai(key, kieu); if (cu !== null && !chuan(cu) && !biKhoa(key)) thieu.push({ key, nhan, bb: batBuoc(key) }); } catch (e) {} }
        continue;
      }
      const cu = docLai(key, kieu);
      let tt;
      if (cu === null) tt = "an";
      else if (giongNhau(kieu, cu, moi)) tt = "trung";
      else if (biKhoa(key) && !/CommuneId$/.test(key) && !(opt && opt.boQuaKhoa)) tt = "khoa";
      else if (kieu === "check" ? cu !== "Có" : !chuan(cu)) tt = "trong";
      else tt = "khac";
      ds.push({ key, nhan, kieu, cu: cu ?? "", moi, tt });
    }
    // Kiểm tra đúng người: họ tên / số căn cước trên trang khác file => cảnh báo
    const canhBao = [];
    for (const k of ["currentFullName", "identifyNo", "birthDate"]) {
      const d = ds.find((x) => x.key === k);
      if (d && d.tt === "khac") canhBao.push(`${d.nhan}: trên trang "${d.cu}" ≠ file "${d.moi}"`);
    }
    return { ds, canhBao, thieu, url: location.pathname };
  };

  // ---------- các hàm điền ----------
  async function dienRadio(key, val) {
    const labels = qa(`[formcontrolname="${key}"] label`);
    const i = chonKhop(labels.map((l) => l.innerText), val);
    if (i < 0) throw new Error(`không có lựa chọn "${val}"`);
    labels[i].click();
  }
  // Danh sách thả xuống của ô đang mở. Lớp phủ cũ có thể còn sót trong DOM,
  // nên ưu tiên lớp phủ mới sinh sau khi bấm, nếu không thì lấy lớp phủ nằm sát ngay ô đó.
  let hDangMo = null, paneTruoc = new Set();
  const coDs = (p) => p.querySelector("vts-option-item, .vts-select-item-empty, vts-embed-empty, .vts-empty") || /Trống/.test(p.innerText);
  function paneDangMo() {
    if (!hDangMo || !hDangMo.className.includes("vts-select-open")) return null;
    const ps = qa(".cdk-overlay-pane").filter(coDs);
    const moi = ps.filter((p) => !paneTruoc.has(p));
    if (moi.length) return moi[moi.length - 1];
    const r = hDangMo.getBoundingClientRect();
    let tot = null, diem = 1e9;
    for (const p of ps) {
      const k = p.getBoundingClientRect();
      if (!k.width || !k.height) continue;
      const d = Math.abs(k.left - r.left) + Math.min(Math.abs(k.top - r.bottom), Math.abs(k.bottom - r.top));
      if (d < diem) { diem = d; tot = p; }
    }
    return diem < 120 ? tot : null;
  }
  // Tìm lựa chọn khớp trong danh sách đang mở; với danh sách cuộn ảo thì cuộn dần để tìm
  async function timTrongDs(val, cuon = true) {
    const g = chuan(val);
    const pane = paneDangMo();
    if (!pane) return null;
    const khop = (chinhXac) => qa("vts-option-item", pane).find((o) => (chinhXac ? chuan(o.innerText) === g : chuan(o.innerText).includes(g)));
    let o = khop(true);
    if (o) return o;
    const vp = cuon && q("cdk-virtual-scroll-viewport", pane);
    if (vp) {
      for (let y = 0; y <= vp.scrollHeight; y += Math.max(100, vp.clientHeight * 0.8)) {
        vp.scrollTop = y; vp.dispatchEvent(new Event("scroll"));
        await sleep(80);
        if ((o = khop(true))) return o;
      }
      vp.scrollTop = 0; vp.dispatchEvent(new Event("scroll")); await sleep(80);
    }
    return null;
  }
  // Tỉnh/Xã (khai sinh, quê quán, thường trú): lấy mục đầu tiên trong danh sách khi giá trị là "__FIRST__" hoặc không tìm thấy
  const DAU_TIEN = /^(birth|hometown|resident)(Province|Commune)Id$/;
  async function layDauTien(h) {
    const tim = q("input.vts-select-selection-search-input", h);
    const lay = () => { const p = paneDangMo(); return p ? qa("vts-option-item", p)[0] || null : null; };
    let o = await doiDoiO(lay, 2500);
    if (!o && tim) { datGiaTri(tim, "a"); o = await doiDoiO(lay, 4000); }
    return o || null;
  }
  // Tỉnh phụ thuộc Quốc gia, Xã phụ thuộc Tỉnh: chờ lâu hơn để trang tải danh mục (nhất là trang Thêm mới)
  const laDM = (key) => /(Nation|Province|Commune)Id$/.test(key);
  const boTienToan = (v) => String(v).replace(/^(xã|phường|thị trấn|đặc khu|tỉnh|thành phố)\s+/i, "");
  async function dienSelect(key, val) {
    const h = q(`vts-select[formcontrolname="${key}"]`);
    if (!h) throw new Error("ô không có trên trang");
    const laDanhMuc = laDM(key);
    // Ô bị khóa (Xã chờ Tỉnh): chờ mở khoá
    const moKhoa = await doiDoiO(() => !h.className.includes("vts-select-disabled"), laDanhMuc ? 15000 : 6000);
    if (!moKhoa) throw new Error("ô đang bị khóa trên trang");
    if (chuan(q("vts-select-top-control", h).innerText) === chuan(val)) return;
    if (q("vts-select.vts-select-open")) await dongPopup();
    h.scrollIntoView({ block: "center" });
    hDangMo = h;
    let mo = null;
    for (let lan = 0; lan < 3 && !mo; lan++) {
      paneTruoc = new Set(qa(".cdk-overlay-pane"));
      click(q("vts-select-top-control", h));
      mo = await doiDoiO(paneDangMo, 3000);
    }
    if (!mo) { await dongPopup(); throw new Error("danh sách không mở được"); }
    const first = val === "__FIRST__";
    const tim = q("input.vts-select-selection-search-input", h);
    const coDsMo = () => luaChonDangMo().length > 0;
    // Tìm option theo từ khóa đang gõ trong ô tìm kiếm
    const timTheoTK = (tk) => {
      const g = chuan(tk), pane = paneDangMo();
      if (!pane || !g) return null;
      return qa("vts-option-item", pane).find((o) => { const t = chuan(o.innerText); return !!t && (t === g || t.includes(g) || g.includes(t)); }) || null;
    };
    const choTK = (tk) => doiDoiO(() => timTheoTK(tk) || timTrongDs(val, false), 4000);
    const choDs = () => doiDoiO(coDsMo, 1200);
    let o = null;
    // Danh mục Xã/Phường tải theo từ khóa: gõ thẳng vào ô tìm kiếm thay vì chờ list rỗng rồi mới gõ (bớt ~1.5s mỗi ô)
    if (!first && !coDsMo() && tim) {
      datGiaTri(tim, boTienToan(val));
      o = await choTK(boTienToan(val));
      if (!o) datGiaTri(tim, "");
    }
    if (!o) {
      await choDs();
      o = first ? await layDauTien(h) : await timTrongDs(val);
    }
    // Danh sách tải theo từ khóa (VD Xã/Phường) hoặc quá dài: gõ vào ô tìm kiếm
    const tuKhoa = [val, boTienToan(val)];
    for (const tk of tuKhoa) {
      if (o || !tim || first) break;
      datGiaTri(tim, tk);
      o = await choTK(tk);
      if (!o) { // khớp một phần khi gõ từ khóa
        const pane = paneDangMo();
        const ds = pane ? qa("vts-option-item", pane) : [];
        const j = chonKhop(ds.map((x) => x.innerText), val);
        if (j >= 0 && ds.length <= 5) o = ds[j];
      }
    }
    if (!o && !first) {
      // Menu đã mở nhưng danh mục hiện chậm (VD "Là đảng viên" ở B8): chờ lựa chọn hiện ra rồi dò lại
      if (await doiDoiO(() => luaChonDangMo().length > 0, 5000)) o = await timTrongDs(val);
    }
    if (!o && !first && DAU_TIEN.test(key)) { if (tim) datGiaTri(tim, ""); o = await layDauTien(h); }
    if (!o) {
      const pane = paneDangMo();
      const soO = pane ? qa("vts-option-item", pane).length : 0;
      if (tim) datGiaTri(tim, "");
      await dongPopup();
      // Menu chưa có lựa chọn nào (danh mục chưa tải): báo lỗi thường, không tải lại trang nữa
      if (!soO) { throw new Error(`menu "${val}" chưa có lựa chọn nào (danh mục chưa tải)`); }
      throw new Error(first ? "danh sách trống, không chọn được mục đầu tiên" : `không tìm thấy lựa chọn "${val}"`);
    }
    o.scrollIntoView({ block: "nearest" });
    o.click();
    await sleep(400);
    // Nhớ danh mục vừa nạp: lần sau cùng tỉnh khỏi phải dò lại từ đầu
    if (laDanhMuc) dmGhi(key, luaChonDangMo().map((x) => x.innerText.trim()));
  }
  async function dienToChuc(key, val) {
    const h = q(`vts-select[formcontrolname="${key}"]`);
    h.scrollIntoView({ block: "center" });
    click(q("vts-select-top-control", h));
    const dlg = await cho(() => q("app-organization-dialog vts-tree-node") && q("app-organization-dialog"), 10000);
    if (!dlg) throw new Error("hộp thoại chọn tổ chức không mở được");
    const g = chuan(val);
    const tim = () => {
      const hit = qa("vts-tree-node", dlg).filter((n) => chuan(n.getAttribute("title")).includes(g));
      const exact = hit.filter((n) => {
        const t = chuan(n.getAttribute("title"));
        return t === g || t.split(" - ").slice(1).join(" - ") === g || t.split(" - ")[0] === g;
      });
      return exact[0] || hit[hit.length - 1] || null;
    };
    let node = tim();
    for (let cap = 0; !node && cap < 4; cap++) {
      const dong = qa("vts-tree-node-switcher.vts-tree-switcher_close", dlg);
      if (!dong.length) break;
      dong.forEach((s) => click(s));
      await sleep(1500);
      node = tim();
    }
    if (!node) { await dongPopup(); throw new Error(`không tìm thấy tổ chức "${val}"`); }
    node.scrollIntoView({ block: "center" });
    click(q("vts-tree-node-title", node));
    await cho(() => !q("app-organization-dialog"), 5000);
  }
  async function dienText(key, val) {
    const el = q(`input[formcontrolname="${key}"], textarea[formcontrolname="${key}"]`);
    if (el.disabled || el.readOnly) throw new Error("ô đang bị khóa trên trang");
    el.scrollIntoView({ block: "center" });
    el.focus();
    datGiaTri(el, val);
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }
  async function dienNgay(key, val) {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(val)) throw new Error(`ngày "${val}" phải có dạng dd/mm/yyyy`);
    await dienText(key, val);
  }
  // Ô chọn ngày/tháng/năm (vts-date-picker): gõ đúng mẫu trong ô (yyyy | mm/yyyy | dd/mm/yyyy) rồi Enter
  async function dienPk(key, val) {
    const h = q(`vts-date-picker[formcontrolname="${key}"]`) || host(key);
    if (!h) throw new Error("không thấy ô trên trang");
    const inp = q("input", h) || h;
    if (inp.disabled || h.className.includes("disabled")) throw new Error("ô đang bị khóa trên trang");
    const mau = (inp.placeholder || "").trim();
    const re = mau === "yyyy" ? /^\d{4}$/ : mau === "mm/yyyy" ? /^\d{2}\/\d{4}$/ : mau === "dd/mm/yyyy" ? /^\d{2}\/\d{2}\/\d{4}$/ : null;
    if (re && !re.test(val)) throw new Error(`"${val}" phải có dạng ${mau}`);
    h.scrollIntoView({ block: "center" });
    click(inp); inp.focus();
    await sleep(300);
    datGiaTri(inp, val);
    await sleep(300);
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    await sleep(400);
    inp.dispatchEvent(new Event("blur", { bubbles: true }));
    click(h.closest("form") || h.closest("vts-modal-container") || document.body); // bấm ra ngoài để đóng bảng chọn (không dùng Esc vì Esc xóa giá trị)
    await sleep(400);
    if (inp.value !== val) throw new Error(`trang không nhận "${val}" (đang hiện "${inp.value}")`);
  }
  async function dienCheck(key, val) {
    const h = host(key);
    const cb = q("input[type=checkbox]", h);
    const muon = laCo(val);
    if (cb && cb.checked !== muon) h.click();
  }
  const HAM = { radio: dienRadio, select: dienSelect, org: dienToChuc, text: dienText, area: dienText, date: dienNgay, check: dienCheck, pk: dienPk };

  // ---------- bảng tiến độ trên trang ----------
  // Bảng tiến độ trên trang: kéo thả được (giữ chuột ở thanh tiêu đề đỏ), thu nhỏ được; nhớ vị trí trong phiên.
  let thuNho = false;
  try { thuNho = sessionStorage.getItem("__dhs_thuNho") === "1"; } catch (e) {}
  function bang() {
    let b = q("#__dhs_panel");
    if (!b) {
      b = document.createElement("div");
      b.id = "__dhs_panel";
      b.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;width:330px;max-height:55vh;overflow:auto;background:#fff;border:1px solid #c8102e;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.2);font:13px/1.4 Segoe UI,Arial,sans-serif;color:#1f2328";
      try {
        const vt = JSON.parse(sessionStorage.getItem("__dhs_viTri") || "null");
        if (vt) datViTri(b, vt.x, vt.y);
      } catch (e) {}
      // Kéo thả
      b.addEventListener("mousedown", (e) => {
        if (!e.target.closest("#__dhs_head") || e.target.closest("button")) return;
        e.preventDefault();
        const r = b.getBoundingClientRect();
        const dx = e.clientX - r.left, dy = e.clientY - r.top;
        const di = (ev) => datViTri(b, ev.clientX - dx, ev.clientY - dy);
        const tha = () => {
          document.removeEventListener("mousemove", di);
          document.removeEventListener("mouseup", tha);
          const k = b.getBoundingClientRect();
          try { sessionStorage.setItem("__dhs_viTri", JSON.stringify({ x: k.left, y: k.top })); } catch (er) {}
        };
        document.addEventListener("mousemove", di);
        document.addEventListener("mouseup", tha);
      });
      document.body.appendChild(b);
    }
    return b;
  }
  function datViTri(b, x, y) {
    const w = b.offsetWidth || 330, h = b.offsetHeight || 60;
    x = Math.max(0, Math.min(window.innerWidth - Math.min(w, 120), x));
    y = Math.max(0, Math.min(window.innerHeight - 40, y));
    b.style.left = x + "px"; b.style.top = y + "px";
    b.style.right = "auto"; b.style.bottom = "auto";
    void h;
  }
  let tieuDeBang = "", dongBang = [], xongBang = false;
  function veNutBang() {
    const n = q("#__dhs_pause");
    if (n) n.textContent = ctl.paused ? "▶ Tiếp tục" : "❚❚ Tạm dừng";
    const t = q("#__dhs_title");
    if (t && !xongBang) t.textContent = (ctl.paused ? "ĐANG TẠM DỪNG – " : "") + tieuDeBang;
  }
  function veBang(tieuDe, dong, xong) {
    tieuDeBang = tieuDe; dongBang = dong; xongBang = xong;
    const b = bang();
    b.innerHTML = "";
    b.style.width = thuNho ? "240px" : "330px";
    const h = document.createElement("div");
    h.id = "__dhs_head";
    h.title = "Giữ chuột ở đây để kéo bảng sang chỗ khác";
    h.style.cssText = "background:#c8102e;color:#fff;padding:8px 12px;font-weight:600;cursor:move;user-select:none;position:sticky;top:0";
    const dau = document.createElement("div");
    dau.style.cssText = "display:flex;gap:6px;align-items:flex-start";
    const keo = document.createElement("span");
    keo.textContent = "⠿";
    keo.style.cssText = "opacity:.8";
    const t = document.createElement("div");
    t.id = "__dhs_title";
    t.style.cssText = "flex:1";
    const nho = document.createElement("button");
    nho.type = "button";
    nho.textContent = thuNho ? "▢" : "—";
    nho.title = thuNho ? "Mở rộng" : "Thu nhỏ";
    nho.style.cssText = "border:1px solid #fff;border-radius:4px;background:transparent;color:#fff;font:inherit;cursor:pointer;padding:0 6px;line-height:18px";
    nho.onclick = () => {
      thuNho = !thuNho;
      try { sessionStorage.setItem("__dhs_thuNho", thuNho ? "1" : "0"); } catch (e) {}
      veBang(tieuDeBang, dongBang, xongBang);
    };
    dau.append(keo, t, nho);
    h.appendChild(dau);
    const nut = document.createElement("div");
    nut.style.cssText = "display:flex;gap:6px;margin-top:6px";
    const mk = (id, txt, fn) => {
      const x = document.createElement("button");
      x.id = id; x.textContent = txt; x.type = "button";
      x.style.cssText = "flex:1;padding:4px;border:1px solid #fff;border-radius:4px;background:transparent;color:#fff;font:inherit;cursor:pointer";
      x.onclick = fn;
      nut.appendChild(x);
    };
    if (!xong) {
      mk("__dhs_pause", "", () => { window.__dhsPause(!ctl.paused); gui({ type: "dhs-pause", paused: ctl.paused }); });
      mk("__dhs_stop", "■ Dừng hẳn", () => { window.__dhsStop(); });
    } else {
      mk("__dhs_close", "Đóng bảng", () => b.remove());
    }
    if (!thuNho) h.appendChild(nut);
    b.appendChild(h);
    const body = document.createElement("div");
    body.style.cssText = "padding:8px 12px" + (thuNho ? ";display:none" : "");
    for (const d of dong) {
      const p = document.createElement("div");
      p.style.cssText = "padding:3px 0;border-bottom:1px solid #eee";
      p.textContent = (d.ok ? "✔ " : "✘ ") + d.nhan + (d.ok ? "" : " — " + d.loi);
      p.style.color = d.ok ? "#1a7f37" : "#c8102e";
      body.appendChild(p);
    }
    if (xong) {
      const n = document.createElement("div");
      n.style.cssText = "margin-top:6px;color:#555;font-size:12px";
      n.textContent = ctl.auto || window.__dhsAutoLib && document.querySelector(".__dhs_nghi, .__dhs_nghi_dong") ? "Ô/dòng viền đỏ: AI chưa chắc – đối chiếu hồ sơ gốc." : "Kiểm tra lại trang rồi tự bấm Lưu.";
      body.appendChild(n);
    }
    b.appendChild(body);
    veNutBang();
    if (xong) q("#__dhs_title").textContent = tieuDe;
  }

  // ---------- 2. ĐIỀN các ô đã được chọn ----------
  // muc: [{key, moi, cu}] – cu là giá trị lúc so sánh, dùng để chặn ghi đè nếu trang đã đổi
  async function dienCore(muc) {
    const kieuCua = Object.fromEntries(TRUONG().map((t) => [t[0], t]));
    const chon = new Set(muc.map((m) => m.key));
    // Ảnh chụp các ô KHÔNG được chọn, để phát hiện thay đổi ngoài ý muốn
    const anhChup = TRUONG().filter(([k]) => !chon.has(k) && host(k)).map(([k, n, ki]) => [k, n, ki, docLai(k, ki)]);
    const kq = [];
    let n = 0, dung = false;
    for (const m of muc) {
      const [key, nhan, kieu] = kieuCua[m.key];
      n++;
      veBang(`Đang điền ${n}/${muc.length}: ${nhan}`, kq.filter((d) => !d.ok), false);
      gui({ type: "dhs-progress", n, tong: muc.length, nhan, paused: ctl.paused });
      try {
        await diemDung();
      } catch (e) { dung = true; break; }
      if (!host(key)) { kq.push({ key, nhan, ok: false, loi: "ô không hiển thị trên trang" }); continue; }
      const hienTai = docLai(key, kieu);
      if (giongNhau(kieu, hienTai, m.moi)) { kq.push({ key, nhan, ok: true, hien: hienTai, cu: "" }); continue; }
      // Trang tự xóa ô phụ thuộc (VD đổi Tỉnh thì Xã bị xóa) thì vẫn điền; chỉ bỏ qua khi ô bị đổi sang giá trị khác
      if (chuan(hienTai) && !giongNhau(kieu, hienTai, m.cu) && chuan(hienTai) !== chuan(m.cu)) {
        kq.push({ key, nhan, ok: false, loi: `bỏ qua: giá trị trên trang đã đổi thành "${hienTai}" sau khi so sánh` });
        continue;
      }
      try {
        await HAM[kieu](key, m.moi);
        await sleep(200);
        // Vừa chọn Quốc gia/Tỉnh: chờ trang tải danh mục phụ thuộc trước khi sang ô kế tiếp
        if (kieu === "select" && /(Nation|Province)Id$/.test(key)) {
          // Chờ ô Xã/Phường phụ thuộc mở khoá (thường <300ms) thay vì chờ cứng 1.5s
          const kx = key.replace(/(Nation|Province)Id$/, "CommuneId");
          await doiDoiO(() => { const e = host(kx); return e && !e.className.includes("vts-select-disabled"); }, 1500);
        }
        kq.push({ key, nhan, ok: true, hien: docLai(key, kieu), cu: m.cu });
      } catch (e) {
        kq.push({ key, nhan, ok: false, loi: e.message });
      }
    }
    // Hậu kiểm: ô không được chọn mà bị đổi (VD trang tự xóa Xã khi đổi Tỉnh)
    const biDoi = [];
    for (const [k, nhan, ki, truoc] of anhChup) {
      const sau = docLai(k, ki);
      if (chuan(sau) !== chuan(truoc)) biDoi.push({ key: k, nhan, ok: false, loi: `trang tự đổi "${truoc}" → "${sau}" (không do tiện ích chọn). Kiểm tra lại!` });
    }
    return { kq, biDoi, dung };
  }

  // ---------- 2. ĐIỀN các ô đã được chọn ----------
  // muc: [{key, moi, cu}] – cu là giá trị lúc so sánh, dùng để chặn ghi đè nếu trang đã đổi
  window.__dhsDien = (muc) => {
    if (ctl.running) return { loiChung: "Đang điền một hồ sơ khác." };
    ctl.running = true; ctl.paused = false; ctl.stopped = false;
    (async () => {
      let r = { kq: [], biDoi: [], dung: false };
      try { r = await dienCore(muc); } catch (e) { r.kq.push({ nhan: "Lỗi", ok: false, loi: e.message }); }
      const loi = r.kq.filter((d) => !d.ok).concat(r.biDoi);
      const tieuDe = (r.dung ? "ĐÃ DỪNG HẲN – " : "Xong: ") + `${r.kq.filter((d) => d.ok).length}/${muc.length} ô đã điền` + (loi.length ? `, ${loi.length} cần xem` : "");
      veBang(tieuDe, loi, true);
      ctl.running = false;
      gui({ type: "dhs-done", ...r });
    })();
    return { batDau: true };
  };
  // Chế độ tự động: chờ điền xong rồi trả kết quả (không gửi tin "dhs-done")
  window.__dhsDienCho = async (muc, truong) => {
    if (ctl.running) return { loiChung: "Đang chạy một việc khác." };
    window.__dhsTRUONG = truong || null;
    ctl.running = true; ctl.paused = false; ctl.stopped = false;
    try { return await dienCore(muc); }
    catch (e) { return { kq: [{ nhan: "Lỗi", ok: false, loi: e.message }], biDoi: [], dung: false }; }
    finally { ctl.running = false; }
  };

  // Dùng chung cho bước 8 (fill_qh.js)
  window.__dhsLib = { sleep, chuan, q, qa, click, host, cho, doiDoiO, datGiaTri, dongPopup, dienSelect, dienText, dienPk, docLai, diemDung, ctl, gui, veBang, laCo, dmGhi, dmCo, demDM, khoaDM };

  // ---------- 3. Theo dõi nút Lưu ----------
  if (!window.__dhsNghe) {
    window.__dhsNghe = true;
    document.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("button");
      if (!b || !/^lưu/i.test(chuan(b.innerText)) || ctl.auto) return; // chế độ tự động tự xử lý sau khi Lưu
      const khac = ["familyMemberId", "companyName", "householdAnnualIncome", "leaveDate", ...Object.values(window.DS_THEM || {}).map((c) => c.formKey)];
      if (q(khac.map((k) => `[formcontrolname="${k}"]`).join(", "))) return; // nút Lưu của bước 2/8/9: do fill_ds.js / fill_kt.js xử lý
      setTimeout(() => {
        const loi = qa(".form-control-error-general").map((x) => x.innerText.trim()).filter(Boolean);
        gui({ type: "dhs-saved", nut: b.innerText.trim(), loi: [...new Set(loi)].slice(0, 5), url: location.pathname });
      }, 2000);
    }, true);
  }
})();
