// Trang cây dữ liệu đám mây: xem + sửa trực tiếp từng hồ sơ, nút Lưu mỗi hồ sơ.
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
  const MA_MAC_DINH = "uPjRMZvtogiFls0X2n71sd5o098RcsPdVfxjPUBm";
  const CO_CHROME = typeof chrome !== "undefined" && !!(chrome.storage && chrome.storage.local);
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
  $("secret").value = MA_MAC_DINH;
  KHO.get("fbSecret").then((v) => { if (v) $("secret").value = v; });
  $("secret").onchange = () => KHO.set({ fbSecret: $("secret").value.trim() });

  function thongBao(t, lop) { $("tb").innerHTML = ""; if (t) $("tb").append(el("div", { className: "thongbao " + (lop || "ok"), textContent: t })); }
  function sachChuoiFb(s){var r="";for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c===65534||c===65535||c===127)continue;if(c<32&&c!==9&&c!==10&&c!==13)continue;if(c>=55296&&c<=57343){var hi=c<=56319;var nx=i+1<s.length?s.charCodeAt(i+1):0;var pv=i>0?s.charCodeAt(i-1):0;if((hi&&nx>=56320&&nx<=57343)||(!hi&&pv>=55296&&pv<=56319)){r+=s[i];}continue;}r+=s[i];}return r;}
  function sachKhoaFb(k){return sachChuoiFb(String(k)).split(".").join("_").split("$").join("_").split("#").join("_").split("[").join("_").split("]").join("_").split("/").join("_")||"_";}
  function sachFb(v){if(v===undefined||v===null)return null;if(typeof v==="string")return sachChuoiFb(v);if(typeof v==="number")return Number.isFinite(v)?v:null;if(typeof v==="boolean")return v;if(Array.isArray(v))return v.map(sachFb);if(typeof v==="object"){var o={};for(var k in v){if(!Object.prototype.hasOwnProperty.call(v,k))continue;var x=v[k];if(x===undefined)continue;o[sachKhoaFb(k)]=sachFb(x);}return o;}return String(v);}
  function sachFbRoot(o){if(o===undefined||o===null||typeof o!=="object"||Array.isArray(o))return sachFb(o);var r={};for(var k in o){if(!Object.prototype.hasOwnProperty.call(o,k))continue;r[k]=sachFb(o[k]);}return r;}
  async function fb(method, path, body) {
    const secret = $("secret").value.trim();
    if (!secret) throw new Error("Chưa nhập mã bí mật cơ sở dữ liệu.");
    const r = await fetch(`${FB_URL}/${path}.json?auth=${encodeURIComponent(secret)}`,
      { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(sachFbRoot(body)) });
    const t = await r.text();
    if (!r.ok) { let m = t; try { m = JSON.parse(t).error || t; } catch (e) {} throw new Error(r.status === 401 || /permission|auth/i.test(m) ? "Sai mã bí mật hoặc không có quyền." : `Lỗi ${r.status}: ${m}`); }
    return t ? JSON.parse(t) : null;
  }

  const kd = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  let DS = [];

  // ---------- Tải ----------
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
        lo.forEach((id, j) => {
          if (!rs[j]) return;
          DS.push({
            id, idx: ds0[id] || {}, data: rs[j] || {},
            wIdx: clone(ds0[id] || {}), wData: clone(rs[j] || {}),
            dirty: false, mo: false, daVe: false,
          });
        });
        xong += lo.length;
        $("lanTai").textContent = `Đã tải ${xong}/${ids.length} hồ sơ…`;
      }
      $("lanTai").textContent = `Đã tải ${DS.length} hồ sơ lúc ${new Date().toLocaleTimeString("vi-VN")}`;
      thongBao(`Đã tải ${DS.length} hồ sơ. Bấm vào từng hồ sơ để mở cây, sửa rồi bấm Lưu hồ sơ.`, "ok");
      veDanhSach();
    } catch (e) { thongBao("Lỗi: " + e.message, "loi"); }
    finally { $("tai").disabled = false; }
  }

  // ---------- Vẽ danh sách ----------
  const nhanTT = (x) => {
    const t = x.wIdx.trangThai || "";
    if (t === "đã nhập tự động") return ["Đã nhập tự động", "tu"];
    if (/đã rà soát/i.test(t)) return ["Đã rà soát", "xong"];
    if (t) return [t, "tu"];
    return ["Chưa nhập", "chua"];
  };
  function veDanhSach() {
    const box = $("khuDs"); box.innerHTML = "";
    const q = kd($("tim").value.trim());
    const ds = DS.filter((x) => !q || kd(`${x.wIdx.ten} ${x.wIdx.cccd} ${x.id}`).includes(q));
    for (const x of ds) {
      const [ntt, lop] = nhanTT(x);
      const sec = el("div", { className: "hs" });
      const nutMo = el("button", { className: "nho", textContent: x.mo ? "▲ Thu gọn" : "▼ Mở cây dữ liệu" });
      const nutLuu = el("button", { className: "xanh nho luu", textContent: x.dirty ? "💾 Lưu hồ sơ (có thay đổi)" : "💾 Lưu hồ sơ", disabled: !x.dirty });
      const nutHoan = el("button", { className: "nho", textContent: "↩ Hoàn tác", disabled: !x.dirty, title: "Bỏ mọi thay đổi chưa lưu, tải lại dữ liệu gốc" });
      nutMo.onclick = () => { x.mo = !x.mo; veDanhSach(); };
      nutLuu.onclick = () => luuHoSo(x, nutLuu);
      nutHoan.onclick = () => { x.wIdx = clone(x.idx); x.wData = clone(x.data); x.dirty = false; x.daVe = false; veDanhSach(); };
      x._nutLuu = nutLuu; x._nutHoan = nutHoan;
      sec.append(el("div", { className: "dau" },
        el("b", { textContent: x.wIdx.ten || "(chưa có họ tên)" }),
        el("span", { className: "mo", textContent: `${x.wIdx.cccd || x.id} · mã ${x.id}` }),
        el("span", { className: "nhan " + lop, textContent: ntt }),
        el("span", { className: "mo", textContent: `${Object.keys(x.wData.hoSo || {}).length} ô B1` }),
        nutMo, nutLuu, nutHoan));
      if (x.mo) {
        const than = el("div", { className: "than cay" });
        than.append(el("div", { className: "mo", textContent: "Chỉ mục dsHoSo/" + x.id }));
        veNut(than, x.wIdx, [], x, "idx");
        than.append(el("div", { className: "mo", textContent: "Hồ sơ chi tiết hoso/" + x.id, style: "margin-top:8px" }));
        veNut(than, x.wData, [], x, "data");
        sec.append(than);
        x.daVe = true;
      }
      box.append(sec);
    }
    if (!ds.length) box.append(el("p", { className: "mo", textContent: DS.length ? "Không có hồ sơ phù hợp." : "Chưa tải dữ liệu." }));
  }
  const danhDauDoi = (x) => {
    x.dirty = true;
    if (x._nutLuu) { x._nutLuu.disabled = false; x._nutLuu.textContent = "💾 Lưu hồ sơ (có thay đổi)"; }
    if (x._nutHoan) x._nutHoan.disabled = false;
  };

  // ---------- Vẽ cây ----------
  // obj: object đang sửa (wIdx/wData), goc: "idx"|"data" để biết PATCH đường nào
  function veNut(box, obj, duong, x, goc) {
    if (obj !== null && typeof obj === "object") {
      const keys = Object.keys(obj);
      if (!keys.length) box.append(el("span", { className: "mo", textContent: Array.isArray(obj) ? "(mảng rỗng)" : "(trống)" }));
      for (const k of keys) veLa(box, k, obj[k], [...duong, k], x, goc, obj);
      box.append(nutThem(box, obj, duong, x, goc));
    } else {
      box.append(el("span", { className: "mo", textContent: "(giá trị gốc không phải object – không sửa được ở đây)" }));
    }
  }
  function veLa(box, k, v, duong, x, goc, cha) {
    const tenDuong = duong.join("/");
    if (v !== null && typeof v === "object") {
      const n = Array.isArray(v) ? `${v.length} dòng` : `${Object.keys(v).length} khóa`;
      x._moNhanh = x._moNhanh || new Set();
      const det = el("details", { open: x._moNhanh.has(tenDuong) });
      det.ontoggle = () => { det.open ? x._moNhanh.add(tenDuong) : x._moNhanh.delete(tenDuong); };
      det.append(el("summary", {}, el("span", { textContent: Array.isArray(cha) ? `[${k}] ` : k + " " }), el("span", { className: "dem", textContent: `(${n})` })));
      const than = el("div");
      det.append(than, nutThem(than, v, duong, x, goc));
      const nutXoa = el("button", { className: "nho nutXoa", textContent: "✕ Xóa nhánh", title: "Xóa toàn bộ nhánh này khi Lưu" });
      nutXoa.onclick = () => { xoaKhoa(cha, k, x, goc); veDanhSach(); };
      det.append(nutXoa);
      veNut(than, v, duong, x, goc);
      box.append(det);
    } else {
      box.append(laGiaTri(k, v, () => xoaKhoa(cha, k, x, goc), (moi) => { cha[k] = moi; danhDauDoi(x); }, tenDuong));
    }
  }
  function laGiaTri(k, v, onXoa, onSua, tenDuong) {
    const dong = el("div", { className: "la", title: tenDuong });
    dong.append(el("span", { className: "k", textContent: k }));
    if (typeof v === "boolean") {
      const cb = el("input", { type: "checkbox", checked: !!v, title: "Tích/bỏ tích rồi bấm Lưu hồ sơ" });
      cb.onchange = () => onSua(cb.checked);
      dong.append(cb, el("span", { className: "kieu", textContent: "đúng/sai" }));
    } else if (v === null) {
      const inp = el("input", { type: "text", value: "", placeholder: "(null) – gõ để đặt giá trị" });
      inp.onchange = () => onSua(inp.value);
      dong.append(inp, el("span", { className: "kieu null", textContent: "null" }));
    } else if (typeof v === "number") {
      const inp = el("input", { type: "text", value: String(v) });
      inp.onchange = () => { const n = Number(inp.value); onSua(inp.value === "" ? "" : (isNaN(n) ? inp.value : n)); };
      dong.append(inp, el("span", { className: "kieu", textContent: "số" }));
    } else {
      const s = String(v);
      const inp = s.length > 100 ? el("textarea", { value: s }) : el("input", { type: "text", value: s });
      inp.onchange = () => onSua(inp.value);
      dong.append(inp, el("span", { className: "kieu", textContent: "chữ" }));
    }
    const nutXoa = el("button", { className: "nho nutXoa", textContent: "✕", title: "Xóa khóa này khi Lưu" });
    nutXoa.onclick = () => { onXoa(); veDanhSach(); };
    dong.append(nutXoa);
    return dong;
  }
  function xoaKhoa(cha, k, x, goc) {
    if (Array.isArray(cha)) cha.splice(Number(k), 1);
    else cha[k] = null; // null để Firebase xóa khóa khi PATCH
    danhDauDoi(x);
  }
  function nutThem(box, obj, duong, x, goc) {
    const hang = el("div", { className: "themKhoa" });
    if (Array.isArray(obj)) {
      const nut = el("button", { className: "nho", textContent: "+ Thêm dòng (object rỗng)" });
      nut.onclick = () => { obj.push({}); danhDauDoi(x); veDanhSach(); };
      hang.append(nut);
    } else {
      const inp = el("input", { type: "text", placeholder: "Tên khóa mới…", style: "width:170px" });
      const nut = el("button", { className: "nho", textContent: "+ Thêm khóa" });
      nut.onclick = () => {
        const k = inp.value.trim();
        if (!k) return;
        if (/[.#$[\]/]/.test(k)) return thongBao(`Tên khóa không được chứa . # $ [ ] / : "${k}"`, "loi");
        if (k in obj) return thongBao(`Đã có khóa "${k}" rồi.`, "warn");
        obj[k] = "";
        danhDauDoi(x); veDanhSach();
      };
      hang.append(inp, nut);
    }
    return hang;
  }

  // ---------- Lưu / tải lại ----------
  async function luuHoSo(x, nut) {
    nut.disabled = true; nut.textContent = "Đang lưu…";
    try {
      await fb("PATCH", "hoso/" + encodeURIComponent(x.id), x.wData);
      await fb("PATCH", "dsHoSo/" + encodeURIComponent(x.id), x.wIdx);
      x.data = clone(x.wData); x.idx = clone(x.wIdx); x.dirty = false;
      thongBao(`Đã lưu hồ sơ "${x.wIdx.ten || x.id}".`, "ok");
      veDanhSach();
    } catch (e) { nut.disabled = false; nut.textContent = "💾 Lưu hồ sơ (có thay đổi)"; thongBao("Không lưu được: " + e.message, "loi"); }
  }

  // ---------- Điều khiển ----------
  $("tai").onclick = taiTatCa;
  $("tim").oninput = () => veDanhSach();
  thongBao("Nhập mã bí mật rồi bấm “Tải toàn bộ dữ liệu”.", "ok");
})();
