const $ = (id) => document.getElementById(id);
const KHOA = TRUONG_HO_SO.map((t) => t[0]);
const KIEU = Object.fromEntries(TRUONG_HO_SO.map((t) => [t[0], t[2]]));
const NHOM = Object.fromEntries(TRUONG_HO_SO.map((t) => [t[0], t[3]]));

// Trường các bước dạng danh sách và bước 9 (khớp fill_ds.js, fill_kt.js, file Excel)
const DS_BUOC = {
  qtct: { ten: "Quá trình công tác", sheet: "QuaTrinhCongTac", don: "dòng công tác", truong: [
    ["fromDate", "Từ tháng/năm"], ["toDate", "Đến tháng/năm"], ["nationId", "Quốc gia"], ["companyName", "Tên tổ chức"],
    ["partyPositionIds", "Chức vụ đảng (cách nhau dấu ;)"], ["concurrentPartyPosition", "Chức vụ Đảng kiêm nhiệm"],
    ["companyPosition", "Chức danh, chức vụ, nghề nghiệp"], ["note", "Ghi chú"]],
    nhan: (x) => `${x.fromDate || "?"}${x.toDate ? " – " + x.toDate : ""}: ${x.companyName || x.companyPosition || ""}` },
  qh: { ten: "Quan hệ gia đình", sheet: "QuanHeGiaDinh", don: "người thân", truong: [
    ["type", "Phân loại"], ["familyMemberId", "Quan hệ"], ["isPartyMember", "Là đảng viên"], ["fullName", "Họ và tên"],
    ["identifyNo", "Số căn cước"], ["birthDate", "Năm sinh"], ["currentStatus", "Tình trạng (qua đời/ly hôn)"],
    ["finishedYear", "Năm qua đời/ly hôn"], ["currentJob", "Công việc"], ["nationalityId", "Quốc tịch"],
    ["nationId", "Nơi ở hiện nay"], ["residentPlace", "Chi tiết nơi ở"], ["hometown", "Quê quán"], ["note", "Ghi chú"]],
    nhan: (x) => `${x.familyMemberId || "?"}: ${x.fullName || ""}${x.birthDate ? " (" + x.birthDate + ")" : ""}` },
};
DS_BUOC.qtct.so = "B2"; DS_BUOC.qh.so = "B8";
for (const [b, c] of Object.entries(DS_THEM)) DS_BUOC[b] = { so: c.so, ten: c.ten, sheet: c.sheet, don: c.don, truong: c.truong.map((t) => [t[0], t[1]]), bb: c.truong.filter((t) => t[3]).map((t) => t[0]), nhan: c.nhan };
const DS_KEYS = Object.keys(DS_BUOC);
const theoDS = (f) => Object.fromEntries(DS_KEYS.map((k) => [k, f()]));
const KT_TRUONG = [
  ["householdAnnualIncome", "Tổng thu nhập hộ/năm (đồng)"], ["perCapitaAnnualIncome", "Thu nhập bình quân đầu người (đồng)"],
  ["economicActivity", "Hoạt động kinh tế"], ["countWorker", "Số lao động thuê mướn"],
  ["nhaCapLoai", "Nhà được cấp/thuê – loại"], ["nhaCapDienTich", "Nhà được cấp/thuê – m2"],
  ["nhaMuaLoai", "Nhà tự mua/xây – loại"], ["nhaMuaDienTich", "Nhà tự mua/xây – m2"],
  ["datCap", "Đất được cấp (m2)"], ["datMua", "Đất tự mua (m2)"], ["datTrangTrai", "Đất trang trại (ha)"],
  ["taiSan1Ten", "Tài sản 1 – tên"], ["taiSan1GiaTri", "Tài sản 1 – giá trị (đồng)"],
  ["taiSan2Ten", "Tài sản 2 – tên"], ["taiSan2GiaTri", "Tài sản 2 – giá trị (đồng)"],
  ["taiSan3Ten", "Tài sản 3 – tên"], ["taiSan3GiaTri", "Tài sản 3 – giá trị (đồng)"],
];

let tdKichHoat = false; // chỉ tự chạy hồ sơ kế tiếp sau khi người dùng đã bấm "Bắt đầu chạy"
let hoSo = [], daLuu = {}, ssHienTai = null, tabDien = null, dangChay = false, choTrangMoi = false, buocDangChay = null;
let dsSS = theoDS(() => null), dsTT = theoDS(() => ({})), dsChayIdx = theoDS(() => []), ktSS = null, ddSS = null;

const pad = (n) => String(n).padStart(2, "0");
const el = (tag, props = {}, ...con) => { const e = Object.assign(document.createElement(tag), props); e.append(...con); return e; };
function trangThai(id, s, kieu) { $(id).textContent = s; $(id).className = "tt" + (kieu ? " " + kieu : ""); }
const luu = () => chrome.storage.session.set({ hoSo, daLuu, chon: Number($("ds").value) || 0 });
const chiSo = () => Number($("ds").value);
const hs = () => hoSo[chiSo()];

// ================= ĐỌC EXCEL =================
function docExcel(buf) {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets["HoSo"] || wb.Sheets[wb.SheetNames.find((n) => !["HuongDan", "DanhMuc"].includes(n))];
  if (!ws) throw new Error("Không thấy trang tính HoSo.");
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const giaTri = (r, c) => { const cell = ws[XLSX.utils.encode_cell({ r, c })]; return !cell || cell.v == null ? "" : String(cell.w ?? cell.v).trim(); };
  let dongMa = -1, cot = {};
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 9); r++) {
    const m = {};
    for (let c = range.s.c; c <= range.e.c; c++) { const v = giaTri(r, c); if (KHOA.includes(v)) m[v] = c; }
    if (Object.keys(m).length > Object.keys(cot).length) { cot = m; dongMa = r; }
  }
  if (dongMa < 0 || Object.keys(cot).length < 5) throw new Error("Không nhận ra mẫu: thiếu dòng mã trường (dòng 3 của file mẫu).");
  const kq = [];
  for (let r = dongMa + 1; r <= range.e.r; r++) {
    const d = {};
    for (const [k, c] of Object.entries(cot)) {
      let v = giaTri(r, c);
      if (KIEU[k] === "date") {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && typeof cell.v === "number" && cell.v > 1000 && cell.v < 80000) { const p = XLSX.SSF.parse_date_code(cell.v); v = `${pad(p.d)}/${pad(p.m)}/${p.y}`; }
      }
      if (v) d[k] = v;
    }
    if (Object.keys(d).length) { d.__dong = r + 1; kq.push(d); }
  }
  // Trang phụ: gắn theo số căn cước đảng viên (cột dangVienCanCuoc)
  const docPhu = (ten) => {
    const out = {};
    const w = wb.Sheets[ten];
    if (!w || !w["!ref"]) return out;
    const rq = XLSX.utils.decode_range(w["!ref"]);
    const v = (r, c) => { const x = w[XLSX.utils.encode_cell({ r, c })]; return x && x.v != null ? String(x.w ?? x.v).trim() : ""; };
    let dongMaPhu = -1, cotP = {};
    for (let r = 0; r <= Math.min(rq.e.r, 9) && dongMaPhu < 0; r++) {
      const m = {};
      for (let c = rq.s.c; c <= rq.e.c; c++) { const t = v(r, c); if (/^[a-zA-Z0-9]+$/.test(t)) m[t] = c; }
      if (m.dangVienCanCuoc != null) { cotP = m; dongMaPhu = r; }
    }
    if (dongMaPhu < 0) return out;
    for (let r = dongMaPhu + 1; r <= rq.e.r; r++) {
      const k = v(r, cotP.dangVienCanCuoc);
      if (!k) continue;
      const x = { __dong: r + 1 };
      for (const [key, c] of Object.entries(cotP)) if (key !== "dangVienCanCuoc") { const t = v(r, c); if (t) x[key] = t; }
      if (Object.keys(x).length > 1) (out[k] = out[k] || []).push(x);
    }
    return out;
  };
  const phu = Object.fromEntries(DS_KEYS.map((b) => [b, docPhu(DS_BUOC[b].sheet)])), kt = docPhu("HoanCanhKinhTe"), dd = docPhu("DacDiemLichSu");
  kq.forEach((d) => {
    d.__ds = Object.fromEntries(DS_KEYS.map((b) => [b, phu[b][d.identifyNo] || []]));
    d.__dd = (dd[d.identifyNo] || [])[0] || {};
    d.__kt = (kt[d.identifyNo] || [])[0] || {};
  });
  return { kq, soCot: Object.keys(cot).length };
}

async function napFile(f) {
  if (!f) return;
  try {
    const { kq, soCot } = docExcel(await f.arrayBuffer());
    hoSo = kq; daLuu = {};
    veDanhSach(0);
    await luu();
    await chrome.storage.session.set({ ten: f.name });
    trangThai("tt", `Đã nhập ${kq.length} hồ sơ từ ${f.name} (${soCot}/76 cột B1). Xem và sửa ở mục "Tổng quan" bên dưới.`, kq.length ? "ok" : "err");
  } catch (err) { trangThai("tt", "Lỗi đọc file: " + err.message, "err"); }
}
$("nhap").onclick = () => $("tep").click();
$("tep").onchange = async (e) => { await napFile(e.target.files[0]); e.target.value = ""; };
const tha = $("tha");
tha.ondragover = (e) => { e.preventDefault(); tha.classList.add("over"); };
tha.ondragleave = () => tha.classList.remove("over");
tha.ondrop = (e) => { e.preventDefault(); tha.classList.remove("over"); napFile(e.dataTransfer.files[0]); };

// ================= DANH SÁCH HỒ SƠ =================
function veDanhSach(chon = 0) {
  const ds = $("ds");
  ds.innerHTML = "";
  hoSo.forEach((d, i) => ds.append(el("option", { value: i, textContent: `${daLuu[i] ? "✓ " : ""}${i + 1}. ${d.currentFullName || "(chưa có họ tên)"}${d.birthDate ? " – " + d.birthDate : ""}` })));
  ds.disabled = !hoSo.length;
  $("khuTongQuan").hidden = $("khuBuoc").hidden = $("khuTD").hidden = !hoSo.length;
  if (hoSo.length) { ds.value = Math.min(chon, hoSo.length - 1); xem(); }
  capNhatNut();
}
function xem() {
  const d = hs();
  if (!d) return;
  const n = KHOA.filter((k) => d[k]).length;
  const x = $("xem");
  x.style.display = "block";
  x.innerHTML = "";
  x.append(el("b", { textContent: d.currentFullName || "(chưa có họ tên)" }),
    ` · ${d.__idMay ? "☁ ID " + d.__idMay : "dòng " + d.__dong} · B1: ${n}/76 trường · B2: ${d.__ds.qtct.length} dòng · B8: ${d.__ds.qh.length} người · B9: ${Object.keys(d.__kt).filter((k) => !k.startsWith("__")).length} ô · mục khác: ${Object.keys(DS_THEM).reduce((s, b) => s + d.__ds[b].length, 0)} dòng, B6 ${TRUONG_DD.filter(([k]) => d.__dd[k]).length} ô` + (daLuu[chiSo()] ? " · đã bấm Lưu B1" : ""));
  $("vietTay").checked = !!d.__vietTay;
  xoaSoSanh();
  dsSS = theoDS(() => null); dsTT = theoDS(() => ({})); ktSS = null; ddSS = null;
  veTongQuan();
  DS_KEYS.forEach(veDS); veKT(); veDD();
}
function capNhatNut() {
  const co = hoSo.length > 0;
  $("truoc").disabled = !co || dangChay || chiSo() <= 0;
  $("sau").disabled = !co || dangChay || chiSo() >= hoSo.length - 1;
  $("ds").disabled = !co || dangChay;
  $("soSanh").disabled = !co || dangChay;
  $("nhap").disabled = dangChay;
  $("taiMay").disabled = dangChay;
  $("dieuKhien").hidden = !dangChay;
  if ($("chayTD")) $("chayTD").disabled = !co || dangChay;
  $("dien").disabled = dangChay || !ssHienTai || !dsChon().length || (ssHienTai.canhBao.length && !$("dungNguoi")?.checked);
  $("dien").textContent = `Điền ${dsChon().length} ô đã chọn`;
  if ($("ddSoSanh")) { $("ddSoSanh").disabled = dangChay || !co; const nDD = ddSS ? ddSS.ds.filter((x) => x.chon).length : 0; $("ddDien").disabled = dangChay || !nDD; $("ddDien").textContent = `Điền ${nDD} ô đã chọn`; }
  for (const b of DS_KEYS) {
    if (!$(`${b}SoSanh`)) continue;
    $(`${b}SoSanh`).disabled = dangChay || !co;
    $(`${b}Dien`).disabled = dangChay || !dsSS[b] || !dsChonDS(b).length;
    $(`${b}Dien`).textContent = `Điền ${dsChonDS(b).length} ${DS_BUOC[b].don} đã chọn`;
  }
  $("ktSoSanh").disabled = dangChay || !co;
  const nKT = ktSS ? ktSS.ds.filter((x) => x.chon).length : 0;
  $("ktDien").disabled = dangChay || !nKT;
  $("ktDien").textContent = `Điền ${nKT} ô đã chọn`;
}
$("ds").onchange = () => { xem(); luu(); capNhatNut(); };
$("truoc").onclick = () => { $("ds").value = chiSo() - 1; $("ds").onchange(); };
$("sau").onclick = () => { $("ds").value = chiSo() + 1; $("ds").onchange(); };

// Nhập thủ công B1→B11: tạo hồ sơ mới GIỮ dữ liệu đang mở, sửa ở Tổng quan rồi chạy tự động
$("taoTay").onclick = async () => {
  if (dangChay) return;
  const src = hs();
  let d = null;
  try { if (src) d = JSON.parse(JSON.stringify(src)); } catch (e) { d = null; }
  if (!d || typeof d !== "object") d = {};
  d.__dong = "tay";
  delete d.__idMay;
  d.__ds = d.__ds || {};
  DS_KEYS.forEach((b) => { if (!Array.isArray(d.__ds[b])) d.__ds[b] = []; });
  if (!d.__dd || typeof d.__dd !== "object") d.__dd = {};
  if (!d.__kt || typeof d.__kt !== "object") d.__kt = {};
  const giu = KHOA.filter((k) => d[k]).length;
  const idx = hoSo.length ? chiSo() : -1;
  if (idx >= 0) { hoSo[idx] = d; delete daLuu[idx]; } else hoSo.push(d);
  tqHienHet = true;
  veDanhSach(idx >= 0 ? idx : 0);
  await luu();
  if ($("tongQuan")) $("tongQuan").open = true;
  if ($("tqNoiDung") && $("tqNoiDung").firstChild) $("tqNoiDung").firstChild.open = true;
  trangThai("tt", idx >= 0 ? `Đã chuyển "${d.currentFullName || "hồ sơ"}" sang nhập tay (giữ ${giu} trường B1, không tạo thêm, không đẩy mây).` : `Đã tạo hồ sơ nhập tay (giữ ${giu} trường B1).`, "ok");
};

// Đọc bước ĐANG MỞ trên trang vào hồ sơ hiện tại để soát (không tự chuyển mục)
$("docTrang").onclick = async () => {
  const d = hs();
  if (!d) return trangThai("tt", "Chưa có hồ sơ – bấm Tạo hồ sơ nhập tay trước.", "err");
  if (dangChay) return;
  d.__ds = d.__ds || {};
  DS_KEYS.forEach((b) => { if (!Array.isArray(d.__ds[b])) d.__ds[b] = []; });
  if (!d.__dd || typeof d.__dd !== "object") d.__dd = {};
  if (!d.__kt || typeof d.__kt !== "object") d.__kt = {};
  $("docTrang").disabled = true;
  try {
    const tab = await layTab();
    await tiem(tab.id);
    trangThai("tt", "Đang đọc bước đang mở trên trang…");
    const r = await chay(tab.id, async (b1keys, ddkeys) => {
      const L = window.__dhsLib;
      if (!L) return { loi: "trang chưa sẵn sàng" };
      const host = (k) => document.querySelector(`[formcontrolname="${k}"]`);
      const docForm = (ks) => { const o = {}; for (const [k, t] of ks) { try { const v = L.docLai(k, t); if (v != null && String(v).trim() !== "") o[k] = String(v).trim(); } catch (e) {} } return o; };
      if (host("currentFullName")) return { muc: "b1", form: docForm(b1keys) };
      if (host("leaveDate")) return { muc: "dd", form: docForm(ddkeys) };
      if (host("householdAnnualIncome")) {
        try {
          const s = await window.__dhsKTSoSanh({});
          const o = {};
          for (const x of (s && s.ds) || []) if (x.cu) o[x.key] = x.cu;
          return { muc: "kt", form: o };
        } catch (e) { return { muc: "kt", loi: e.message }; }
      }
      const CH = window.CAU_HINH_DS || {};
      const docO2 = (key, kieu) => {
        const h = L.q(`[formcontrolname="${key}"]`);
        if (!h) return "";
        if (kieu === "year" || kieu === "pk") { const i = L.q("input", h); return (i && i.value) || ""; }
        if (kieu === "multi") return L.qa("vts-select-item, .vts-select-selection-item", h).map((x) => x.innerText.trim()).filter((t) => t && !/^\+\s*\d/.test(t)).join("; ");
        if (h.tagName === "VTS-SELECT") { const c = L.q("vts-select-top-control", h); const t = c ? c.innerText.trim() : ""; return t.startsWith("--") ? "" : t; }
        return h.value || "";
      };
      const docFormDS = (ch) => { const o = {}; for (const [key, nhan, kieu] of ch.truong) { const v = docO2(key, kieu); if (v) o[key] = v; } return o; };
      const dongFormDangMo = async (c) => {
        const F = () => L.q(`[formcontrolname="${c.formKey}"]`);
        if (!F()) return { ok: true };
        for (let lan = 0; lan < 2 && F(); lan++) {
          const f0 = F();
          let p = f0, nut = null;
          for (let k = 0; k < 8 && p && !nut; k++) {
            const bs = [...p.querySelectorAll("button")].filter((bb) => bb.offsetParent && (L.chuan(bb.innerText) === "dong" || L.chuan(bb.innerText) === "huy"));
            if (bs.length) nut = bs[0];
            p = p.parentElement;
          }
          if (nut) L.click(nut);
          await L.sleep(600);
          if (F()) {
            const xns = L.qa(".cdk-overlay-pane").filter((x) => x.offsetParent);
            for (const z of xns) {
              const th = L.qa("button", z).find((bb) => ["thoat", "dong y"].includes(L.chuan(bb.innerText)));
              if (th) { L.click(th); break; }
            }
            await L.sleep(600);
          }
        }
        await L.cho(() => !F(), 2000);
        if (F()) {
          let top = F();
          for (let k = 0; k < 8 && top.parentElement; k++) top = top.parentElement;
          const ten = [...top.querySelectorAll("button")].filter((bb) => bb.offsetParent).slice(0, 12).map((bb) => `"${(bb.innerText || "").trim()}"`).join(" ");
          return { ok: false, nut: ten || "(không thấy nút nào)" };
        }
        return { ok: true };
      };
      for (const [b, ch] of Object.entries(CH)) {
        if (host(ch.formKey)) { const o = docFormDS(ch); return { muc: b, rows: Object.keys(o).length ? [o] : [] }; }
      }
      for (const [b, ch] of Object.entries(CH)) {
        const timBang = () => {
          const tb = L.qa("table").filter((x) => x.offsetParent).find((x) => ch.bang.every((hd) => L.qa("thead th", x).some((th) => L.chuan(th.innerText) === hd)));
          return tb ? L.qa("tbody tr", tb).filter((tr) => tr.children.length > 3) : [];
        };
        if (!timBang().length) continue;
        const rows = [];
        let lastSig = "", ket = "";
        for (let i = 0; ; i++) {
          const trs = timBang();
          if (i >= trs.length) break;
          try {
            const nut = L.qa("button", trs[i].lastElementChild);
            const sua = nut.find((bb) => L.q(".vtsicon-FilePen\\:custom", bb)) || nut[0];
            if (!sua) continue;
            L.click(sua);
            if (!(await L.cho(() => !!L.q(`[formcontrolname="${ch.formKey}"]`), 8000))) continue;
            await L.sleep(900);
            const o = docFormDS(ch);
            const sig = JSON.stringify(o);
            if (Object.keys(o).length && sig !== lastSig) { rows.push(o); lastSig = sig; }
          } catch (e) {}
          const dfr = await dongFormDangMo(ch).catch(() => ({ ok: false, nut: "lỗi" }));
          if (!dfr.ok) { ket = `kẹt biểu mẫu ở dòng ${i + 1} (nút thấy: ${dfr.nut || "?"})`; break; }
        }
        return { muc: b, rows, ket };
      }
      return { loi: "không nhận ra bước đang mở (mở một mục B1–B10 của hồ sơ rồi thử lại)" };
    }, [KHOA.map((k) => [k, KIEU[k]]), TRUONG_DD.map((t) => [t[0], t[2]])]);
    if (!r || r.loi) return trangThai("tt", "Không đọc được: " + ((r && r.loi) || "trang không phản hồi"), "err");
    let lay = 0;
    if (r.form) {
      const dich = r.muc === "dd" ? d.__dd : r.muc === "kt" ? d.__kt : d;
      for (const [k, v] of Object.entries(r.form)) if (!dich[k]) { dich[k] = v; lay++; }
      trangThai("tt", lay ? `Đã đọc ${TEN_MUC[r.muc] || r.muc}: ${lay} ô mới. Xem ở Tổng quan.` : `${TEN_MUC[r.muc] || r.muc}: không có ô mới (đã đủ).`, lay ? "ok" : "");
    } else if (r.rows) {
      if (!d.__ds[r.muc].length) { d.__ds[r.muc] = r.rows; lay = r.rows.length; }
      trangThai("tt", (lay ? `Đã đọc ${TEN_MUC[r.muc] || r.muc}: ${lay} dòng. Xem ở Tổng quan.` : `${TEN_MUC[r.muc] || r.muc}: đã có ${d.__ds[r.muc].length} dòng, giữ nguyên (xóa bớt trong Tổng quan rồi đọc lại nếu cần).`) + (r.ket ? ` ${r.ket}.` : ""), lay ? "ok" : "");
    }
    await luu();
    veTongQuan();
  } catch (e) { trangThai("tt", "Không đọc được: " + e.message, "err"); }
  finally { $("docTrang").disabled = false; }
};

// Đọc hết B1→B10 một lần, CHỈ ĐỌC (không điền, không bấm Lưu trên trang), clone vào hồ sơ hiện tại
$("docHet").onclick = async () => {
  const d = hs();
  if (!d) return trangThai("tt", "Chưa có hồ sơ – bấm Tạo hồ sơ nhập tay trước.", "err");
  if (dangChay) return;
  d.__ds = d.__ds || {};
  DS_KEYS.forEach((b) => { if (!Array.isArray(d.__ds[b])) d.__ds[b] = []; });
  if (!d.__dd || typeof d.__dd !== "object") d.__dd = {};
  if (!d.__kt || typeof d.__kt !== "object") d.__kt = {};
  $("docHet").disabled = true;
  const layDuoc = [];
  try {
    const tab = await layTab();
    await tiem(tab.id);
    const mo = (m) => goi(tab.id, (b) => window.__dhsAutoLib.moMuc(b), [m]);
    const docForm = (ks) => goi(tab.id, (keys) => { const o = {}; for (const [k, t] of keys) { try { const v = window.__dhsLib && window.__dhsLib.docLai(k, t); if (v != null && String(v).trim() !== "") o[k] = String(v).trim(); } catch (e) {} } return o; }, [ks]);
    const docBang = (buoc) => goi(tab.id, async (b) => {
      const L = window.__dhsLib, out = { rows: [], loi: "" };
      const ch = window.CAU_HINH_DS && window.CAU_HINH_DS[b];
      if (!L || !ch) return { rows: [], loi: "trang chưa sẵn sàng" };
      const dongFormDangMo = async (c) => {
        const F = () => L.q(`[formcontrolname="${c.formKey}"]`);
        if (!F()) return { ok: true };
        for (let lan = 0; lan < 2 && F(); lan++) {
          const f0 = F();
          let p = f0, nut = null;
          for (let k = 0; k < 8 && p && !nut; k++) {
            const bs = [...p.querySelectorAll("button")].filter((bb) => bb.offsetParent && (L.chuan(bb.innerText) === "dong" || L.chuan(bb.innerText) === "huy"));
            if (bs.length) nut = bs[0];
            p = p.parentElement;
          }
          if (nut) L.click(nut);
          await L.sleep(600);
          if (F()) {
            const xns = L.qa(".cdk-overlay-pane").filter((x) => x.offsetParent);
            for (const z of xns) {
              const th = L.qa("button", z).find((bb) => ["thoat", "dong y"].includes(L.chuan(bb.innerText)));
              if (th) { L.click(th); break; }
            }
            await L.sleep(600);
          }
        }
        await L.cho(() => !F(), 2000);
        if (F()) {
          let top = F();
          for (let k = 0; k < 8 && top.parentElement; k++) top = top.parentElement;
          const ten = [...top.querySelectorAll("button")].filter((bb) => bb.offsetParent).slice(0, 12).map((bb) => `"${(bb.innerText || "").trim()}"`).join(" ");
          return { ok: false, nut: ten || "(không thấy nút nào)" };
        }
        return { ok: true };
      };
      const docO2 = (key, kieu) => {
        const h = L.q(`[formcontrolname="${key}"]`);
        if (!h) return "";
        if (kieu === "year" || kieu === "pk") { const i = L.q("input", h); return (i && i.value) || ""; }
        if (kieu === "multi") return L.qa("vts-select-item, .vts-select-selection-item", h).map((x) => x.innerText.trim()).filter((t) => t && !/^\+\s*\d/.test(t)).join("; ");
        if (h.tagName === "VTS-SELECT") { const c = L.q("vts-select-top-control", h); const t = c ? c.innerText.trim() : ""; return t.startsWith("--") ? "" : t; }
        return h.value || "";
      };
      try {
        if (ch.tab) {
          const t = L.qa(".vts-tabs-tab-btn").find((e) => e.offsetParent && L.chuan(e.innerText) === L.chuan(ch.tab));
          if (!t) return { rows: [], loi: `không thấy tab ${ch.tab}` };
          const vo = t.closest(".vts-tabs-tab");
          if (!(vo && vo.className.includes("vts-tabs-tab-active"))) { L.click(t); await L.sleep(1500); }
        }
        if (L.q(`[formcontrolname="${ch.formKey}"]`)) {
          const dDau = await dongFormDangMo(ch).catch(() => ({ ok: false }));
          if (!dDau.ok) return { rows: [], loi: "đang kẹt biểu mẫu" + (dDau.nut ? ` (nút thấy: ${dDau.nut})` : "") + ", đóng tay rồi thử lại" };
        }
        let lastSig = "";
        for (let i = 0; ; i++) {
          const tbAll = L.qa("table").filter((x) => ch.bang.every((hd) => L.qa("thead th", x).some((th) => L.chuan(th.innerText) === hd)));
          const tb = tbAll.find((x) => x.offsetParent) || tbAll[0];
          const trs = tb ? L.qa("tbody tr", tb).filter((tr) => tr.children.length > 3) : [];
          out.thay = Math.max(out.thay || 0, trs.length);
          if (i >= trs.length) break;
          try {
            const nut = L.qa("button", trs[i].lastElementChild);
            const sua = nut.find((bb) => L.q(".vtsicon-FilePen\\:custom", bb)) || nut[0];
            if (!sua) continue;
            L.click(sua);
            if (!(await L.cho(() => !!L.q(`[formcontrolname="${ch.formKey}"]`), 8000))) continue;
            await L.sleep(900);
            const o = {};
            for (const [key, nhan, kieu] of ch.truong) { const v = docO2(key, kieu); if (v) o[key] = v; }
            const sig = JSON.stringify(o);
            if (Object.keys(o).length && sig !== lastSig) { out.rows.push(o); lastSig = sig; }
          } catch (e) {}
          const dfr = await dongFormDangMo(ch).catch(() => ({ ok: false, nut: "lỗi" }));
          if (!dfr.ok) { out.loi = `kẹt biểu mẫu ở dòng ${i + 1}, đã đọc ${out.rows.length}/${trs.length} dòng (nút thấy: ${dfr.nut || "?"})`; break; }
        }
      } catch (e) { out.loi = e.message; }
      return out;
    }, [buoc]);
    for (const m of THU_TU) {
      trangThai("tt", `Đang đọc ${TEN_MUC[m] || m} trên trang (chỉ đọc)…`);
      const rMo = await mo(m).catch(() => null);
      if (!rMo || !rMo.ok) { layDuoc.push(`${m}:không mở được`); continue; }
      if (m === "b1") {
        const tv = await docForm(KHOA.map((k) => [k, KIEU[k]])).catch(() => null);
        let n = 0;
        for (const [k, v] of Object.entries(tv || {})) if (!d[k]) { d[k] = v; n++; }
        layDuoc.push(`B1:${n}`);
      } else if (m === "dd") {
        const tv = await docForm(TRUONG_DD.map((t) => [t[0], t[2]])).catch(() => null);
        let n = 0;
        for (const [k, v] of Object.entries(tv || {})) if (!d.__dd[k]) { d.__dd[k] = v; n++; }
        layDuoc.push(`B6:${n}`);
      } else if (m === "kt") {
        const r = await goi(tab.id, async () => { try { const s = await window.__dhsKTSoSanh({}); const o = {}; for (const x of (s && s.ds) || []) if (x.cu) o[x.key] = x.cu; return { kt: o }; } catch (e) { return { loi: e.message }; } }, []).catch(() => null);
        let n = 0;
        for (const [k, v] of Object.entries((r && r.kt) || {})) if (!d.__kt[k]) { d.__kt[k] = v; n++; }
        layDuoc.push(`B9:${n}`);
      } else {
        const r = await docBang(m).catch(() => null);
        if (r && r.rows && r.rows.length && !d.__ds[m].length) { d.__ds[m] = r.rows; layDuoc.push(`${DS_BUOC[m].so}:${r.rows.length}d`); }
        else layDuoc.push(`${DS_BUOC[m].so}:${(r && r.loi) || "giữ nguyên"}`);
      }
    }
    await mo("b1").catch(() => {});
    await luu();
    veTongQuan();
    trangThai("tt", `Đọc xong (chỉ đọc, không sửa trang): ${layDuoc.join(" ")}. Xem ở Tổng quan.`, "ok");
  } catch (e) { trangThai("tt", "Không đọc được: " + e.message, "err"); }
  finally { $("docHet").disabled = false; }
};

// Đẩy hồ sơ hiện tại sang bước ĐANG MỞ trên trang (dùng lại luồng So sánh + Điền từng bước)
$("dayTrang").onclick = async () => {
  if (!hs()) return trangThai("tt", "Chưa có hồ sơ.", "err");
  if (dangChay) return;
  $("dayTrang").disabled = true;
  try {
    const tab = await layTab();
    await tiem(tab.id);
    const r = await chay(tab.id, () => {
      const h = (k) => document.querySelector(`[formcontrolname="${k}"]`);
      if (h("currentFullName")) return { muc: "b1" };
      if (h("leaveDate")) return { muc: "dd" };
      if (h("householdAnnualIncome")) return { muc: "kt" };
      const CH = window.CAU_HINH_DS || {};
      for (const [b, ch] of Object.entries(CH)) if (h(ch.formKey)) return { muc: b };
      const L = window.__dhsLib;
      if (L) for (const [b, ch] of Object.entries(CH)) {
        const tb = L.qa("table").filter((x) => x.offsetParent).find((x) => ch.bang.every((hd) => L.qa("thead th", x).some((th) => L.chuan(th.innerText) === hd)));
        if (tb) return { muc: b };
      }
      return { loi: "không nhận ra bước đang mở (mở một mục B1–B10 của hồ sơ rồi thử lại)" };
    }, []);
    if (!r || r.loi || !r.muc) return trangThai("tt", "Không đẩy được: " + ((r && r.loi) || "trang không phản hồi"), "err");
    const m = r.muc;
    const theTab = document.querySelector(`.tab[data-buoc="${m}"]`);
    if (theTab) theTab.click();
    if (m === "b1") {
      await soSanh();
      if (!ssHienTai) return;
      ssHienTai.ds.forEach((x) => { if (x.tt === "trong" || x.tt === "khac") x.chon = true; });
      veBang();
      $("dien").click();
    } else if (m === "dd") {
      await soSanhDD();
      if (!ddSS) return;
      ddSS.ds.forEach((x) => { if (x.tt === "trong" || x.tt === "khac") x.chon = true; });
      veDD();
      dienDD();
    } else if (m === "kt") {
      await soSanhKT();
      if (ktSS) dienKT();
    } else {
      const truoc = dsSS[m];
      await soSanhDS(m);
      if (dsSS[m] && dsSS[m] !== truoc) await dienDS(m);
    }
  } catch (e) { trangThai("tt", "Không đẩy được: " + e.message, "err"); }
  finally { $("dayTrang").disabled = false; }
};

// Thẻ chọn bước
document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === t));
  document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.id !== "p_" + t.dataset.buoc));
}));

// ================= TỔNG QUAN – XEM & SỬA =================
let tqHienHet = false;
// nghi: [lý do AI chưa chắc, hàm bỏ đánh dấu] – sửa ô hoặc bấm "Đúng" thì bỏ đánh dấu
const oNhap = (nhan, gt, luuFn, daCo, nghi) => {
  const lyDo = nghi && nghi[0];
  const i = el("input", { value: gt || "", className: lyDo ? "nghi" : daCo ? "da-co" : "", title: daCo ? "Ô này đã có dữ liệu trên trang: " + daCo : "" });
  i.onchange = () => { luuFn(i.value.trim()); if (lyDo) nghi[1](); luu(); xoaKetQuaSoSanh(); veThieu(); if (lyDo) veTongQuan(); };
  const o = el("div", { className: "tq-o" + (lyDo ? " tq-nghi" : "") }, el("span", { textContent: nhan + (daCo ? " ⚠" : "") }), i);
  if (lyDo) o.append(el("small", { className: "ly-do" }, "⚠ AI chưa chắc: " + lyDo + " ",
    el("span", { className: "lienKet", textContent: "✓ Đúng", title: "Đã đối chiếu hồ sơ gốc, giữ nguyên", onclick: () => { nghi[1](); luu(); veTongQuan(); veThieu(); } })));
  return o;
};
const nghiCua = (bang, k) => (bang && bang[k] ? [bang[k], () => delete bang[k]] : null);
function xoaKetQuaSoSanh() { xoaSoSanh(); dsSS = theoDS(() => null); ktSS = null; ddSS = null; DS_KEYS.forEach(veDS); veKT(); veDD(); }
function veTongQuan() {
  const d = hs(), box = $("tqNoiDung");
  if (!d) return;
  // Giữ nguyên các mục đang mở và vị trí cuộn khi vẽ lại (VD sau khi bấm "✓ Đúng")
  const moTruoc = new Set([...box.querySelectorAll(":scope > details")].map((x, i) => (x.open ? i : -1)).filter((i) => i >= 0));
  const cuon = document.scrollingElement.scrollTop;
  box.innerHTML = "";
  queueMicrotask(() => { [...box.querySelectorAll(":scope > details")].forEach((x, i) => { if (moTruoc.has(i)) x.open = true; }); document.scrollingElement.scrollTop = cuon; });
  const daCoB1 = ssHienTai ? Object.fromEntries(ssHienTai.ds.filter((x) => x.cu).map((x) => [x.key, x.cu])) : {};
  // B1
  // B1: chỉ hỏi xác nhận các trường quan trọng (họ tên, CCCD, số thẻ…); trường khác điền theo kết quả quét
  const soNghiB1 = Object.keys(d.__nghi || {}).filter((k) => QUAN_TRONG.includes(k)).length;
  const b1 = el("details", {}, el("summary", { textContent: `B1 – Thông tin cơ bản (${KHOA.filter((k) => d[k]).length}/76 trường có dữ liệu)` + (soNghiB1 ? ` · ⚠ ${soNghiB1} ô AI chưa chắc` : "") }));
  b1.append(el("div", {}, el("span", { className: "lienKet", textContent: tqHienHet ? "Chỉ hiện trường có dữ liệu" : "Hiện cả trường trống", onclick: () => { tqHienHet = !tqHienHet; veTongQuan(); $("tqNoiDung").firstChild.open = true; } })));
  for (const [k, nhan] of TRUONG_HO_SO) if (tqHienHet || d[k]) b1.append(oNhap(nhan, d[k], (v) => { if (v) d[k] = v; else delete d[k]; }, daCoB1[k], QUAN_TRONG.includes(k) ? nghiCua(d.__nghi, k) : null));
  box.append(b1);
  // B2, B8
  for (const b of DS_KEYS) {
    const cf = DS_BUOC[b], ds = d.__ds[b];
    const soNghi = ds.reduce((t, x) => t + Object.keys(x.__nghi || {}).length, 0);
    const sec = el("details", {}, el("summary", { textContent: `${cf.so} – ${cf.ten} (${ds.length} ${cf.don})` + (soNghi ? ` · ⚠ ${soNghi} ô AI chưa chắc` : "") }));
    ds.forEach((x, i) => {
      const daCo = dsSS[b] && dsSS[b][i];
      const the = el("div", { className: "tq-the" }, el("div", { className: "dau2" },
        el("span", { textContent: `${i + 1}. ${cf.nhan(x)}${daCo ? " ⚠ đã có trên trang" : ""}` }),
        el("span", { className: "xoa", textContent: "Xóa", onclick: () => { if (confirm("Xóa dòng này khỏi dữ liệu sẽ điền?")) { ds.splice(i, 1); luu(); xoaKetQuaSoSanh(); veTongQuan(); sec.open = true; } } })));
      for (const [k, nhan] of cf.truong) the.append(oNhap(nhan, x[k], (v) => { if (v) x[k] = v; else delete x[k]; if (b === "daotao") { const rB3 = chuanB3(x); if (Object.keys(rB3[1]).length) { luu(); veTongQuan(); } } }, null, nghiCua(x.__nghi, k)));
      sec.append(the);
    });
    sec.append(el("span", { className: "lienKet", textContent: `+ Thêm ${cf.don}`, onclick: () => { ds.push({}); luu(); veTongQuan(); [...$("tqNoiDung").children].find((s) => s.textContent.includes(cf.ten)).open = true; } }));
    box.append(sec);
  }
  // B6
  const b6 = el("details", {}, el("summary", { textContent: `B6 – Đặc điểm lịch sử (${TRUONG_DD.filter(([k]) => d.__dd[k]).length} ô có dữ liệu)` }));
  for (const [k, nhan] of TRUONG_DD) b6.append(oNhap(nhan, d.__dd[k], (v) => { if (v) d.__dd[k] = v; else delete d.__dd[k]; }, null, nghiCua(d.__dd.__nghi, k)));
  box.append(b6);
  // B9
  const kt = d.__kt;
  const daCoKT = ktSS ? Object.fromEntries(ktSS.ds.filter((x) => x.cu).map((x) => [x.key, x.cu])) : {};
  const b9 = el("details", {}, el("summary", { textContent: `B9 – Hoàn cảnh kinh tế (${KT_TRUONG.filter(([k]) => kt[k]).length} ô có dữ liệu)` }));
  for (const [k, nhan] of KT_TRUONG) b9.append(oNhap(nhan, kt[k], (v) => { if (v) kt[k] = v; else delete kt[k]; }, daCoKT[k], nghiCua(kt.__nghi, k)));
  box.append(b9);
  box.append(el("details", {}, el("summary", { textContent: "B11 – Quá trình sinh hoạt Đảng (hệ thống tự ghi)" }),
    el("p", { className: "note", textContent: "B11 do hệ thống tự ghi khi chuyển sinh hoạt, không có nút Thêm mới – không cần nhập." })));
  const dem = [ssHienTai && `B1: ${ssHienTai.ds.filter((x) => x.cu).length} trường đã có dữ liệu trên trang`,
    dsSS.qtct && `B2: ${dsSS.qtct.filter(Boolean).length} dòng đã có`, dsSS.qh && `B8: ${dsSS.qh.filter(Boolean).length} người đã có`,
    ktSS && `B9: ${ktSS.ds.filter((x) => x.cu).length} ô đã có`].filter(Boolean);
  trangThai("tqTomTat", dem.length ? "Đã so sánh – " + dem.join(" · ") + " (đánh dấu ⚠)" : "Chưa so sánh với trang. Mở từng mục trên trang và bấm So sánh để biết trường nào đã có.", dem.length ? "err" : "");
  veThieu();
}

// ================= LÀM VIỆC VỚI TAB =================
async function layTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !/^https:\/\/tcxdd\.dcs\.vn\//.test(tab.url || "")) throw new Error("Hãy mở trang hồ sơ đảng viên trên tcxdd.dcs.vn.");
  return tab;
}
async function tiem(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["fields.js", "fill.js", "fill_ds.js", "fill_kt.js", "auto.js"] });
}
async function chay(tabId, func, args = []) {
  const [r] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return r && r.result;
}
const sach = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("__")));

// ================= B1: SO SÁNH & ĐIỀN =================
function xoaSoSanh() {
  ssHienTai = null;
  $("canhBao").innerHTML = ""; $("tomTat").innerHTML = ""; $("bangSS").innerHTML = "";
  $("khuDien").hidden = true; $("kq").innerHTML = ""; $("tienDo").textContent = "";
}
const NHAN_TT = { trong: ["Ô trống – sẽ điền", "t-trong"], khac: ["Đã có dữ liệu khác – cần xác nhận", "t-khac"], trung: ["Đã có, trùng – giữ nguyên", "t-trung"], khoa: ["Bị khóa – bỏ qua", "t-khoa"], an: ["Không hiển thị – bỏ qua", "t-khoa"] };

async function soSanh() {
  xoaSoSanh();
  const d = hs();
  if (!d) return;
  try {
    const tab = await layTab();
    tabDien = tab.id;
    await tiem(tab.id);
    const duLieu = Object.fromEntries(KHOA.filter((k) => d[k]).map((k) => [k, d[k]]));
    const r = await chay(tab.id, (x) => window.__dhsSoSanh(x), [duLieu]);
    if (!r || r.loiChung) { $("tomTat").append(el("div", { className: "tt err", textContent: r ? r.loiChung : "Không đọc được trang." })); return; }
    ssHienTai = r;
    d.__thieuB1 = (r.thieu || []).map((x) => ({ k: x.key, bb: !!x.bb })); luu();
    veSoSanh();
    veTongQuan();
  } catch (e) { $("tomTat").append(el("div", { className: "tt err", textContent: e.message })); }
}
$("soSanh").onclick = soSanh;

let hienHet = false;
function veSoSanh() {
  const { ds, canhBao } = ssHienTai;
  const dem = (t) => ds.filter((x) => x.tt === t).length;
  if (canhBao.length) {
    const cb = el("div", { className: "cb" }, el("b", { textContent: "Cảnh báo: có thể không đúng người!" }));
    canhBao.forEach((c) => cb.append(el("div", { textContent: "• " + c })));
    cb.append(el("label", { className: "chk" }, el("input", { type: "checkbox", id: "dungNguoi", onchange: capNhatNut }), "Tôi đã kiểm tra, đúng đảng viên này"));
    $("canhBao").append(cb);
  }
  $("tomTat").append(
    el("span", { className: "tag t-trong", textContent: `${dem("trong")} ô trống` }),
    el("span", { className: "tag t-khac", textContent: `${dem("khac")} ô đã có, khác file` }),
    el("span", { className: "tag t-trung", textContent: `${dem("trung")} ô đã có, trùng` }),
    el("span", { className: "tag t-khoa", textContent: `${dem("khoa") + dem("an")} bỏ qua` }),
    el("div", {}, el("span", { className: "lienKet", textContent: "Hiện cả ô trùng/bỏ qua", onclick: () => { hienHet = !hienHet; veBang(); } }),
      el("span", { className: "lienKet", textContent: "Bỏ chọn tất cả", onclick: () => { ds.forEach((x) => (x.chon = false)); veBang(); } })));
  ds.forEach((x) => (x.chon = x.tt === "trong"));
  hienHet = false;
  veBang();
  $("khuDien").hidden = false;
}
function chonKem(x) {
  const m = x.key.match(/^(\w+?)(Nation|Province)Id$/);
  if (!m || !x.chon) return [];
  const kem = [];
  for (const sau of m[2] === "Nation" ? ["Province", "Commune"] : ["Commune"]) {
    const y = ssHienTai.ds.find((z) => z.key === m[1] + sau + "Id");
    if (y && !y.chon && (y.tt === "khac" || y.tt === "trong")) { y.chon = true; kem.push(y.nhan); }
  }
  return kem;
}
function veBang() {
  const b = $("bangSS");
  b.innerHTML = "";
  let nhomTruoc = "";
  for (const x of ssHienTai.ds) {
    if (!hienHet && (x.tt === "trung" || x.tt === "khoa" || x.tt === "an")) continue;
    if (NHOM[x.key] !== nhomTruoc) { nhomTruoc = NHOM[x.key]; b.append(el("div", { className: "nhom", textContent: nhomTruoc })); }
    const coThe = x.tt === "trong" || x.tt === "khac";
    const cb = el("input", { type: "checkbox", checked: !!x.chon, disabled: !coThe });
    cb.onchange = () => {
      x.chon = cb.checked;
      const kem = chonKem(x);
      if (kem.length) alert(`Đổi "${x.nhan}" thì hệ thống sẽ xóa ô phụ thuộc. Đã chọn kèm: ${kem.join(", ")}.`);
      veBang();
    };
    const [nhan, lop] = NHAN_TT[x.tt];
    const the = el("div", { className: "ss" + (x.tt === "khac" ? " khac" : "") },
      el("div", { className: "dau" }, cb, el("span", { textContent: x.nhan })),
      el("div", { className: "gt" }, el("span", { className: "tag " + lop, textContent: x.tt === "khac" ? (x.chon ? "Đã xác nhận thay" : "Giữ dữ liệu cũ") : nhan })));
    if (x.tt === "khac" || x.tt === "trung") the.append(el("div", { className: "gt" }, el("i", { textContent: "Trên trang:" }), x.tt === "khac" && x.chon ? el("s", { textContent: x.cu }) : x.cu));
    the.append(el("div", { className: "gt" }, el("i", { textContent: "File:" }), x.moi));
    b.append(the);
  }
  if (!b.children.length) b.append(el("div", { className: "tt", textContent: "Không có ô nào cần điền: dữ liệu trên trang đã trùng với file." }));
  capNhatNut();
}
const dsChon = () => (ssHienTai ? ssHienTai.ds.filter((x) => x.chon) : []);

$("dien").onclick = async () => {
  const chon = dsChon();
  if (!chon.length) return;
  const thay = chon.filter((x) => x.tt === "khac");
  if (thay.length && !confirm(`Xác nhận THAY ${thay.length} ô đang có dữ liệu cũ:\n\n` + thay.map((x) => `• ${x.nhan}: "${x.cu}" → "${x.moi}"`).join("\n"))) return;
  try {
    const tab = await layTab();
    if (tab.id !== tabDien) throw new Error("Tab đã đổi sau khi so sánh. Bấm So sánh lại.");
    await tiem(tab.id);
    const r = await chay(tab.id, (m) => { window.__dhsTRUONG = null; return window.__dhsDien(m); }, [chon.map((x) => ({ key: x.key, moi: x.moi, cu: x.cu }))]);
    if (r && r.loiChung) throw new Error(r.loiChung);
    batDauChay("b1");
    $("kq").innerHTML = "";
    trangThai("tienDo", "Đang điền…");
  } catch (e) { trangThai("tienDo", e.message, "err"); }
};
function hienKq(kq, biDoi, dung) {
  const k = $("kq");
  k.innerHTML = "";
  const ok = kq.filter((x) => x.ok).length;
  trangThai("tienDo", (dung ? "Đã dừng hẳn. " : "Xong. ") + `${ok}/${kq.length} ô đã điền. Kiểm tra trang rồi tự bấm Lưu.`, kq.length - ok || biDoi.length ? "err" : "ok");
  for (const d of [...biDoi, ...kq.filter((x) => !x.ok), ...kq.filter((x) => x.ok)])
    k.append(el("div", { className: "d " + (d.ok ? "ok" : "err") }, el("b", { textContent: (d.ok ? "✔ " : "✘ ") + d.nhan }), el("small", { textContent: d.ok ? (d.cu ? `"${d.cu}" → "${d.hien}"` : d.hien) : d.loi })));
}

// ================= ĐIỀU KHIỂN CHUNG =================
let dangTamDung = false;
function batDauChay(buoc) { dangChay = true; buocDangChay = buoc; dangTamDung = false; $("tamDung").textContent = "❚❚ Tạm dừng"; trangThai("dkTT", "Đang điền…"); capNhatNut(); }
function ketThucChay() { dangChay = false; buocDangChay = null; dangTamDung = false; capNhatNut(); }
$("tamDung").onclick = async () => {
  dangTamDung = !dangTamDung;
  await chay(tabDien, (v) => window.__dhsPause(v), [dangTamDung]);
  $("tamDung").textContent = dangTamDung ? "▶ Tiếp tục" : "❚❚ Tạm dừng";
};
$("dungHan").onclick = async () => {
  if (!confirm(tdDangChay ? "Dừng hẳn chạy tự động? Các mục đã lưu vẫn giữ trên hệ thống; mục đang điền dở chưa được lưu." : "Dừng hẳn? Những gì đã điền vẫn ở trên trang (chưa lưu).")) return;
  if (td) td.dung = true;
  await chay(tabDien, () => window.__dhsStop());
};

// ================= B2, B8: DANH SÁCH =================
const NHAN_DS = { moi: ["Mới – sẽ Thêm mới", "t-trong"], daCo: ["Đã có trên trang – chỉ điền ô trống", "t-khac"], luu: ["Đã lưu", "t-trong"], dong: ["Đã bỏ qua", "t-trung"], loi: ["Lỗi", "t-khoa"], cho: ["Đang chờ bấm Lưu", "t-khac"] };
const dsChonDS = (b) => { const d = hs(); return d ? d.__ds[b].filter((x, i) => x.__chon !== false && dsTT[b][i] !== "luu") : []; };
function veDS(b) {
  const p = $(`p_${b}`), d = hs(), cf = DS_BUOC[b];
  if (!p.childElementCount) {
    p.append(
      el("button", { id: `${b}SoSanh`, className: "full", textContent: `So sánh với bảng ${cf.ten} trên trang`, onclick: () => soSanhDS(b) }));
    if (b === "qh") p.append(
      el("button", { id: "qhLocTrung", className: "full", textContent: "🔍 Lọc trùng (Họ và tên + Năm sinh)", onclick: locTrungQH }),
      veQHBox());
    p.append(
      el("div", { id: `${b}TT`, className: "tt" }),
      el("div", { id: `${b}Ds` }),
      el("button", { id: `${b}Dien`, className: "primary full", onclick: () => dienDS(b) }),
      el("div", { id: `${b}Kq` }));
    // v0.8.9.9 B8: bỏ nút "Điền xx người thân đã chọn" (điền thủ công), thêm nút popup tất cả thành viên
    if (b === "qh") {
      $(`${b}Dien`).hidden = true;
      p.insertBefore(el("button", { id: "qhTv", className: "full", textContent: "👥 Tất cả thành viên trên trang (40/trang)", onclick: qhThanhVien }), $(`${b}TT`));
    }
  }
  const box = $(`${b}Ds`);
  box.innerHTML = "";
  if (!d) return;
  if (!d.__ds[b].length) box.append(el("div", { className: "tt", textContent: `File không có ${cf.don} nào cho đảng viên này (trang ${cf.sheet}, cột A = số căn cước đảng viên).` }));
  d.__ds[b].forEach((x, i) => {
    const cb = el("input", { type: "checkbox", checked: x.__chon !== false, disabled: dangChay });
    cb.onchange = () => { x.__chon = cb.checked; capNhatNut(); };
    const tt = dsTT[b][i] || (dsSS[b] ? (dsSS[b][i] ? "daCo" : "moi") : null);
    const the = el("div", { className: "ss" }, el("div", { className: "dau" }, cb, el("span", { textContent: cf.nhan(x) })));
    if (tt) the.append(el("div", { className: "gt" }, el("span", { className: "tag " + NHAN_DS[tt][1], textContent: NHAN_DS[tt][0] })));
    box.append(the);
  });
  capNhatNut();
  if (b === "qh") veQHDs(false);
}
function locTrungQH() {
  const d = hs();
  if (!d || !d.__ds.qh.length) return trangThai("qhTT", "Chưa có dữ liệu B8 để lọc trùng.", "err");
  const rows = d.__ds.qh;
  const khoa = (x) => {
    const ten = String(x.fullName || "").trim().toLowerCase().replace(/\s+/g, " ");
    const ns = String(x.birthDate || "").trim().replace(/[^0-9]/g, "");
    return ten ? ten + "|" + ns : "";
  };
  const nhom = new Map();
  rows.forEach((x, i) => { const k = khoa(x); if (k) nhom.set(k, (nhom.get(k) || []).concat(i)); });
  const trung = [...nhom.values()].filter((g) => g.length > 1);
  if (!trung.length) return trangThai("qhTT", "Không có dòng trùng Họ và tên + Năm sinh.", "ok");
  const xoa = new Set();
  trung.forEach((g) => g.slice(1).forEach((i) => xoa.add(i)));
  const mo = trung.map((g) => `• ${DS_BUOC.qh.nhan(rows[g[0]])}${g.length > 2 ? ` (${g.length} dòng trùng)` : ""}\n   giữ dòng ${g[0] + 1}, xóa dòng ${g.slice(1).map((i) => i + 1).join(", ")}`).join("\n");
  if (!confirm(`B8 Quan hệ gia đình – ${trung.length} nhóm trùng Họ và tên + Năm sinh:\n\n${mo}\n\nOK = XÓA ${xoa.size} dòng trùng (giữ dòng đầu mỗi nhóm).\nCancel = GIỮ NGUYÊN.`)) return trangThai("qhTT", `Đã giữ nguyên (${trung.length} nhóm trùng).`, "ok");
  const keptOld = rows.map((x, i) => i).filter((i) => !xoa.has(i));
  d.__ds.qh = keptOld.map((i) => rows[i]);
  if (d.__nguoiThan === rows) d.__nguoiThan = d.__ds.qh;
  if (dsSS.qh) dsSS.qh = keptOld.map((i) => dsSS.qh[i]);
  const ttMoi = {};
  keptOld.forEach((i, j) => { if (dsTT.qh[i]) ttMoi[j] = dsTT.qh[i]; });
  dsTT.qh = ttMoi;
  veDS("qh"); veTongQuan();
  trangThai("qhTT", `Đã xóa ${xoa.size} dòng trùng, còn ${d.__ds.qh.length} người thân.`, "ok");
}
// ---- B8: chọn chế độ SỬA / THÊM MỚI, xem danh sách + tổng quan rồi điền một mạch ----
const qhCheDoNay = () => { const r = [...document.querySelectorAll('input[name="qhCheDo"]')].find((x) => x.checked); return r ? r.value : "ca"; };
function veQHBox() {
  const radio = (v, nhan, mac) => el("label", { className: "chk" },
    el("input", { type: "radio", name: "qhCheDo", value: v, checked: !!mac, onchange: () => veQHDs(true) }),
    el("span", { textContent: " " + nhan }));
  return el("div", { id: "qhBox" },
    el("div", { className: "tt", textContent: "B8 Quan hệ gia đình – chọn chế độ rồi đối chiếu trang trước khi chạy:" }),
    radio("sua", "SỬA người thân ĐÃ CÓ trên trang (ghi đè theo file)", true),
    radio("them", "THÊM MỚI người thân CHƯA CÓ trên trang"),
    radio("ca", "CẢ HAI (sửa người đã có + thêm người chưa có)"),
    el("div", { className: "btns" }, el("button", { id: "qhXem", className: "full", textContent: "👁 Đối chiếu trang & hiện danh sách chọn", onclick: qhXem })),
    el("div", { id: "qhDsChon" }), el("div", { id: "qhTongQuan" }),
    el("div", { className: "btns" }, el("button", { id: "qhOK", className: "primary full", textContent: "✔ OK – điền & lưu MỘT MẠCH (không dừng hỏi)", onclick: qhChay })),
    el("div", { id: "qhKq" }));
}
function veQHDs(datLai) {
  const box = $("qhDsChon");
  if (!box) return;
  const d = hs();
  box.innerHTML = "";
  if (!d) return;
  const rows = d.__ds.qh, ss = dsSS.qh, cheDo = qhCheDoNay();
  if (!rows.length) { box.append(el("div", { className: "tt", textContent: "File không có người thân nào." })); return veQHTongQuan(); }
  box.append(el("div", { className: "tt", textContent: `Chọn người thân sẽ điền (file có ${rows.length})` + (ss ? "" : " – chưa đối chiếu trang, bấm “Đối chiếu trang” trước") + ":" }));
  rows.forEach((x, i) => {
    const daCo = ss ? !!ss[i] : null;
    const hop = cheDo === "ca" || daCo === null ? true : cheDo === "sua" ? daCo : !daCo;
    if (datLai) x.__chon = hop;
    const cb = el("input", { type: "checkbox", checked: x.__chon !== false, disabled: dangChay });
    cb.onchange = () => { x.__chon = cb.checked; veQHTongQuan(); };
    const the = el("div", { className: "ss" }, el("div", { className: "dau" }, cb, el("span", { textContent: DS_BUOC.qh.nhan(x) })));
    if (daCo !== null) the.append(el("div", { className: "gt" }, el("span", { className: "tag " + (daCo ? "t-khac" : "t-trong"), textContent: daCo ? "Đã có trên trang – sẽ SỬA" : "Chưa có trên trang – sẽ THÊM MỚI" })));
    if (!hop) the.append(el("div", { className: "gt" }, el("span", { className: "tag t-trung", textContent: "Không hợp chế độ đang chọn – sẽ bỏ qua" })));
    box.append(the);
  });
  veQHTongQuan();
}
function veQHTongQuan() {
  const box = $("qhTongQuan");
  if (!box) return;
  const d = hs();
  box.innerHTML = "";
  if (!d) return;
  const sel = d.__ds.qh.filter((x) => x.__chon !== false);
  if (!sel.length) { box.append(el("div", { className: "tt", textContent: "Chưa chọn người thân nào." })); return; }
  box.append(el("div", { className: "tt", textContent: `Tổng quan thông tin sẽ điền: ${sel.length} người thân (đã áp mặc định B8 nếu file để trống).` }));
  for (const x of sel) {
    const o = chuanQH(sach(x), !!(d && d.__vietTay))[0];
    const the = el("div", { className: "ss" }, el("div", { className: "dau", textContent: DS_BUOC.qh.nhan(o) }));
    for (const [k, nhan] of DS_BUOC.qh.truong) if (String(o[k] ?? "").trim()) the.append(el("div", { className: "gt" }, el("span", { textContent: `${nhan}: ${o[k]}` })));
    box.append(the);
  }
}
async function qhXem() {
  const d = hs();
  if (!d || !d.__ds.qh.length) return trangThai("qhTT", "Chưa có dữ liệu B8 để đối chiếu.", "err");
  trangThai("qhTT", "Đang đối chiếu bảng Quan hệ gia đình trên trang…");
  try {
    const tab = await layTab();
    tabDien = tab.id;
    await tiem(tab.id);
    const r = await chay(tab.id, (bb, x) => window.__dhsDSSoSanh(bb, x), ["qh", d.__ds.qh.map(sach)]);
    if (!r || r.loiChung) return trangThai("qhTT", r ? r.loiChung : "Không đọc được trang.", "err");
    dsSS.qh = r.ds.map((x) => x.daCo);
    dsTT.qh = {};
    veQHDs(true);
    const daCo = dsSS.qh.filter(Boolean).length;
    trangThai("qhTT", `Trên trang có ${r.soDong} người thân` + (r.trangSau ? " (bảng nhiều trang – chỉ thấy trang đang mở)" : "") + `. File: ${dsSS.qh.length - daCo} chưa có, ${daCo} đã có – xem danh sách bên dưới rồi bấm OK.`, r.trangSau ? "err" : "ok");
  } catch (e) { trangThai("qhTT", e.message, "err"); }
}
async function qhChay() {
  const d = hs();
  if (!d || dangChay) return;
  const cheDo = qhCheDoNay();
  const rows = d.__ds.qh;
  const idx = rows.map((x, i) => i).filter((i) => rows[i].__chon !== false && dsTT.qh[i] !== "luu");
  if (!idx.length) return trangThai("qhTT", "Chưa chọn người thân nào để điền.", "err");
  const ten = { sua: "chỉ SỬA người đã có trên trang (ghi đè)", them: "chỉ THÊM MỚI người chưa có", ca: "sửa người đã có + thêm người chưa có" }[cheDo];
  if (!confirm(`OK – điền & LƯU MỘT MẠCH ${idx.length} người thân B8 (${ten}).\n\nTiện ích tự bấm "Lưu thông tin" từng người, KHÔNG dừng hỏi. Tiếp tục?`)) return;
  try {
    const tab = await layTab();
    if (tab.id !== tabDien) throw new Error("Tab đã đổi sau khi đối chiếu. Bấm “Đối chiếu trang” lại.");
    await tiem(tab.id);
    dsChayIdx.qh = idx;
    const nh = Object.fromEntries(DS_BUOC.qh.truong);
    const chuan = idx.map((i) => chuanQH(rows[i], !!d.__vietTay));
    const bc = { dien: [], ghiDe: [], loi: [], boQua: [] };
    $("qhKq").innerHTML = "";
    trangThai("qhTT", `Đang điền & lưu một mạch ${idx.length} người thân…`);
    batDauChay("qh");
    const opt = { nghi: idx.map((i) => rows[i].__nghi || {}), hoiNghi: false, hoiXN: !!d.__vietTay, tuBoQua: true, ghiDe: true, macDinh: chuan.map((c) => c[1]) };
    if (cheDo === "sua") opt.chiSua = true;
    if (cheDo === "them") opt.chiThem = true;
    const r = await chay(tab.id, (b, x, o) => window.__dhsDSDienCho(b, x, o), ["qh", chuan.map((c) => c[0]), opt]);
    if (!r || r.loiChung) throw new Error(r ? r.loiChung : "Không điền được.");
    let luuN = 0;
    for (const k of r.tong) {
      if (k.ketQua === "luu") luuN++;
      else if (k.ketQua === "boQua") bc.boQua.push(`${k.ten}: ${k.loi || "bỏ qua"}`);
      else if (k.ketQua !== "trung") bc.loi.push(`${k.ten}: ${k.loi || k.ketQua}`);
      for (const o of k.o) {
        if (!o.ok && o.tt !== "khac") bc.loi.push(`${k.ten} – ${o.nhan}: ${o.loi}`);
        if (o.ok && o.tt === "ghiDe") bc.ghiDe.push(`${k.ten} – ${o.nhan}: "${o.cu}" → "${o.hien}"`);
        if (o.ok && o.tt === "dien") bc.dien.push(`${k.ten} – ${o.nhan}: ${o.hien}`);
      }
      const i = dsChayIdx.qh[k.i];
      if (i !== undefined && k.ketQua === "luu") dsTT.qh[i] = "luu";
    }
    ketThucChay();
    const box = $("qhKq");
    const them = (t, ds2, lop) => { if (ds2.length) box.append(el("details", { className: "td-muc", open: !!lop }, el("summary", {}, el("b", { textContent: t + ": " }), String(ds2.length)), ...ds2.map((s) => el("div", { className: "gt" + (lop ? " loi" : ""), textContent: s })))); };
    them("Đã lưu", r.tong.filter((k) => k.ketQua === "luu").map((k) => k.ten), false);
    them("Đã thay dữ liệu cũ", bc.ghiDe, false);
    them("Đã điền ô trống", bc.dien, false);
    them("Bỏ qua", bc.boQua, false);
    them("Lỗi", bc.loi, true);
    trangThai("qhTT", `Xong B8: đã lưu ${luuN}/${r.tong.length} người thân` + (r.dung ? " (đã dừng hẳn)." : "."), "ok");
    veDS("qh");
  } catch (e) { ketThucChay(); trangThai("qhTT", e.message, "err"); }
}
// v0.8.9.9 B8: popup tất cả thành viên trên trang (đã chọn 40/trang), đánh dấu dòng trùng đám mây
let qhTvDs = [];
const khoaTen = (s) => khongDau(s).replace(/\s+/g, " ").trim();
const khoaNS = (s) => String(s == null ? "" : s).replace(/[^0-9]/g, "");
async function qhThanhVien() {
  const d = hs();
  if (!d || !d.__ds.qh.length) return trangThai("qhTT", "Chưa có dữ liệu B8 để đối chiếu.", "err");
  trangThai("qhTT", "Đang chọn 40/trang và đọc tất cả thành viên trên trang…");
  try {
    const tab = await layTab();
    tabDien = tab.id;
    await tiem(tab.id);
    const r = await chay(tab.id, () => window.__dhsQHDocHet());
    if (!r || !r.ok) return trangThai("qhTT", (r ? r.loi : "Không đọc được trang.") + (r && r.dbg && r.dbg.length ? " Tiêu đề bảng đang thấy: [" + r.dbg.join("] [") + "]" : ""), "err");
    if (!r.tong) return trangThai("qhTT", "Bảng Quan hệ gia đình chưa có dòng nào (có thể đang tải). Đợi bảng hiện đủ rồi bấm lại.", "err");
    const khoaMay = new Set(d.__ds.qh.map((x) => khoaTen(x.fullName) + "|" + khoaNS(x.birthDate)));
    qhTvDs = r.ds.map((o) => ({ ...o, trung: khoaMay.has(khoaTen(o.ten) + "|" + (o.namSinh || "")), daXoa: false, loiXoa: "" }));
    veQHModal();
    $("qhModal").hidden = false;
    const nTrung = qhTvDs.filter((x) => x.trung).length;
    trangThai("qhTT", `Trên trang có ${r.tong} thành viên` + (r.chon40 ? " (đã chọn 40/trang)" : " (không thấy chọn 40/trang – đã gom qua các trang)") + `, ${nTrung} dòng trùng đám mây.`, "ok");
  } catch (e) { trangThai("qhTT", e.message, "err"); }
}
function veQHModal() {
  const box = $("qhDsTv");
  if (!box) return;
  box.innerHTML = "";
  qhTvDs.forEach((x, i) => {
    const dong = el("div", { className: "ss" + (x.trung ? " tv-trung" : "") },
      el("div", { className: "dau" }, el("span", { textContent: `${i + 1}. ${x.ten || "(trống tên)"}${x.daXoa ? ` → "${x.tenMoi || "(X) " + x.ten}" ✔` : ""}` }),
        x.trung ? el("span", { className: "tag-trung", textContent: "TRÙNG đám mây" }) : el("span", {})));
    dong.append(el("div", { className: "gt", textContent: `Quan hệ: ${x.quanHe || "–"} · Năm sinh: ${x.namSinh || "–"}` }));
    if (x.loiXoa) dong.append(el("div", { className: "gt loi", textContent: "✘ " + x.loiXoa }));
    box.append(dong);
  });
  const nTrung = qhTvDs.filter((x) => x.trung && !x.daXoa).length;
  $("qhTieuDe").textContent = `👥 Thành viên trên trang (${qhTvDs.length}) – ${nTrung} dòng trùng đám mây`;
  $("qhLocNgay").disabled = !nTrung || dangChay;
  $("qhLocNgay").onclick = qhLocTrungNgay;
  const nThieu = qhTvThieu().length;
  $("qhBoSung").disabled = !nThieu || dangChay;
  $("qhBoSung").textContent = `➕ Bổ sung từ đám mây (${nThieu} dòng thiếu)`;
  $("qhBoSung").onclick = qhBoSung;
  $("qhDongModal").onclick = () => { $("qhModal").hidden = true; };
}
// Dòng đám mây chưa có trên trang (theo popup thành viên vừa đọc)
function qhTvThieu() {
  const d = hs();
  if (!d || !qhTvDs.length) return [];
  const co = new Set(qhTvDs.map((t) => khoaTen(t.ten) + "|" + (t.namSinh || "")));
  return d.__ds.qh.map((x, i) => i).filter((i) => !co.has(khoaTen(d.__ds.qh[i].fullName) + "|" + khoaNS(d.__ds.qh[i].birthDate)));
}
// Bổ sung từ đám mây: chỉ THÊM MỚI dòng thiếu, không sửa dòng đã có, tự Lưu từng dòng
async function qhBoSung() {
  const d = hs();
  if (!d || dangChay) return;
  const idx = qhTvThieu();
  if (!idx.length) return trangThai("qhTT", "Đám mây không có dòng nào thiếu trên trang.", "ok");
  const mo = idx.map((i) => DS_BUOC.qh.nhan(d.__ds.qh[i])).join("\n");
  if (!confirm(`Bổ sung ${idx.length} người thân từ đám mây lên trang (chỉ THÊM MỚI, tự bấm Lưu từng dòng)?\n\n${mo}`)) return;
  trangThai("qhTT", `Đang bổ sung ${idx.length} người thân từ đám mây…`);
  batDauChay("qh"); // hiện thanh Tạm dừng / Dừng hẳn
  try {
    const tab = await layTab();
    if (tab.id !== tabDien) throw new Error("Tab đã đổi. Bấm lại nút thành viên để đọc lại trang.");
    await tiem(tab.id);
    const chuan = idx.map((i) => chuanQH(d.__ds.qh[i], !!d.__vietTay));
    const r = await chay(tab.id, (b, x, o) => window.__dhsDSDienCho(b, x, o),
      ["qh", chuan.map((c) => c[0]), { nghi: idx.map((i) => d.__ds.qh[i].__nghi || {}), hoiNghi: false, hoiXN: !!d.__vietTay, tuBoQua: true, chiThem: true, macDinh: chuan.map((c) => c[1]) }]);
    if (!r || r.loiChung) throw new Error(r ? r.loiChung : "Không điền được.");
    const luuN = r.tong.filter((k) => k.ketQua === "luu").length;
    const loi = r.tong.filter((k) => k.ketQua !== "luu" && k.ketQua !== "trung").map((k) => `${k.ten}: ${k.loi || k.ketQua}`);
    trangThai("qhTT", `Đã bổ sung ${luuN}/${idx.length} người thân.` + (loi.length ? " Lỗi: " + loi.join("; ") : ""), loi.length ? "err" : "ok");
    await qhThanhVien(); // đọc lại trang để cập nhật popup
  } catch (e) { trangThai("qhTT", e.message, "err"); }
  finally { ketThucChay(); }
}
async function qhLocTrungNgay() {
  const trung = qhTvDs.filter((x) => x.trung && !x.daXoa);
  if (!trung.length || dangChay) return;
  if (!confirm(`Đổi Họ và tên của ${trung.length} dòng TRÙNG trên trang thành "tên cũ + (X)" (Là đảng viên → Không)?\n\n` + trung.map((x) => `• ${x.ten}${x.namSinh ? " (" + x.namSinh + ")" : ""}`).join("\n") + `\n\nTiếp tục?`)) return;
  trangThai("qhTT", `Đang đổi ${trung.length} dòng trùng (tên + (X), Là đảng viên → Không)…`);
  batDauChay("qh"); // hiện thanh Tạm dừng / Dừng hẳn
  try {
    const tab = await layTab();
    if (tab.id !== tabDien) throw new Error("Tab đã đổi. Bấm lại nút thành viên để đọc lại trang.");
    await tiem(tab.id);
    const r = await chay(tab.id, (ds) => window.__dhsQHDoiTenDaXoa(ds), [trung.map((x) => ({ ten: x.ten, namSinh: x.namSinh }))]);
    let ok = 0;
    for (const k of (r && r.kq) || []) {
      const o = qhTvDs.find((x) => x.trung && !x.daXoa && khoaTen(x.ten) === khoaTen(k.ten));
      if (o) { o.daXoa = !!k.ok; o.tenMoi = k.tenMoi || ""; o.loiXoa = k.ok ? "" : (k.loi || "lỗi"); if (k.ok) ok++; }
    }
    luu(); veQHModal();
    trangThai("qhTT", `Đã đổi ${ok}/${trung.length} dòng trùng.` + ((r && r.dung) ? " (đã dừng hẳn)" : ""), ok === trung.length ? "ok" : "err");
  } catch (e) { trangThai("qhTT", e.message, "err"); }
  finally { ketThucChay(); }
}
async function soSanhDS(b) {
  try {
    const tab = await layTab();
    tabDien = tab.id;
    await tiem(tab.id);
    const r = await chay(tab.id, (bb, x) => window.__dhsDSSoSanh(bb, x), [b, hs().__ds[b].map(sach)]);
    if (!r || r.loiChung) return trangThai(`${b}TT`, r ? r.loiChung : "Không đọc được trang.", "err");
    dsSS[b] = r.ds.map((x) => x.daCo);
    dsTT[b] = {};
    trangThai(`${b}TT`, `Trên trang có ${r.soDong} dòng` + (r.trangSau ? " (bảng nhiều trang – tiện ích chỉ thấy trang đang mở)" : "") + `. File: ${dsSS[b].filter((x) => !x).length} mới, ${dsSS[b].filter(Boolean).length} đã có.`, r.trangSau ? "err" : "ok");
    veDS(b); veTongQuan();
  } catch (e) { trangThai(`${b}TT`, e.message, "err"); }
}
async function dienDS(b, opt) {
  const ds = hs().__ds[b], cf = DS_BUOC[b];
  const idx = ds.map((x, i) => i).filter((i) => ds[i].__chon !== false && dsTT[b][i] !== "luu");
  if (!idx.length) return;
  const loiNhac = opt ? `CẬP NHẬT ${idx.length} ${cf.don} (${cf.ten}) – GHI ĐÈ dữ liệu đang có trên trang.\n\n• CHỈ sửa dòng đã có trên trang; dòng chưa có thì BỎ QUA, KHÔNG bấm "Thêm mới".\n• Ô trên trang khác dữ liệu file thì lấy theo file.\n• Sau mỗi dòng tiện ích DỪNG: kiểm tra rồi bấm "Lưu thông tin" để sang dòng tiếp theo, hoặc "Đóng" để bỏ qua.`
    : `Điền ${idx.length} ${cf.don} (${cf.ten}).\n\n• Dòng MỚI: bấm "Thêm mới" rồi điền.\n• Dòng ĐÃ CÓ: chỉ điền ô còn trống, không đổi dữ liệu cũ` + (b === "qh" ? ' (riêng "Là đảng viên": file ghi Có thì chọn Có)' : "") + `.\n• Sau mỗi dòng tiện ích DỪNG: anh/chị kiểm tra, bấm "Lưu thông tin" để sang dòng tiếp theo, hoặc "Đóng" để bỏ qua.`;
  if (!confirm(loiNhac)) return;
  try {
    const tab = await layTab();
    if (tab.id !== tabDien) throw new Error("Tab đã đổi sau khi so sánh. Bấm So sánh lại.");
    await tiem(tab.id);
    dsChayIdx[b] = idx;
    const rowsDien = idx.map((i) => (b === "daotao" ? chuanB3(ds[i])[0] : sach(ds[i])));
    const r = await chay(tab.id, (bb, x, o) => window.__dhsDSDien(bb, x, o), [b, rowsDien, { ...(opt || {}), tuLuuNeuChuan: true }]);
    if (r && r.loiChung) throw new Error(r.loiChung);
    batDauChay(b); veDS(b);
    $(`${b}Kq`).innerHTML = "";
    trangThai(`${b}TT`, "Đang điền…");
  } catch (e) { trangThai(`${b}TT`, e.message, "err"); }
}
function hienMot(id, kq) {
  const the = el("div", { className: "ss" }, el("div", { className: "dau", textContent: kq.ten }));
  for (const o of kq.o) the.append(el("div", { className: "gt" }, el("span", { textContent: (o.ok ? "✔ " : "✘ ") + o.nhan + ": " + (o.ok ? o.hien : o.loi) })));
  $(id).prepend(the);
}

// ================= B9: HOÀN CẢNH KINH TẾ =================
const NHAN_KT = { trong: ["Ô trống – sẽ điền", "t-trong"], themMoi: ["Thêm dòng tài sản – sẽ điền", "t-trong"], khac: ["Đã có dữ liệu khác – giữ nguyên", "t-khac"], trung: ["Đã có, trùng", "t-trung"], chiTrang: ["Chỉ có trên trang", "t-trung"], an: ["Không có ô trên trang", "t-khoa"] };
function veKT() {
  const box = $("ktBang");
  box.innerHTML = "";
  if (!ktSS) { const d = hs(); trangThai("ktTT", d && Object.keys(d.__kt).some((k) => !k.startsWith("__")) ? "Mở mục 9 Hoàn cảnh kinh tế trên trang rồi bấm So sánh." : "File không có dữ liệu Hoàn cảnh kinh tế cho đảng viên này."); capNhatNut(); return; }
  for (const x of ktSS.ds) {
    const coThe = x.tt === "trong" || x.tt === "themMoi";
    const cb = el("input", { type: "checkbox", checked: !!x.chon, disabled: !coThe || dangChay });
    cb.onchange = () => { x.chon = cb.checked; capNhatNut(); };
    const [nhan, lop] = NHAN_KT[x.tt];
    const the = el("div", { className: "ss" + (x.tt === "khac" ? " khac" : "") }, el("div", { className: "dau" }, cb, el("span", { textContent: x.nhan })),
      el("div", { className: "gt" }, el("span", { className: "tag " + lop, textContent: nhan })));
    if (x.cu) the.append(el("div", { className: "gt" }, el("i", { textContent: "Trên trang:" }), x.cu));
    if (x.moi) the.append(el("div", { className: "gt" }, el("i", { textContent: "File:" }), x.moi));
    box.append(the);
  }
  capNhatNut();
}
async function soSanhKT() {
  try {
    const tab = await layTab();
    tabDien = tab.id;
    await tiem(tab.id);
    trangThai("ktTT", "Đang đọc trang…");
    const r = await chay(tab.id, (x) => window.__dhsKTSoSanh(x), [sach(hs().__kt)]);
    if (!r || r.loiChung) { ktSS = null; veKT(); return trangThai("ktTT", r ? r.loiChung : "Không đọc được trang.", "err"); }
    r.ds.forEach((x) => (x.chon = x.tt === "trong" || x.tt === "themMoi"));
    ktSS = r;
    { const d = hs(); if (d) { d.__thieuB9 = r.ds.filter((x) => !x.moi && !String(x.cu || '').trim()).map((x) => x.key); luu(); } }
    const n = (t) => r.ds.filter((x) => x.tt === t).length;
    trangThai("ktTT", `${n("trong") + n("themMoi")} ô trống sẽ điền · ${n("khac")} ô đã có dữ liệu khác (giữ nguyên) · ${n("trung")} ô trùng.`, n("khac") ? "err" : "ok");
    veKT(); veTongQuan();
  } catch (e) { trangThai("ktTT", e.message, "err"); }
}
$("ktSoSanh").onclick = soSanhKT;
async function dienKT() {
  const chon = ktSS.ds.filter((x) => x.chon).map((x) => x.key);
  if (!chon.length) return;
  if (!confirm(`Điền ${chon.length} ô Hoàn cảnh kinh tế (chỉ ô còn trống).\nTiện ích sẽ bấm "Chỉnh sửa thông tin" nếu cần, điền rồi DỪNG để anh/chị kiểm tra và tự bấm "Lưu thông tin".`)) return;
  try {
    const tab = await layTab();
    if (tab.id !== tabDien) throw new Error("Tab đã đổi sau khi so sánh. Bấm So sánh lại.");
    await tiem(tab.id);
    const r = await chay(tab.id, (x, c) => window.__dhsKTDien(x, c), [sach(hs().__kt), chon]);
    if (r && r.loiChung) throw new Error(r.loiChung);
    batDauChay("kt");
    $("ktKq").innerHTML = "";
    trangThai("ktTT", "Đang điền…");
  } catch (e) { trangThai("ktTT", e.message, "err"); }
}
$("ktDien").onclick = dienKT;

// ================= TIN NHẮN TỪ TRANG =================
chrome.runtime.onMessage.addListener((m, sender) => {
  if (!sender.tab) return;
  if (m.type === "dhs-rs") { rsNhanTin(m); return; }
  if (m.type === "dhs-rs-het") { if (rsVT && rsVT.ma === m.ma) rsVT.res(); return; }
  if (m.type === "dhs-progress") {
    trangThai("dkTT", `${m.paused ? "ĐANG TẠM DỪNG – " : ""}Đang điền ${m.n}/${m.tong}: ${m.nhan}`);
    if (buocDangChay === "b1") trangThai("tienDo", $("dkTT").textContent);
  } else if (m.type === "dhs-pause") {
    dangTamDung = m.paused;
    $("tamDung").textContent = dangTamDung ? "▶ Tiếp tục" : "❚❚ Tạm dừng";
  } else if (m.type === "dhs-done") {
    const b = buocDangChay;
    ketThucChay();
    if (b === "dd") hienKqDD(m); else hienKq(m.kq, m.biDoi, m.dung);
  } else if (m.type === "dhs-ds-cho") {
    const b = m.buoc;
    if (b === "kt") { trangThai("ktTT", 'Đã điền. Kiểm tra trên trang rồi bấm "Lưu thông tin" (hoặc "Đóng" để bỏ).', "ok"); $("ktKq").innerHTML = ""; hienMot("ktKq", m.kq); }
    else {
      dsTT[b][dsChayIdx[b][m.i]] = "cho"; veDS(b);
      trangThai(`${b}TT`, `Dòng ${m.i + 1}/${m.tong}: ${m.kq.ten} – đã điền. Kiểm tra rồi bấm "Lưu thông tin" trên trang (hoặc "Đóng" để bỏ qua).`, "ok");
      $(`${b}Kq`).innerHTML = ""; hienMot(`${b}Kq`, m.kq);
    }
    trangThai("dkTT", 'Đang chờ anh/chị kiểm tra và bấm "Lưu thông tin" trên trang…');
  } else if (m.type === "dhs-ds-loi") {
    trangThai("dkTT", "Trang báo lỗi khi lưu: " + m.loi.join("; ") + ". Sửa trên trang rồi bấm Lưu lại.", "err");
  } else if (m.type === "dhs-ds-mot") {
    const b = m.buoc;
    if (b === "kt") { if (m.kq.ketQua === "loi") hienMot("ktKq", { ...m.kq, o: [{ ok: false, nhan: "Lỗi", loi: m.kq.loi }] }); return; }
    const i = dsChayIdx[b][m.kq.i];
    if (i != null) dsTT[b][i] = m.kq.ketQua === "luu" ? "luu" : m.kq.ketQua === "loi" ? "loi" : "dong";
    if (m.kq.ketQua === "loi") hienMot(`${b}Kq`, { ...m.kq, o: [{ ok: false, nhan: "Lỗi", loi: m.kq.loi }] });
    veDS(b);
  } else if (m.type === "dhs-ds-xong") {
    ketThucChay();
    const b = m.buoc, luuN = m.tong.filter((k) => k.ketQua === "luu").length;
    if (b === "kt") trangThai("ktTT", m.tong[0].ketQua === "luu" ? "Đã bấm Lưu thông tin Hoàn cảnh kinh tế." : m.tong[0].ketQua === "dong" ? "Đã đóng, không lưu." : "Dừng: " + (m.tong[0].loi || m.tong[0].ketQua), m.tong[0].ketQua === "luu" ? "ok" : "err");
    else { trangThai(`${b}TT`, `Xong ${DS_BUOC[b].ten}: đã lưu ${luuN}/${m.tong.length} dòng` + (m.dung ? " (đã dừng hẳn)." : "."), "ok"); veDS(b); }
  } else if (m.type === "dhs-auto-cho") {
    trangThai("tdTT", `${TEN_MUC[m.muc] || m.muc} – ${m.ten}: trang báo lỗi khi lưu (${m.loi}). Sửa trên trang rồi bấm "Lưu thông tin" – tiện ích sẽ chạy tiếp; hoặc bấm "Đóng" trên biểu mẫu để bỏ qua dòng này.`, "err");
  } else if (m.type === "dhs-saved") {
    if (tdDangChay) return;
    if (m.loi && m.loi.length) { trangThai("tienDo", "Trang báo lỗi sau khi bấm Lưu, chưa chuyển hồ sơ: " + m.loi.join("; "), "err"); return; }
    const i = chiSo();
    daLuu[i] = true;
    if ($("tuDong").checked && i < hoSo.length - 1) {
      veDanhSach(i + 1);
      choTrangMoi = true;
      trangThai("tt", `Đã lưu B1 hồ sơ ${i + 1}. Chuyển sang hồ sơ ${i + 2}: mở trang của đảng viên này (hoặc trang Thêm mới), tiện ích sẽ tự so sánh B1.`, "ok");
    } else {
      veDanhSach(i);
      trangThai("tt", `Đã lưu B1 hồ sơ ${i + 1}.` + (i >= hoSo.length - 1 ? " Đây là hồ sơ cuối cùng." : ""), "ok");
    }
    luu();
  }
});

// Sau khi Lưu B1: khi trang hồ sơ mới tải xong thì tự so sánh (không tự điền)
let henGio = null;
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (!choTrangMoi || dangChay || !(info.status === "complete" || info.url)) return;
  if (!/^https:\/\/tcxdd\.dcs\.vn\/dangvien\/pages\/profile-manage\/party-member\/(create|view\/\d+)/.test(tab.url || "")) return;
  clearTimeout(henGio);
  henGio = setTimeout(async () => {
    for (let i = 0; i < 10; i++) {
      const co = await chay(tabId, () => !!document.querySelector('[formcontrolname="currentFullName"]')).catch(() => false);
      if (co) {
        choTrangMoi = false;
        if ($("khuRaSoat") && !$("khuRaSoat").hidden) return;
        if ($("tdTuChay").checked) { if (tdKichHoat && hs()) chayTuDong(); else trangThai("tdTT", "Bấm \"▶ Bắt đầu chạy\" để tự động điền hồ sơ này.", "ok"); }
        else soSanh();
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }, 1200);
});

// ================= KHÔI PHỤC PHIÊN =================
chrome.storage.session.get(["hoSo", "ten", "chon", "daLuu"], (s) => {
  if (s.hoSo && s.hoSo.length) {
    hoSo = s.hoSo; daLuu = s.daLuu || {};
    hoSo.forEach((d) => { d.__ds = d.__ds || { qtct: [], qh: d.__nguoiThan || [] }; DS_KEYS.forEach((b) => (d.__ds[b] = d.__ds[b] || [])); d.__kt = d.__kt || {}; d.__dd = d.__dd || {}; });
    trangThai("tt", `Đang dùng ${hoSo.length} hồ sơ từ ${s.ten || "file đã nhập"} (tự xóa khi đóng trình duyệt).`);
    veDanhSach(s.chon || 0);
  }
});
DS_KEYS.forEach(veDS); veDD();


// ================= TẢI DỮ LIỆU ĐÃ LƯU TRÊN ĐÁM MÂY (Firebase) =================
const FB_URL = "https://hung-da4c1-default-rtdb.asia-southeast1.firebasedatabase.app";
let dsMay = [];
const MA_BI_MAT_MAC_DINH = "uPjRMZvtogiFls0X2n71sd5o098RcsPdVfxjPUBm"; // mã bí mật cơ sở dữ liệu tích hợp sẵn; vẫn có thể sửa ở ô bên dưới
chrome.storage.local.get(["fbSecret"], (s) => { $("fbSecret").value = s.fbSecret || MA_BI_MAT_MAC_DINH; });
$("fbSecret").onchange = () => chrome.storage.local.set({ fbSecret: $("fbSecret").value.trim() });
async function fbDoc(path) {
  const secret = $("fbSecret").value.trim();
  if (!secret) { $("caiMay").open = true; throw new Error("Chưa nhập mã bí mật trong mục Cài đặt đám mây."); }
  const r = await fetch(`${FB_URL}/${path}.json?auth=${encodeURIComponent(secret)}`);
  const t = await r.text();
  if (!r.ok) {
    let m = t; try { m = JSON.parse(t).error || t; } catch (e) {}
    throw new Error(r.status === 401 || /permission|auth/i.test(m) ? "Sai mã bí mật hoặc không có quyền đọc." : `Lỗi máy chủ ${r.status}: ${m}`);
  }
  return t ? JSON.parse(t) : null;
}
const khongDau = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
const daNhapTD = (x) => x.trangThai === "đã nhập tự động" || /đã rà soát/i.test(x.trangThai || "") || !!x.daRaSoat;
const locDsMay = () => {
  const q = khongDau($("locMay").value.trim());
  return dsMay.filter((x) => ($("hienDaNhap").checked || !daNhapTD(x)) && (!q || khongDau(`${x.ten} ${x.cccd} ${x.id} ${x.nguoiNhap}`).includes(q)));
};
function veDsMay() {
  const box = $("dsMay"); box.innerHTML = "";
  const hien = locDsMay();
  hien.forEach((x) => {
    const cb = el("input", { type: "checkbox", checked: !!x.chon });
    cb.onchange = () => { x.chon = cb.checked; demChon(); };
    box.append(el("label", {}, cb, el("div", {}, el("b", { textContent: x.ten || "(chưa có họ tên)" }),
      el("small", { textContent: `ID ${x.id}${x.ngaySinh ? " · sinh " + x.ngaySinh : ""} · ${x.soCongTac || 0} dòng công tác · ${x.soNguoiThan || 0} người thân` }),
      el("small", { textContent: `Lưu bởi ${x.nguoiNhap || "?"} lúc ${x.capNhat || "?"}` + (daNhapTD(x) ? (x.daRaSoat || /đã rà soát/i.test(x.trangThai || "") ? " · ✔ ĐÃ RÀ SOÁT" : " · ✔ ĐÃ NHẬP TỰ ĐỘNG") : "") }))));
  });
  if (!hien.length) box.append(el("div", { className: "note", style: "padding:6px 8px", textContent: "Không có hồ sơ phù hợp." }));
  $("chonHetMay").checked = hien.length > 0 && hien.every((x) => x.chon);
  demChon();
}
function demChon() { const n = dsMay.filter((x) => x.chon).length; $("napMay").disabled = !n || dangChay; $("napMay").textContent = `Nạp ${n} hồ sơ đã chọn`; }
$("locMay").oninput = veDsMay;
$("chonHetMay").onchange = () => { locDsMay().forEach((x) => (x.chon = $("chonHetMay").checked)); veDsMay(); };
$("hienDaNhap").onchange = () => { dsMay.forEach((x) => { if (daNhapTD(x) && !$("hienDaNhap").checked) x.chon = false; }); veDsMay(); };
$("taiMay").onclick = async () => {
  $("taiMay").disabled = true; trangThai("ttMay", "Đang tải danh sách hồ sơ…");
  try {
    const [ds0, rs0] = await Promise.all([fbDoc("dsHoSo"), fbDoc("rasoat").catch(() => null)]);
    const ds = ds0 || {}, rs = rs0 || {};
    // Hồ sơ đã rà soát (theo bảng rà soát) cũng bị ẩn để khỏi nạp nhầm
    dsMay = Object.entries(ds).map(([id, x]) => ({ id, ...x, daRaSoat: !!(rs[id] && /đã rà soát/i.test(rs[id].trangThai || "")), chon: false })).sort((a, b) => String(a.ten).localeCompare(String(b.ten), "vi"));
    $("khuMay").hidden = !dsMay.length;
    veDsMay();
    const choNhap = dsMay.filter((x) => !daNhapTD(x)).length;
    trangThai("ttMay", dsMay.length ? `Có ${choNhap} hồ sơ chưa nhập` + (dsMay.length > choNhap ? ` (đã ẩn ${dsMay.length - choNhap} hồ sơ đã nhập tự động/đã rà soát)` : "") + ". Chọn hồ sơ cần điền rồi bấm Nạp." : "Chưa có hồ sơ nào trên đám mây.", dsMay.length ? "ok" : "");
  } catch (e) { trangThai("ttMay", "Lỗi: " + e.message, "err"); }
  finally { $("taiMay").disabled = false; }
};
$("napMay").onclick = async () => {
  if (dangChay) return;
  const chon = dsMay.filter((x) => x.chon);
  if (hoSo.length && !confirm(`Nạp ${chon.length} hồ sơ từ đám mây sẽ THAY danh sách đang dùng (${hoSo.length} hồ sơ). Tiếp tục?`)) return;
  $("napMay").disabled = true;
  const kq = [], loi = [];
  for (const [i, x] of chon.entries()) {
    trangThai("ttMay", `Đang nạp ${i + 1}/${chon.length}: ${x.ten}…`);
    try {
      const r = await fbDoc("hoso/" + encodeURIComponent(x.id));
      if (!r) throw new Error("không còn trên đám mây");
      const d = {};
      for (const [k, v] of Object.entries(r.hoSo || {})) if (KHOA.includes(k) && v != null && v !== "") d[k] = String(v);
      const mang = (a) => (Array.isArray(a) ? a : Object.values(a || {})).filter((o) => o && typeof o === "object");
      d.__idMay = x.id; d.__dong = "☁";
      // Văn bản viết tay: mặc định KHÔNG tích; người dùng tự tích khi cần (không lấy theo đám mây)
      d.__ds = { qtct: mang(r.quaTrinhCongTac), qh: mang(r.quanHeGiaDinh) };
      for (const b of Object.keys(DS_THEM)) d.__ds[b] = mang(r[b]);
      // Chuẩn hóa B3 ngay khi nạp để Tổng quan hiện giá trị đã chuẩn (giữ vết để vẫn báo rà soát lúc điền)
      (d.__ds.daotao || []).forEach((row) => { const rB3 = chuanB3(row); row.__macDinh = { ...(row.__macDinh || {}), ...rB3[1] }; });
      d.__dd = { ...(r.dacDiemLichSu || {}) };
      d.__kt = { ...(r.hoanCanhKinhTe || {}) };
      ganNghi(d, r);
      kq.push(d);
    } catch (e) { loi.push(`${x.ten}: ${e.message}`); }
  }
  if (kq.length) {
    hoSo = kq; daLuu = {};
    veDanhSach(0);
    await luu();
    await chrome.storage.session.set({ ten: "đám mây" });
    trangThai("tt", `Đã nạp ${kq.length} hồ sơ từ đám mây. Xem và sửa ở mục "Tổng quan" bên dưới.`, "ok");
    batDauTuDongSauNap();
    hienPopupNghi();
  }
  trangThai("ttMay", `Đã nạp ${kq.length}/${chon.length} hồ sơ.` + (loi.length ? " Lỗi: " + loi.join("; ") : ""), loi.length ? "err" : "ok");
  demChon();
};


// Ô AI chưa chắc (app quét v5/v6 lưu trong "nghi" và "lyDo"): gắn vào từng ô để tô đỏ và báo lại
// Nhóm trong app quét: b1, ct (= qtct), qh, kt, dd và các mục bổ sung cùng tên
function ganNghi(d, r) {
  const nghi = r.nghi || {}, lyDo = r.lyDo || {};
  const ds = (a) => (Array.isArray(a) ? a : Object.values(a || {})).map(String);
  // Khóa lý do dạng "0.fromDate" được lưu thành "0_fromDate" (Firebase cấm dấu chấm trong khóa)
  const ld = (nhom, ma) => (lyDo[nhom] || {})[ma] || (lyDo[nhom] || {})[String(ma).replace(/\./g, "_")] || "cần đối chiếu hồ sơ gốc";
  const mot = (nhom, dich, coKhoa) => { for (const k of ds(nghi[nhom])) if (coKhoa(k)) (dich.__nghi = dich.__nghi || {})[k] = ld(nhom, k); };
  const goc = { __nghi: {} };
  mot("b1", goc, (k) => !!d[k]);
  if (Object.keys(goc.__nghi).length) d.__nghi = goc.__nghi;
  mot("dd", d.__dd, (k) => !!d.__dd[k]);
  mot("kt", d.__kt, (k) => !!d.__kt[k]);
  for (const [nhom, b] of [["ct", "qtct"], ["qh", "qh"], ...Object.keys(DS_THEM).map((k) => [k, k])]) {
    for (const ma of ds(nghi[nhom])) {
      const m = ma.match(/^(\d+)\.(\w+)$/);
      const x = m && d.__ds[b][Number(m[1])];
      if (nhom === "ct" && m && m[2] === "toDate") continue; // "Đến tháng/năm" không bắt buộc: bỏ qua nghi ngờ AI
      if (x && x[m[2]]) (x.__nghi = x.__nghi || {})[m[2]] = ld(nhom, ma);
    }
  }
}
// Danh sách ô AI chưa chắc của một hồ sơ: [{muc, nhan, gt, lyDo, quanTrong}]
const QUAN_TRONG = ["currentFullName", "birthDate", "identifyNo", "gender", "officialJoinPartyDate", "officialRecognitionDate", "cardNumber", "activityOfficialOrgId"];
function dsNghi(d) {
  const kq = [];
  const NB1 = Object.fromEntries(TRUONG_HO_SO.map((t) => [t[0], t[1]])), NDD = Object.fromEntries(TRUONG_DD.map((t) => [t[0], t[1]])), NKT = Object.fromEntries(KT_TRUONG);
  for (const [k, l] of Object.entries(d.__nghi || {})) kq.push({ muc: "b1", nhan: NB1[k] || k, gt: d[k], lyDo: l, quanTrong: QUAN_TRONG.includes(k) });
  for (const b of DS_KEYS) {
    const cf = DS_BUOC[b], nh = Object.fromEntries(cf.truong);
    d.__ds[b].forEach((x) => { for (const [k, l] of Object.entries(x.__nghi || {})) kq.push({ muc: b, nhan: `${cf.nhan(x)} – ${nh[k] || k}`, gt: x[k], lyDo: l, quanTrong: k === "fullName" || k === "identifyNo" }); });
  }
  for (const [k, l] of Object.entries(d.__dd.__nghi || {})) kq.push({ muc: "dd", nhan: NDD[k] || k, gt: d.__dd[k], lyDo: l });
  for (const [k, l] of Object.entries(d.__kt.__nghi || {})) kq.push({ muc: "kt", nhan: NKT[k] || k, gt: d.__kt[k], lyDo: l });
  return kq;
}

// v0.8.9.8: popup các trường AI chưa chắc ngay sau khi Nạp hồ sơ, kèm textbox sửa luôn
function hienPopupNghi() {
  const modal = $("nghiModal"), box = $("nghiDs");
  if (!modal || !box) return;
  box.innerHTML = "";
  let tong = 0;
  const NB1 = Object.fromEntries(TRUONG_HO_SO.map((t) => [t[0], t[1]]));
  const NDD = Object.fromEntries(TRUONG_DD.map((t) => [t[0], t[1]]));
  const NKT = Object.fromEntries(KT_TRUONG);
  const hang = (tieuDe, ten, gt, lyDo, datFn, xoaFn) => {
    tong++;
    const inp = el("input", { value: gt || "", title: lyDo });
    // v0.9.0: sửa trong popup = sửa trực tiếp Tổng quan; đã chạm là coi như đã rà soát → xóa cờ nghi
    inp.onchange = () => { const v = inp.value.trim(); datFn(v); try { xoaFn(); } catch (e) {} inp.style.background = "#e6f4ea"; luu(); veTongQuan(); veThieu(); };
    box.append(el("div", { className: "tq-o" }, el("span", { textContent: ten, title: lyDo }), inp));
  };
  hoSo.forEach((d) => {
    const ds = [];
    for (const [k, l] of Object.entries(d.__nghi || {})) ds.push([(TEN_MUC.b1 + " · " + (NB1[k] || k)), d[k], l, (v) => { if (v) d[k] = v; else delete d[k]; }, () => delete d.__nghi[k]]);
    for (const b of DS_KEYS) {
      const cf = DS_BUOC[b], nh = Object.fromEntries(cf.truong);
      (d.__ds[b] || []).forEach((row) => { for (const [k, l] of Object.entries(row.__nghi || {})) ds.push([(TEN_MUC[b] + " · " + cf.nhan(row) + " – " + (nh[k] || k)), row[k], l, (v) => { if (v) row[k] = v; else delete row[k]; }, () => delete row.__nghi[k]]); });
    }
    for (const [k, l] of Object.entries((d.__dd || {}).__nghi || {})) ds.push([(TEN_MUC.dd + " · " + (NDD[k] || k)), d.__dd[k], l, (v) => { if (v) d.__dd[k] = v; else delete d.__dd[k]; }, () => delete d.__dd.__nghi[k]]);
    for (const [k, l] of Object.entries((d.__kt || {}).__nghi || {})) ds.push([(TEN_MUC.kt + " · " + (NKT[k] || k)), d.__kt[k], l, (v) => { if (v) d.__kt[k] = v; else delete d.__kt[k]; }, () => delete d.__kt.__nghi[k]]);
    if (!ds.length) return;
    box.append(el("div", { className: "nhs", textContent: `${d.currentFullName || "(chưa có họ tên)"} – CCCD: ${d.identifyNo || "chưa có"} (${ds.length} ô)` }));
    ds.forEach(([ten, gt, lyDo, datFn, xoaFn]) => hang(0, ten, gt, "⚠ AI chưa chắc: " + lyDo, datFn, xoaFn));
  });
  if (!tong) return;
  $("nghiTieuDe").textContent = `⚠ ${tong} trường AI chưa chắc – sửa luôn rồi bấm Xong (vẫn chạy tiếp nếu để nguyên)`;
  modal.hidden = false;
  // v0.9.0: bấm Xong → đóng + ghi thẳng vào Tổng quan (sửa trực tiếp các trường chuẩn bị điền)
  $("nghiXong").onclick = async () => {
    modal.hidden = true;
    try { await luu(); } catch (e) {}
    try { veDanhSach(chiSo()); } catch (e) { try { veTongQuan(); veThieu(); } catch (e2) {} }
    if ($("tongQuan")) $("tongQuan").open = true;
    trangThai("tt", `Đã cập nhật ${tong} ô AI chưa chắc vào Tổng quan dữ liệu chuẩn bị điền. Kiểm tra lại ở Tổng quan rồi chạy tiếp.`, "ok");
  };
}

// ================= CÒN THIẾU – CẦN BỔ SUNG =================
// Trường B1 hệ thống đánh dấu * (quan sát trên trang Chỉnh sửa thông tin cơ bản, 10/2026)
const BAT_BUOC_B1 = ["activityOfficialOrgId", "currentFullName", "gender", "birthDate", "abroadStatus", "birthNationId", "birthProvinceId", "birthCommuneId",
  "hometownNationId", "hometownProvinceId", "hometownCommuneId", "residentNationId", "residentProvinceId", "residentCommuneId", "ethnicityId", "religionId",
  "currentOccupationId", "officialJoinPartyDate", "officialRecognitionDate", "educationLevelId", "identifyNo"];
// Các mục tiện ích chưa điền tự động – trường bắt buộc (*) quan sát trên trang, để nhắc nhập tay
const MUC_NHAP_TAY = [
  ["11 Quá trình sinh hoạt Đảng", "hệ thống tự ghi khi chuyển sinh hoạt, không có nút Thêm mới – không cần nhập"],
  ["Thông tin cơ bản (chỉ có khi sửa)", "Trạng thái hoạt động; Chức vụ đảng, chính quyền, đoàn thể, doanh nghiệp hiện nay – nhập tay"],
  ["B3 Đào tạo", "Ngoại ngữ bắt buộc khi đào tạo ngoại ngữ; Trình độ bắt buộc với một số loại khác"],
];

// Trường chính của từng dòng B2, B8 (dùng để nhắc thiếu; các trường phụ như ghi chú không nhắc)
const CHINH_DS = { qtct: ["fromDate", "companyName", "companyPosition"], qh: ["type", "familyMemberId", "fullName", "birthDate"] };
function dsThieu(d) {
  const kq = [];
  // B1
  const NHAN_B1 = Object.fromEntries(TRUONG_HO_SO.map((t) => [t[0], t[1]])), NHAN_B9 = Object.fromEntries(KT_TRUONG);
  const c1 = d.__thieuB1 && d.__thieuB1.map((x) => (typeof x === "string" ? { k: x, bb: false } : x)).filter((x) => !d[x.k]);
  const t1 = c1 && c1.filter((x) => x.bb).map((x) => NHAN_B1[x.k] || x.k);
  const t1p = c1 && c1.filter((x) => !x.bb).map((x) => NHAN_B1[x.k] || x.k);
  const t9 = d.__thieuB9 && d.__thieuB9.filter((k) => !d.__kt[k]).map((k) => NHAN_B9[k] || k);
  if (t1) {
    kq.push(["B1 – trường BẮT BUỘC (*)", t1.length ? t1 : null, "hệ thống đánh dấu *, phải bổ sung mới lưu được"]);
    kq.push(["B1 – trường không bắt buộc", t1p.length ? t1p : null, "còn trống, bổ sung nếu hồ sơ gốc có", true]);
  }
  else {
    const bb = BAT_BUOC_B1.filter((k) => KHOA.includes(k) && !d[k]).map((k) => NHAN_B1[k] || k);
    kq.push(["B1 – trường BẮT BUỘC (*)", bb.length ? bb : null, "theo dữ liệu, chưa đối chiếu trang – bấm So sánh để loại trường trang đã có"]);
    kq.push(["B1 – trường không bắt buộc", undefined, `dữ liệu đang trống ${KHOA.filter((k) => !d[k] && !BAT_BUOC_B1.includes(k)).length} trường – bấm So sánh để xem chi tiết.`]);
  }
  // B2, B8
  for (const b of DS_KEYS) {
    const cf = DS_BUOC[b], ds = d.__ds[b] || [], ten = cf.so + " " + cf.ten, them = !!DS_THEM[b];
    if (!ds.length) { if (them) continue; kq.push([ten, [`Chưa có ${cf.don} nào`]]); continue; }
    const nhanCua = Object.fromEntries(cf.truong);
    const ls = [];
    ds.forEach((x, i) => { const t = (CHINH_DS[b] || cf.bb).filter((k) => !String(x[k] || "").trim()).map((k) => nhanCua[k]); if (t.length) ls.push(`Dòng ${i + 1} (${cf.nhan(x)}): ${t.join(", ")}`); });
    kq.push([ten, ls.length ? ls : null]);
  }
  // B9
  if (t9) kq.push(["B9 Hoàn cảnh kinh tế", t9.length ? t9 : null, "trống cả trong dữ liệu lẫn trên trang"]);
  else if (!KT_TRUONG.some(([k]) => d.__kt[k])) kq.push(["B9 Hoàn cảnh kinh tế", ["Chưa có dữ liệu hoàn cảnh kinh tế"]]);
  else kq.push(["B9 Hoàn cảnh kinh tế", undefined, `chưa so sánh – dữ liệu đang trống ${KT_TRUONG.filter(([k]) => !d.__kt[k]).length}/${KT_TRUONG.length} ô.`]);
  return kq;
}
function vanBanThieu(d) {
  const dong = [`Hồ sơ: ${d.currentFullName || "(chưa có họ tên)"} – CCCD: ${d.identifyNo || "chưa có"}${d.__idMay ? " – ID " + d.__idMay : ""}`];
  const ng = dsNghi(d);
  if (ng.length) dong.push("AI chưa chắc – cần rà soát:", ...ng.map((x) => `  - ${TEN_MUC[x.muc] || x.muc} · ${x.nhan}: "${x.gt}" (${x.lyDo})`));
  for (const [ten, ls, ghi] of dsThieu(d)) {
    if (ls === null) continue;
    if (ls === undefined) { dong.push(`${ten}: ${ghi}`); continue; }
    dong.push(`${ten}${ghi ? " (" + ghi + ")" : ""}:`, ...ls.map((x) => "  - " + x));
  }
  dong.push("Lưu ý:", ...MUC_NHAP_TAY.map(([m, t]) => `  - ${m}: ${t}`));
  return dong.join("\n");
}
function veThieu() {
  const box = $("thieu"), d = hs();
  if (!box) return;
  box.innerHTML = "";
  if (!d) return;
  const ds = dsThieu(d);
  const soMuc = ds.reduce((s, [, ls, , phu]) => s + (Array.isArray(ls) && !phu ? ls.length : 0), 0);
  const ng = dsNghi(d);
  if (ng.length) {
    const kn = el("details", { className: "muc nghi-ds", open: ng.length <= 8 }, el("summary", { textContent: `⚠ AI chưa chắc – cần rà soát (${ng.length} ô${ng.some((x) => x.quanTrong) ? ", có trường quan trọng" : ""})` }));
    ng.sort((a, b) => b.quanTrong - a.quanTrong).forEach((x) => kn.append(el("div", {}, el("i", { textContent: `${TEN_MUC[x.muc] || x.muc} · ${x.nhan}${x.quanTrong ? " (quan trọng)" : ""}: ` }), `"${x.gt}" – ${x.lyDo}`)));
    box.append(kn);
  }
  box.append(el("b", { textContent: soMuc ? `Còn thiếu – cần bổ sung (${soMuc} mục chính)` : "Còn thiếu – cần bổ sung" }));
  for (const [ten, ls, ghi, phu] of ds) {
    const m = el("div", { className: "muc" }, el("i", { textContent: ten + ": " }));
    if (phu && Array.isArray(ls)) {
      const ct = el("details", {}, el("summary", { textContent: `${ls.length} trường – bấm để xem` }), el("div", { textContent: ls.join("; ") }));
      m.append(ct); box.append(m); continue;
    }
    if (ls === null) m.append("✓ đủ" + (ghi ? "" : " các trường chính"));
    else if (ls === undefined) m.append(el("span", { className: "hd", textContent: ghi }));
    else { if (ghi) m.append(el("span", { className: "hd", textContent: `(${ghi}) ` })); m.append(ls.join("; ")); }
    box.append(m);
  }
  const tay = el("details", { className: "muc" }, el("summary", { textContent: "Lưu ý các mục nhập tay / điều kiện" }));
  MUC_NHAP_TAY.forEach(([m, t]) => tay.append(el("div", {}, el("i", { textContent: m + ": " }), t)));
  box.append(tay);
  const nut = el("span", { className: "lienKet", textContent: "📋 Sao chép danh sách thiếu", onclick: async () => {
    const t = vanBanThieu(d);
    try { await navigator.clipboard.writeText(t); nut.textContent = "✓ Đã sao chép"; }
    catch (e) { prompt("Sao chép nội dung sau:", t); }
    setTimeout(() => (nut.textContent = "📋 Sao chép danh sách thiếu"), 2000);
  } });
  box.append(el("div", { className: "muc" }, nut));
}


// ================= B6: ĐẶC ĐIỂM LỊCH SỬ (một biểu mẫu, dùng chung cơ chế so sánh/điền của B1) =================
const OPT_DD = { truong: TRUONG_DD, khoa: "leaveDate", ten: "6 Đặc điểm lịch sử" };
function veDD() {
  const p = $("p_dd"), d = hs();
  if (!p) return;
  if (!p.childElementCount) {
    p.append(
      el("p", { className: "note", textContent: 'Trên trang: mở mục 6 Đặc điểm lịch sử, bấm "Chỉnh sửa thông tin" rồi mới bấm So sánh.' }),
      el("button", { id: "ddSoSanh", className: "full", textContent: "So sánh B6 với dữ liệu trên trang", onclick: soSanhDD }),
      el("div", { id: "ddTT", className: "tt" }), el("div", { id: "ddBang" }),
      el("button", { id: "ddDien", className: "primary full", disabled: true, onclick: dienDD }), el("div", { id: "ddKq" }));
  }
  const box = $("ddBang"); box.innerHTML = "";
  if (!d) return;
  const coDL = TRUONG_DD.filter(([k]) => d.__dd[k]).length;
  if (!ddSS) { trangThai("ddTT", coDL ? `Dữ liệu có ${coDL} ô B6.` : "Dữ liệu không có thông tin Đặc điểm lịch sử cho đảng viên này (đa số đảng viên để trống mục này)."); capNhatNut(); return; }
  for (const x of ddSS.ds) {
    const coThe = x.tt === "trong" || x.tt === "khac";
    const cb = el("input", { type: "checkbox", checked: !!x.chon, disabled: !coThe || dangChay });
    cb.onchange = () => { x.chon = cb.checked; capNhatNut(); };
    const [nhan, lop] = NHAN_TT[x.tt];
    const the = el("div", { className: "ss" + (x.tt === "khac" ? " khac" : "") }, el("div", { className: "dau" }, cb, el("span", { textContent: x.nhan })),
      el("div", { className: "gt" }, el("span", { className: "tag " + lop, textContent: nhan })));
    if (x.cu) the.append(el("div", { className: "gt" }, el("i", { textContent: "Trên trang:" }), x.cu));
    the.append(el("div", { className: "gt" }, el("i", { textContent: "File:" }), x.moi));
    box.append(the);
  }
  capNhatNut();
}
async function soSanhDD() {
  const d = hs(); if (!d) return;
  ddSS = null; $("ddKq").innerHTML = "";
  try {
    const tab = await layTab(); tabDien = tab.id;
    await tiem(tab.id);
    const duLieu = Object.fromEntries(TRUONG_DD.filter(([k]) => d.__dd[k]).map(([k]) => [k, d.__dd[k]]));
    const r = await chay(tab.id, (x, o) => window.__dhsSoSanh(x, o), [duLieu, OPT_DD]);
    if (!r || r.loiChung) { veDD(); return trangThai("ddTT", r ? r.loiChung : "Không đọc được trang.", "err"); }
    r.ds.forEach((x) => (x.chon = x.tt === "trong"));
    ddSS = r;
    const khoa = r.ds.filter((x) => x.tt === "khoa").length;
    veDD();
    trangThai("ddTT", (r.ds.length ? `${r.ds.filter((x) => x.tt === "trong").length} ô trống sẽ điền, ${r.ds.filter((x) => x.tt === "khac").length} ô khác dữ liệu (giữ nguyên nếu không tích).` : "Dữ liệu không có ô B6 nào để điền.") +
      (khoa ? ` ${khoa} ô đang khóa – bấm "Chỉnh sửa thông tin" trên trang rồi So sánh lại.` : ""), khoa ? "err" : "ok");
  } catch (e) { trangThai("ddTT", e.message, "err"); }
}
async function dienDD() {
  const chon = ddSS ? ddSS.ds.filter((x) => x.chon) : [];
  if (!chon.length) return;
  const thay = chon.filter((x) => x.tt === "khac");
  if (thay.length && !confirm(`Xác nhận THAY ${thay.length} ô đang có dữ liệu cũ:\n\n` + thay.map((x) => `• ${x.nhan}: "${x.cu}" → "${x.moi}"`).join("\n"))) return;
  try {
    const tab = await layTab();
    if (tab.id !== tabDien) throw new Error("Tab đã đổi sau khi so sánh. Bấm So sánh lại.");
    await tiem(tab.id);
    const r = await chay(tab.id, (m, t) => { window.__dhsTRUONG = t; return window.__dhsDien(m); }, [chon.map((x) => ({ key: x.key, moi: x.moi, cu: x.cu })), TRUONG_DD]);
    if (r && r.loiChung) throw new Error(r.loiChung);
    batDauChay("dd");
    trangThai("ddTT", "Đang điền…");
  } catch (e) { trangThai("ddTT", e.message, "err"); }
}
function hienKqDD(m) {
  const ok = m.kq.filter((x) => x.ok).length;
  trangThai("ddTT", (m.dung ? "Đã dừng hẳn. " : "Xong. ") + `${ok}/${m.kq.length} ô đã điền. Kiểm tra trang rồi tự bấm Lưu.`, ok === m.kq.length ? "ok" : "err");
  const k = $("ddKq"); k.innerHTML = "";
  for (const d of [...(m.biDoi || []), ...m.kq]) k.append(el("div", { className: "ss" }, el("span", { textContent: (d.ok ? "✔ " : "✘ ") + d.nhan + (d.ok ? "" : " — " + d.loi) })));
  ddSS = null;
}


// ================= CHẠY TỰ ĐỘNG B1 → B10 =================
// Dữ liệu trong file/đám mây là dữ liệu chuẩn: điền ô trống và THAY ô khác dữ liệu, tự bấm "Lưu thông tin" từng mục.
// Dừng hỏi khi: có thể không đúng người (họ tên/CCCD/ngày sinh khác) và – nếu bật – khi ghi đè trường quan trọng.
// Bước cuối "Đóng hồ sơ" do người dùng xác nhận.
const THU_TU = ["b1", "qtct", "daotao", "huyhieu", "khenthuong", "danhgia", "kyluat", "dd", "nuocngoai", "qh", "kt", "mxh"];
const TEN_MUC = { b1: "B1 Thông tin cơ bản", dd: "B6 Đặc điểm lịch sử", kt: "B9 Hoàn cảnh kinh tế" };
for (const b of DS_KEYS) TEN_MUC[b] = `${DS_BUOC[b].so} ${DS_BUOC[b].ten}`;
let td = null, tdDangChay = false, cheDoMau = false;
let cheDoSuper = false;

(function veKhuTuDong() {
  const sel = $("tuMuc");
  sel.innerHTML = THU_TU.map((m) => `<option value="${m}">${TEN_MUC[m]}</option>`).join("");
  try { const v = JSON.parse(localStorage.getItem("dhs_td") || "{}"); if (v.hoiNghi === true) $("tdHoiNghi").checked = true; if (v.macDinh === false) $("tdMacDinh").checked = false; if (v.md) { $("tdMdQG").value = v.md[0] || ""; $("tdMdTinh").value = v.md[1] || ""; $("tdMdXa").value = v.md[2] || ""; } if (v.tuChay === false) $("tdTuChay").checked = false; if (v.boQuaB1 === true) $("tdBoQuaB1").checked = true; if (v.tuMuc && THU_TU.includes(v.tuMuc)) sel.value = v.tuMuc; if (v.cheDo) $("tdCheDo").value = v.cheDo; if (v.tuLuu10 === false) $("tdTuLuu10").checked = false; if (v.tuSuper === true) $("tdSuper").checked = true; } catch (e) {}
  const ghi = () => { try { localStorage.setItem("dhs_td", JSON.stringify({ hoiNghi: $("tdHoiNghi").checked, macDinh: $("tdMacDinh").checked, md: [$("tdMdQG").value, $("tdMdTinh").value, $("tdMdXa").value], tuChay: $("tdTuChay").checked, boQuaB1: $("tdBoQuaB1").checked, tuMuc: sel.value, cheDo: $("tdCheDo").value, tuLuu10: $("tdTuLuu10").checked, tuSuper: $("tdSuper").checked, muc: (() => { const o = {}; THU_TU.filter((m) => m !== "b1").forEach((m) => { const c = $("tdMuc_" + m); o[m] = !c || c.checked; }); return o; })() })); } catch (e) {} };
  $("tdHoiNghi").onchange = ghi; $("tdMacDinh").onchange = ghi; ["tdMdQG", "tdMdTinh", "tdMdXa"].forEach((i) => ($(i).onchange = ghi)); $("tdTuChay").onchange = ghi; $("tdBoQuaB1").onchange = ghi; sel.onchange = ghi; $("tdCheDo").onchange = ghi; $("tdTuLuu10").onchange = ghi; $("tdSuper").onchange = ghi;
  (() => {
    const kh = $("tdChonMuc");
    if (!kh) return;
    let mucLuu = {};
    try { mucLuu = JSON.parse(localStorage.getItem("dhs_td") || "{}").muc || {}; } catch (e) {}
    kh.innerHTML = "";
    THU_TU.filter((m) => m !== "b1").forEach((m) => {
      const lb = document.createElement("label");
      lb.className = "chk";
      lb.style.margin = "2px 0";
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.id = "tdMuc_" + m;
      cb.checked = (m in mucLuu) ? !!mucLuu[m] : true;
      cb.onchange = () => { ghi(); demMau(); };
      lb.append(cb, document.createTextNode(" " + TEN_MUC[m]));
      kh.append(lb);
    });
  })();
  // v0.9.0: group mẫu thu gọn – summary hiện số mục đã tick + chế độ điền
  window.demMau = demMau;
  function demMau() {
    try {
      const n = THU_TU.filter((m) => m !== "b1").filter((m) => { const c = $("tdMuc_" + m); return !c || c.checked; }).length;
      const c = ($("tdCheDo") && $("tdCheDo").value) || "ca";
      const ten = c === "sua" ? "SỬA" : c === "them" ? "THÊM MỚI" : "SỬA+THÊM";
      if ($("tdMauDem")) $("tdMauDem").textContent = `– ${n} mục · ${ten}`;
    } catch (e) {}
  }
  try { $("tdCheDo").addEventListener("change", demMau); } catch (e) {}
  demMau();
  $("chayTD").onclick = () => { tdKichHoat = $("tdTuChay").checked; chayTuDong(); };
  $("chayMau").onclick = () => { tdKichHoat = $("tdTuChay").checked; ghi(); cheDoMau = true; chayTuDong(); };
  $("tdBoQua").onclick = () => tabDien && chay(tabDien, () => { window.__dhsBoQua = true; }).catch(() => {});
})();

const coDuLieuMuc = (d, m) => m === "b1" ? KHOA.some((k) => d[k]) : m === "dd" ? TRUONG_DD.some(([k]) => d.__dd[k]) : m === "kt" ? KT_TRUONG.some(([k]) => d.__kt[k]) : m === "danhgia" ? true : d.__ds[m].some((x) => x.__chon !== false);
const mucChon = (m) => { const c = $("tdMuc_" + m); return !c || c.checked; };
async function choTamDung() { while (dangTamDung && td && !td.dung) await new Promise((r) => setTimeout(r, 300)); }
const goi = async (tabId, func, args) => { await tiem(tabId); return chay(tabId, func, args); };

// Mở hồ sơ trên trang: chọn đúng hồ sơ trong danh sách theo số căn cước (hoặc họ tên) đang hiện trên trang
async function chonHoSoTheoTrang(tabId) {
  const t = await chay(tabId, () => {
    const v = (k) => { const h = document.querySelector(`[formcontrolname="${k}"]`); return h ? (h.value ?? h.querySelector("input")?.value ?? "") : ""; };
    return { cc: String(v("identifyNo")).trim(), ten: String(v("currentFullName")).trim() };
  }).catch(() => null);
  if (!t || (!t.cc && !t.ten)) return;
  const tenC = (s) => khongDau(s).replace(/\s+/g, " ").trim();
  let i = t.cc ? hoSo.findIndex((d) => d.identifyNo === t.cc) : -1;
  if (i < 0 && t.ten) { const ds = hoSo.map((d, j) => [d, j]).filter(([d]) => tenC(d.currentFullName) === tenC(t.ten)); if (ds.length === 1) i = ds[0][1]; }
  if (i >= 0 && i !== chiSo()) { $("ds").value = i; xem(); luu(); }
}

// Chờ tab tải lại xong (status complete) và form hồ sơ hiện ra, rồi mới tiêm lại script
async function choTrangTaiLai(tabId) {
  await new Promise((r) => {
    let xong = false;
    const ket = () => { if (!xong) { xong = true; chrome.tabs.onUpdated.removeListener(ln); setTimeout(r, 2500); } };
    const ln = (id, info) => { if (id === tabId && info.status === "complete") ket(); };
    chrome.tabs.onUpdated.addListener(ln);
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(ln); if (!xong) { xong = true; r(); } }, 30000);
  });
  for (let i = 0; i < 20; i++) {
    const co = await chay(tabId, () => !!document.querySelector('[formcontrolname="currentFullName"]')).catch(() => false);
    if (co) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function chayTuDong() {
  const mau0 = cheDoMau;
  cheDoMau = false;
  if (dangChay || !hs()) return;
  let tab;
  try { tab = await layTab(); } catch (e) { $("khuTuDong").open = true; return trangThai("tdTT", e.message, "err"); }
  tabDien = tab.id;
  await chonHoSoTheoTrang(tab.id);
  const d = hs();
  td = { dung: false, bc: {}, idx: chiSo(), tab: tab.id, ten: d.currentFullName || "(chưa có họ tên)", boQuaB1: $("tdBoQuaB1").checked, tuMuc: ($("tuMuc") && $("tuMuc").value) || "b1", loiLuu: [] };
  // v0.8.9.9: nạp lại lỗi lưu của lần chạy trước (cùng hồ sơ) để không mất khi panel tải lại giữa chừng
  try {
    const s = await chrome.storage.session.get("dhs_loiLuu");
    const cu = s && s.dhs_loiLuu, idD = (d && (d.__idMay || d.identifyNo)) || "";
    if (cu && cu.id && cu.id === idD && Array.isArray(cu.ds) && cu.ds.length) td.loiLuu = cu.ds.slice();
  } catch (e) {}
  tdDangChay = true;
  batDauChay("auto");
  $("khuTuDong").open = true;
  $("tdBC").innerHTML = ""; $("tdCuoi").hidden = true;
  const boQuaB1 = $("tdBoQuaB1").checked;
  cheDoSuper = !!($("tdSuper") && $("tdSuper").checked);
  const tuMuc = ($("tuMuc") && $("tuMuc").value) || "b1";
  const tu = Math.max(0, THU_TU.indexOf(tuMuc));
  // 📋 Điền theo mẫu: điền theo đúng các dòng đã tick ở từng mục, chờ người dùng bấm Lưu (quá 3 giây thì bấm hộ; đợi quá 10 giây bấm lại, lỗi quá 15 giây thì dừng)
  const mau = mau0;
  const them = mau ? (() => {
    const c = ($("tdCheDo") && $("tdCheDo").value) || "ca";
    const o = { tuLuu: false, choMs: $("tdTuLuu10") && $("tdTuLuu10").checked ? 3000 : 0, hoiNghi: false, hoiXN: false, tuBoQua: true };
    if (c === "sua") o.chiSua = true;
    if (c === "them") o.chiThem = true;
    return o;
  })() : null;
  trangThai("tdTT", (mau ? `📋 Đang ĐIỀN THEO MẪU từ ${TEN_MUC[tuMuc]} → B10 (${them.choMs ? "quá 3 giây không bấm Lưu thì tự bấm hộ (đợi quá 10 giây bấm lại, lỗi quá 15 giây thì dừng)" : "chờ anh/chị bấm Lưu ở từng dòng"})` : `Đang chạy tự động${tu ? ` từ ${TEN_MUC[tuMuc]}` : ""}`) + ` hồ sơ ${d.__vietTay ? "VIẾT TAY " : ""}${td.ten}${d.__vietTay ? ": tiện ích sẽ dừng hỏi xác nhận ở mỗi ô AI cân nhắc/không rõ…" : "…"}`);

  try {
    for (const m of THU_TU.slice(tu)) {
      if (td.dung) break;
      await choTamDung();
      if (td.dung) break;
      if (mau && (m === "b1" || m === "dd" || m === "kt")) { td.bc[m] = { tt: "boQuaMau" }; veBaoCao(); continue; }
      if (m === "b1" && boQuaB1) { td.bc[m] = { tt: "boQuaB1" }; veBaoCao(); continue; }
      if (m !== "b1" && !mucChon(m)) { td.bc[m] = { tt: "boQua", loi: ["Bỏ tick ở danh sách mục chạy"] }; veBaoCao(); continue; }
      if (!coDuLieuMuc(d, m)) { td.bc[m] = { tt: "khongCo" }; veBaoCao(); continue; }
      trangThai("tdTT", `${TEN_MUC[m]}: đang mở mục…`);
      let r;
      try { r = await chayMuc(tab.id, m, d, them); }
      catch (e) { r = { tt: "loi", loi: [/Frame|closed|No tab|Cannot access/i.test(e.message) ? "Trang đã tải lại hoặc đóng giữa chừng: " + e.message : e.message] }; }
      // Menu xổ xuống chưa có dữ liệu: không tải lại trang nữa (đã tắt) – ghi lỗi vào báo cáo rồi chạy tiếp
      td.bc[m] = r; ghiLoiLuu(m, r); veBaoCao();
      if (r.dungHan) { td.dung = true; break; }
      if (cheDoSuper && !td.dung) {
        if (r.tt === "loi") { td.dung = true; const msgSuper = "Super: " + TEN_MUC[m] + " lỗi lớn – đã dừng. " + [].concat(r.loi || []).join("; "); trangThai("tdTT", msgSuper, "err"); alert(msgSuper); break; }
        await new Promise((rr) => setTimeout(rr, 2000));
      }
    }
  } finally {
    tdDangChay = false;
    ketThucChay();
  }
  ketThucTuDong();
}

async function chayMuc(tabId, m, d, them) {
  const mo = await goi(tabId, (b) => window.__dhsAutoLib.moMuc(b), [m]);
  if (!mo || !mo.ok) return { tt: "loi", loi: [mo ? mo.loi : "Không chạy được trên trang."], dungHan: !!(mo && /danh sách các mục|hộp thoại/.test(mo.loi)) };
  trangThai("tdTT", `${TEN_MUC[m]}: đang so sánh và điền…`);
  let r;
  if (m === "b1" || m === "dd") r = await chayForm(tabId, m, d);
  else if (m === "kt") r = await chayKT(tabId, d);
  else r = await chayDSMuc(tabId, m, d, Object.assign({}, them, cheDoSuper ? { super: true } : null));
  return r;
}

const NHAN_B1 = Object.fromEntries(TRUONG_HO_SO.map((t) => [t[0], t[1]]));
async function chayForm(tabId, m, d) {
  const laB1 = m === "b1", src = laB1 ? d : d.__dd, khoa = laB1 ? "currentFullName" : "leaveDate";
  const KIEU_TEXTBOX = ["text", "date", "area"];
  // Ngoại lệ ô chọn: luôn đặt cố định (không lấy từ dữ liệu)
  const CO_DINH_B1 = { currentOccupationId: "Nông nghiệp", educationLevelId: "12/12", religionId: "Không" };
  // Tự động B1: chỉ điền các ô nhập văn bản/ngày; bỏ qua ô menu xổ xuống, radio, tổ chức, ô chọn
  const DAU_TIEN_B1 = /^(birth|hometown|resident)(Province|Commune)Id$/;
  const keys = laB1 ? KHOA.filter((k) => k in CO_DINH_B1 || DAU_TIEN_B1.test(k) || KIEU_TEXTBOX.includes((TRUONG_HO_SO.find((t) => t[0] === k) || [])[2])) : TRUONG_DD.map((t) => t[0]);
  const duLieu = Object.fromEntries(keys.filter((k) => src[k]).map((k) => [k, src[k]]));
  if (laB1) for (const [k, v] of Object.entries(CO_DINH_B1)) duLieu[k] = v;
  // v0.8.9.8: 4 trường bỏ qua khi chạy tự động – giữ nguyên giá trị trên trang
  // Số lý lịch, Phân loại đối tượng, Tổ chức đảng đang sinh hoạt, số CMND cũ
  const BO_QUA_AUTO = ["profileNumber", "securityClassification", "activityOfficialOrgId", "identifyNoOld"];
  if (laB1) for (const k of BO_QUA_AUTO) delete duLieu[k];
  // Ô danh mục Quốc gia/Tỉnh/Xã còn trống trên file: chọn sẵn giá trị mặc định (chỉ điền khi trang cũng trống)
  const macDinh = new Set();
  if (laB1 && $("tdMacDinh").checked) {
    const md = { Nation: $("tdMdQG").value.trim(), Province: $("tdMdTinh").value.trim(), Commune: $("tdMdXa").value.trim() };
    for (const g of ["birth", "hometown", "resident"]) for (const [loai, gt] of Object.entries(md)) {
      const k = `${g}${loai}Id`;
      if (gt && keys.includes(k) && !duLieu[k]) { duLieu[k] = gt; macDinh.add(k); }
    }
  }
  // Mặc định cố định B1 khi file/đám mây để trống (chỉ điền nếu trang cũng trống)
  if (laB1) {
    // Tỉnh/Xã: đám mây không có thì chọn mục đầu tiên trong danh sách (chỉ điền khi ô trên trang đang trống)
    for (const k of keys.filter((x) => DAU_TIEN_B1.test(x))) if (!duLieu[k]) { duLieu[k] = "__FIRST__"; macDinh.add(k); }
    const CO_DINH = { officialStatus: "Đảng viên chính thức", securityClassification: "Không thuộc nhóm đối tượng có vấn đề về lịch sử chính trị và diện Bộ Chính trị, Ban Bí thư quản lý" };
    for (const [k, v] of Object.entries(CO_DINH)) if (keys.includes(k) && !duLieu[k]) { duLieu[k] = v; macDinh.add(k); }
  }
  const nghi = (laB1 ? d.__nghi : d.__dd.__nghi) || {};
  const opt = laB1 ? null : OPT_DD;
  const bc = { tt: "xong", dien: [], ghiDe: [], loi: [], giuCu: [], nghi: Object.entries(nghi).filter(([k]) => !(laB1 && BO_QUA_AUTO.includes(k))).map(([k, l]) => ({ nhan: (laB1 ? NHAN_B1[k] : (TRUONG_DD.find((t) => t[0] === k) || [])[1]) || k, gt: src[k], lyDo: l, quanTrong: laB1 && QUAN_TRONG.includes(k) })) };
  const danhDauForm = () => chay(tabId, (n) => window.__dhsAutoLib.danhDau({ form: n }), [nghi]).catch(() => {});
  await danhDauForm();
  // 1. So sánh sơ bộ (chưa mở chế độ sửa) để biết có gì cần đổi
  let ss = await goi(tabId, (x, o) => window.__dhsSoSanh(x, o), [duLieu, { ...(opt || {}), boQuaKhoa: true }]);
  if (!ss || ss.loiChung) return { ...bc, tt: "loi", loi: [ss ? ss.loiChung : "Không đọc được trang."] };
  let daXacNhanNguoi = false;
  if (laB1 && ss.canhBao.length && !cheDoSuper) {
    if (!confirm(`CẢNH BÁO – có thể KHÔNG ĐÚNG NGƯỜI (hồ sơ "${d.currentFullName}"):\n\n${ss.canhBao.join("\n")}\n\nOK: chắc chắn đúng người, thay bằng dữ liệu file.\nHủy: dừng chạy tự động.`))
      return { ...bc, tt: "loi", loi: ["Đã dừng vì nghi không đúng người: " + ss.canhBao.join("; ")], dungHan: true };
    daXacNhanNguoi = true;
  }
  if (laB1) d.__thieuB1 = (ss.thieu || []).map((x) => ({ k: x.key, bb: !!x.bb }));
  if (!ss.ds.some((x) => x.tt === "trong" || (x.tt === "khac" && !macDinh.has(x.key)))) return { ...bc, tt: "trung" };
  // 2. Mở chế độ sửa rồi so sánh lại với giá trị thật
  const ms = await chay(tabId, (k) => window.__dhsAutoLib.moSua(k), [khoa]);
  if (!ms.ok) return { ...bc, tt: "loi", loi: [ms.loi] };
  if (laB1) {
    // Trang Thêm mới: dropdown Xã/Phường bị khóa vì chưa chọn Tỉnh → bỏ qua chờ danh mục, điền theo chuỗi Quốc gia → Tỉnh → Xã
    // Trang chỉnh sửa: danh mục đã có sẵn → chờ tải xong rồi mới điền
    const ttTrang = await chay(tabId, () => window.__dhsAutoLib.trangThaiTrang(), []);
    if (ttTrang && !ttTrang.taoMoi) {
      const dsXa = [...new Set(keys.filter((k) => /CommuneId$/.test(k) && duLieu[k]).map((k) => duLieu[k]))];
      const canTren = dsXa.filter((v) => v !== "__FIRST__");
      trangThai("tdTT", `${TEN_MUC[m]}: đang chờ danh mục 07) Xã/Phường${canTren.length ? " (cần " + canTren.join(", ") + ")" : ""}…`);
      const w = dsXa.length ? await chay(tabId, (o) => window.__dhsAutoLib.choDanhMuc("residentCommuneId", 15000, o.canTren), [{ canTren }])
        : { ok: true, n: 0, boQua: true };
      if (!w || !w.ok) { trangThai("tdTT", `⚠ ${TEN_MUC[m]}: ${w ? w.loi : "không kiểm tra được danh mục 07) Xã/Phường"}`, "err"); return { ...bc, tt: "loi", loi: [w ? w.loi : "Không kiểm tra được danh mục 07) Xã/Phường"], dungHan: true }; }
      trangThai("tdTT", `✔ Danh mục 07) Xã/Phường đã sẵn sàng (${w.n} lựa chọn) – bắt đầu điền B1.`, "ok");
      try { const ac = new (window.AudioContext || window.webkitAudioContext)(), o = ac.createOscillator(); o.connect(ac.destination); o.frequency.value = 880; o.start(); setTimeout(() => o.stop(), 150); } catch (e) {}
    } else {
      trangThai("tdTT", `${TEN_MUC[m]}: trang Thêm mới – bắt đầu điền B1 (sẽ tự chọn Quốc gia → Tỉnh → Xã theo thứ tự).`, "ok");
    }
  }
  ss = await chay(tabId, (x, o) => window.__dhsSoSanh(x, o), [duLieu, opt || null]);
  if (!ss || ss.loiChung) return { ...bc, tt: "loi", loi: [ss ? ss.loiChung : "Không đọc được trang."] };
  let chon = ss.ds.filter((x) => x.tt === "trong" || (x.tt === "khac" && !macDinh.has(x.key)));
  bc.loi.push(...ss.ds.filter((x) => x.tt === "khoa").map((x) => `${x.nhan}: ô bị khóa, không điền được (file: "${x.moi}")`));
  // Ô AI chưa chắc đang có dữ liệu khác trên trang: hiện hộp Giữ nguyên / Thay thế ngay tại ô
  const daHoi = new Set();
  if ($("tdHoiNghi").checked && !laB1 && !d.__vietTay) {
    for (const x of chon.filter((y) => y.tt === "khac" && nghi[y.key])) {
      trangThai("tdTT", `${TEN_MUC[m]}: ô "${x.nhan}" AI chưa chắc – chọn Giữ nguyên hoặc Thay thế trên trang…`);
      const qd = await chay(tabId, (o) => window.__dhsAutoLib.hoiNghi(o), [{ key: x.key, nhan: x.nhan, cu: x.cu, moi: x.moi, lyDo: nghi[x.key] }]);
      daHoi.add(x.key);
      if (qd !== "thay") { bc.giuCu.push({ nhan: x.nhan, cu: x.cu, moi: x.moi }); chon = chon.filter((y) => y !== x); }
    }
  }
  // Văn bản viết tay: ô AI cân nhắc/không rõ → hỏi người dùng xác nhận (có thể sửa giá trị) trước khi điền
  bc.daXN = [];
  if (d.__vietTay) {
    for (const x of chon.filter((y) => nghi[y.key] && (!laB1 || QUAN_TRONG.includes(y.key)))) {
      trangThai("tdTT", `${TEN_MUC[m]}: văn bản viết tay – xác nhận ô "${x.nhan}" trên trang…`);
      const kq = await chay(tabId, (o) => window.__dhsAutoLib.hoiXacNhan(o), [{ key: x.key, nhan: x.nhan, cu: x.cu, moi: x.moi, lyDo: nghi[x.key] }]);
      if (kq && kq.qd === "thay") { x.moi = kq.v; bc.daXN.push((laB1 ? NHAN_B1[x.key] : (TRUONG_DD.find((t) => t[0] === x.key) || [])[1]) || x.nhan); }
      else { if (x.tt === "khac") bc.giuCu.push({ nhan: x.nhan, cu: x.cu, moi: x.moi }); chon = chon.filter((y) => y !== x); }
    }
  }
  // B1 (v0.8.3): điền toàn bộ dữ liệu đám mây, không hỏi từng trường; ô AI chưa chắc vẫn điền và được ghi vào danh sách rà soát
  // Đổi Quốc gia/Tỉnh thì trang xóa ô phụ thuộc: chọn kèm Tỉnh/Xã có trong file để điền lại
  const chonSet = new Set(chon.map((x) => x.key));
  for (const x of [...chon]) {
    const mm = x.key.match(/^(\w+?)(Nation|Province)Id$/);
    if (!mm) continue;
    for (const sau of mm[2] === "Nation" ? ["Province", "Commune"] : ["Commune"]) {
      const y = ss.ds.find((z) => z.key === mm[1] + sau + "Id");
      if (y && !chonSet.has(y.key) && y.tt !== "khoa" && y.tt !== "an") chonSet.add(y.key);
    }
  }
  chon = ss.ds.filter((x) => chonSet.has(x.key));
  if (!chon.length) { await chay(tabId, () => window.__dhsAutoLib.huySua(), []); return { ...bc, tt: "trung" }; }
  bc.macDinh = chon.filter((x) => macDinh.has(x.key) && x.tt === "trong").map((x) => ({ nhan: x.nhan, gt: x.moi === "__FIRST__" ? "(mục đầu tiên trong danh sách)" : x.moi }));
  await danhDauForm();
  const r = await chay(tabId, (mm, t) => window.__dhsDienCho(mm, t), [chon.map((x) => ({ key: x.key, moi: x.moi, cu: x.cu })), laB1 ? null : TRUONG_DD]);
  if (!r || r.loiChung) return { ...bc, tt: "loi", loi: [r ? r.loiChung : "Không điền được."] };
  for (const o of r.kq) {
    if (!o.ok) bc.loi.push(`${o.nhan}: ${o.loi}`);
    else if (o.cu && o.cu !== o.hien) bc.ghiDe.push({ nhan: o.nhan, cu: o.cu, moi: o.hien });
    else if (!o.cu) bc.dien.push(o.nhan);
  }
  bc.loi.push(...r.biDoi.map((o) => `${o.nhan}: ${o.loi}`));
  if (r.dung) return { ...bc, tt: "dung", dungHan: true };
  // 3. Lưu
  trangThai("tdTT", `${TEN_MUC[m]}: đang bấm "Lưu thông tin"…`);
  const lu = await chay(tabId, (k) => window.__dhsAutoLib.luuVaCho({ khoaKey: k }), [khoa]);
  if (!lu.ok) {
    bc.loiLuu = lu.loi;
    trangThai("tdTT", `${TEN_MUC[m]}: trang báo lỗi khi lưu – ${lu.loi}. Sửa trên trang rồi bấm "Lưu thông tin", tiện ích sẽ chạy tiếp; hoặc bấm "Bỏ qua mục này".`, "err");
    $("tdBoQua").hidden = false;
    const kq = cheDoSuper ? "loiSuper" : await chay(tabId, (k) => window.__dhsAutoLib.choNguoiLuu(k), [khoa]).finally(() => ($("tdBoQua").hidden = true));
    if (kq === "loiSuper") return { ...bc, tt: "loi", loi: ["Super: trang báo lỗi khi lưu (" + lu.loi + ") – đã dừng, không chờ sửa tay."] };
    if (kq === "dung") return { ...bc, tt: "dung", dungHan: true };
    bc.tt = kq === "luu" ? "xong" : "boQua";
    if (kq === "luu") { delete bc.loiLuu; bc.ghiChu = "Đã lưu sau khi anh/chị sửa lỗi trên trang."; }
  }
  if (laB1 && lu.chuyenTrang) bc.ghiChu = "Đã lưu và trang chuyển sang bước tiếp theo.";
  await danhDauForm();
  return bc;
}

// B8 (v0.8.4): chuẩn hóa dữ liệu đám mây trước khi điền; trả về dòng đã chuẩn hóa và các ô chọn mặc định
function chuanQH(x, vietTay) {
  const o = sach(x), nghi = x.__nghi || {}, md = {};
  if (o.familyMemberId) o.familyMemberId = o.familyMemberId.replace(/^(Bố|Mẹ|Con)\s+ruột$/i, (_, a) => a.charAt(0).toUpperCase() + a.slice(1).toLowerCase() + " đẻ");
  if (o.currentStatus) {
    if (/chết|mất|qua đời|tử vong/i.test(o.currentStatus)) o.currentStatus = "Đã qua đời";
    else if (/ly hôn|li hôn|li dị|ly dị/i.test(o.currentStatus)) o.currentStatus = "Đã ly hôn";
  }
  if (!o.currentStatus) delete o.finishedYear;           // không có tình trạng thì bỏ qua năm
  if (o.currentStatus === "Đã qua đời" && !o.finishedYear) delete o.finishedYear; // không có năm mất thì bỏ qua
  if (nghi.isPartyMember && !vietTay) { o.isPartyMember = "Không"; md.isPartyMember = "Không"; } // phân vân Đảng viên hay không → Không (văn bản viết tay: hỏi người dùng)
  else if (!o.isPartyMember) { o.isPartyMember = "Không"; md.isPartyMember = "Không"; }
  if (!o.type) { o.type = "Bản thân"; md.type = o.type; }                 // mục đầu tiên trong menu
  if (!o.familyMemberId) { o.familyMemberId = "Bố đẻ"; md.familyMemberId = o.familyMemberId; } // mục đầu tiên trong menu
  return [o, md];
}
// B3 (đào tạo): Phân loại tất cả thành Đào tạo chuyên môn; chứng chỉ tin học (MOS/ICDL/chứng chỉ tin học ở văn bằng) → Đào tạo tin học; có tiếng Anh → Đào tạo ngoại ngữ (tên Trình độ như Tin học văn phòng không tính).
// Giá trị cũ trong Phân loại (tên cơ sở điền nhầm, lưu không được) được chuyển sang Cơ sở đào tạo nếu ô đó trống.
// Trình độ luôn là Chứng chỉ; Hình thức trống hoặc ghi Tập chung → Chính quy; Nước đào tạo trống thì mặc định Việt Nam. Ghi ngược vào dòng x.
function chuanB3(x) {
  const o = sach(x), md = {};
  const all = [o.trainingTypeId, o.languageId, o.diploma, o.note].map((v) => String(v == null ? "" : v).toLowerCase()).join(" ");
  const co = (...keys) => keys.some((k) => all.indexOf(k) >= 0);
  let loai = "Đào tạo chuyên môn";
  if (co("mos", "icdl", "chứng chỉ tin học", "chung chi tin hoc")) loai = "Đào tạo tin học";
  else if (co("tiếng anh", "tieng anh", "english") || String(o.languageId == null ? "" : o.languageId).trim() !== "") loai = "Đào tạo ngoại ngữ";
  const cu = String(o.trainingTypeId == null ? "" : o.trainingTypeId).trim();
  if (cu !== "" && cu !== loai && String(o.school == null ? "" : o.school).trim() === "") { o.school = cu; md.school = cu; }
  if (o.trainingTypeId !== loai) { o.trainingTypeId = loai; md.trainingTypeId = loai; }
  if (o.trainingLevelId !== "Chứng chỉ") { o.trainingLevelId = "Chứng chỉ"; md.trainingLevelId = o.trainingLevelId; }
  if (!String(o.trainingCountryId || "").trim()) { o.trainingCountryId = "Việt Nam"; md.trainingCountryId = o.trainingCountryId; }
  let mode = String(o.trainingModeId == null ? "" : o.trainingModeId).trim();
  if (mode.toLowerCase() === "vừa học vừa làm" || mode.toLowerCase() === "vua hoc vua lam") mode = "Vừa làm vừa học";
  if (mode !== String(o.trainingModeId == null ? "" : o.trainingModeId).trim()) { o.trainingModeId = mode; md.trainingModeId = mode; }
  if (mode === "" || mode.toLowerCase() === "tập chung" || mode.toLowerCase() === "tap chung") { o.trainingModeId = "Chính quy"; md.trainingModeId = o.trainingModeId; }
  for (const k of ["trainingTypeId", "school", "trainingLevelId", "trainingModeId", "trainingCountryId"]) {
    if (o[k] == null) delete x[k]; else x[k] = o[k];
  }
  return [o, md];
}
async function chayDSMuc(tabId, m, d, them) {
  const cf = DS_BUOC[m], rows = d.__ds[m].filter((x) => x.__chon !== false);
  const nh = Object.fromEntries(cf.truong);
  // B5 Đánh giá (v0.8.9.8): đám mây trống thì tạo 3 dòng 2023/2024/2025 – xếp loại "Hoàn thành tốt nhiệm vụ";
  // đã có dòng thì điền năm/xếp loại còn trống theo thứ tự 2023 → 2024 → 2025.
  if (m === "danhgia") {
    const NAM = ["2023", "2024", "2025"], MD = "Hoàn thành tốt nhiệm vụ";
    const daDung = new Set(rows.map((x) => String(x.year || "").trim()).filter(Boolean));
    if (!rows.length) NAM.forEach((y) => { rows.push({ year: y, evaluationLevel: MD, __macDinh: { year: y, evaluationLevel: MD } }); daDung.add(y); });
    else rows.forEach((x) => {
      if (!String(x.year || "").trim()) { const y = NAM.find((n) => !daDung.has(n)); if (y) { x.year = y; daDung.add(y); (x.__macDinh = x.__macDinh || {}).year = y; } }
      if (!String(x.evaluationLevel || "").trim()) { x.evaluationLevel = MD; (x.__macDinh = x.__macDinh || {}).evaluationLevel = MD; }
    });
  }
  const bc = { tt: "xong", dien: [], ghiDe: [], loi: [], giuCu: [], macDinh: [], daXN: [], dong: { luu: 0, trung: 0, khac: 0 },
    nghi: rows.flatMap((x) => Object.entries(x.__nghi || {}).map(([k, l]) => ({ nhan: `${cf.nhan(x)} – ${nh[k] || k}`, gt: x[k], lyDo: l }))) };
  const qh = m === "qh";
  const chuan = rows.map((x) => {
    if (qh) return chuanQH(x, !!d.__vietTay);
    if (m === "daotao") { const rB3 = chuanB3(x); return [rB3[0], { ...(x.__macDinh || {}), ...rB3[1] }]; }
    if (m === "danhgia") return [sach(x), x.__macDinh || {}];
    return [sach(x), {}];
  });
  if (qh || m === "daotao" || m === "danhgia") chuan.forEach(([, md], i) => Object.entries(md).forEach(([k, v]) => bc.macDinh.push({ nhan: `${cf.nhan(rows[i])} – ${nh[k] || k}`, gt: v })));
  const r = await chay(tabId, (b, x, o) => window.__dhsDSDienCho(b, x, o), [m, chuan.map((c) => c[0]), Object.assign({ nghi: rows.map((x) => x.__nghi || {}), hoiNghi: $("tdHoiNghi").checked && !qh && !d.__vietTay, hoiXN: !!d.__vietTay, tuBoQua: true, macDinh: chuan.map((c) => c[1]) }, them || {})]);
  if (!r || r.loiChung) return { ...bc, tt: "loi", loi: [r ? r.loiChung : "Không điền được."] };
  for (const k of r.tong) {
    if (k.ketQua === "luu") bc.dong.luu++; else if (k.ketQua === "trung") bc.dong.trung++; else bc.dong.khac++;
    if (k.ketQua === "loi") bc.loi.push(`${k.ten}: ${k.loi}`);
    else if (k.ketQua === "dong") bc.loi.push(`${k.ten}: đã bỏ qua (Đóng), chưa lưu`);
    for (const o of k.o) {
      if (!o.ok && o.tt !== "khac") bc.loi.push(`${k.ten} – ${o.nhan}: ${o.loi}`);
      if (o.ok && o.tt === "ghiDe") bc.ghiDe.push({ nhan: `${k.ten} – ${o.nhan}`, cu: o.cu, moi: o.hien });
      if (o.tt === "giu") bc.giuCu.push({ nhan: `${k.ten} – ${o.nhan}`, cu: o.cu, moi: o.moi });
      if (o.macDinh) bc.macDinh.push({ nhan: `${k.ten} – ${o.nhan}`, gt: o.hien });
      if (o.xacNhan) bc.daXN.push(`${cf.nhan(rows[k.i])} – ${nh[o.key] || o.nhan}`);
      if (o.ok && o.tt === "dien" && k.loai === "sua") bc.dien.push(`${k.ten} – ${o.nhan}`);
    }
  }
  // v0.8.9.9: tách riêng lỗi LƯU của từng dòng để tổng kết cuối (k.loiLuu do fill_ds đặt khi bấm Lưu lỗi)
  bc.loiLuu = [];
  for (const k of r.tong) {
    if (k.loiLuu && k.ketQua !== "luu") bc.loiLuu.push(`${k.ten}: ${k.loiLuu}`);
    else if (k.ketQua === "dong") bc.loiLuu.push(`${k.ten}: đã bấm Đóng – chưa lưu dòng này`);
    else if (k.ketQua === "loi" && /lưu|luu|15 giây/i.test(k.loi || "")) bc.loiLuu.push(`${k.ten}: ${k.loi}`);
  }
  if (r.dung) { bc.tt = "dung"; bc.dungHan = true; }
  const dongNghi = rows.filter((x) => x.__nghi && Object.keys(x.__nghi).length).map((x) => ({ x: sach(x), lyDo: Object.entries(x.__nghi).map(([k, l]) => `${nh[k] || k}: ${l}`).join("; ") }));
  if (dongNghi.length) await chay(tabId, (b, rr) => window.__dhsAutoLib.danhDau({ bang: { buoc: b, rows: rr } }), [m, dongNghi]).catch(() => {});
  return bc;
}

async function chayKT(tabId, d) {
  const kt = sach(d.__kt), nghi = d.__kt.__nghi || {};
  const NKT = Object.fromEntries(KT_TRUONG);
  const bc = { tt: "xong", dien: [], ghiDe: [], loi: [], giuCu: [], nghi: Object.entries(nghi).map(([k, l]) => ({ nhan: NKT[k] || k, gt: kt[k], lyDo: l })) };
  const ss = await chay(tabId, (x) => window.__dhsKTSoSanh(x), [kt]);
  if (!ss || ss.loiChung) return { ...bc, tt: "loi", loi: [ss ? ss.loiChung : "Không đọc được trang."] };
  d.__thieuB9 = ss.ds.filter((x) => !x.moi && !String(x.cu || "").trim()).map((x) => x.key);
  const chon = ss.ds.filter((x) => ["trong", "themMoi", "khac"].includes(x.tt)).map((x) => x.key);
  if (!chon.length) { await chay(tabId, (n) => window.__dhsAutoLib.danhDau({ form: n }), [nghi]).catch(() => {}); return { ...bc, tt: "trung" }; }
  const k = await chay(tabId, (x, c, o) => window.__dhsKTDienCho(x, c, o), [kt, chon, { nghi, hoiNghi: $("tdHoiNghi").checked && !d.__vietTay, hoiXN: !!d.__vietTay }]);
  if (!k || k.loiChung) return { ...bc, tt: "loi", loi: [k ? k.loiChung : "Không điền được."] };
  for (const o of k.o) {
    if (!o.ok && o.tt !== "khac") bc.loi.push(`${o.nhan}: ${o.loi}`);
    if (o.ok && o.tt === "ghiDe") bc.ghiDe.push({ nhan: o.nhan, cu: o.cu, moi: o.hien });
    if (o.tt === "giu") bc.giuCu.push({ nhan: o.nhan, cu: o.cu, moi: o.moi });
    if (o.xacNhan) (bc.daXN = bc.daXN || []).push(NKT[o.key] || o.nhan);
    if (o.ok && o.tt === "dien") bc.dien.push(o.nhan);
  }
  if (k.ketQua === "dung") return { ...bc, tt: "dung", dungHan: true };
  if (k.ketQua === "loi") { bc.tt = "loi"; bc.loi.unshift(k.loi); }
  // v0.8.9.9: bấm Đóng sau khi lưu lỗi (k.loiLuu do fill_kt đặt) → ghi riêng để tổng kết cuối
  else if (k.ketQua === "dong") { bc.tt = "boQua"; bc.loi.push("Đã đóng, chưa lưu Hoàn cảnh kinh tế."); bc.loiLuu = [k.loiLuu || "Đã đóng, chưa lưu Hoàn cảnh kinh tế."]; }
  else if (k.ketQua === "trung") bc.tt = "trung";
  return bc;
}

// ---------- v0.8.9.9: gom lỗi LƯU của từng bước – không mất khi sang bước khác ----------
// Mỗi chayXxx chuẩn hóa lỗi lưu vào bc.loiLuu (chuỗi hoặc mảng). Hàm này gom vào td.loiLuu + persist.
function ghiLoiLuu(m, r) {
  if (!td || !r || !r.loiLuu) return;
  td.loiLuu = td.loiLuu || [];
  const muc = TEN_MUC[m] || m;
  for (const ct of [].concat(r.loiLuu)) {
    if (ct && !td.loiLuu.some((x) => x.ma === m && x.chiTiet === ct)) td.loiLuu.push({ ma: m, muc, chiTiet: ct });
  }
  luuLoiLuu();
}
function luuLoiLuu() {
  try {
    const d = hs();
    chrome.storage.session.set({ dhs_loiLuu: { id: (d && (d.__idMay || d.identifyNo)) || "", ten: td ? td.ten : "", ds: (td && td.loiLuu) || [] } }).catch(() => {});
  } catch (e) {}
}

// ---------- Báo cáo kết quả ----------
const NHAN_TD = { xong: ["✔ Đã lưu", "ok"], trung: ["= Không có gì thay đổi", "trung"], khongCo: ["– Không có dữ liệu", "trung"], boQuaB1: ["⏭ Bỏ qua B1 (theo tùy chọn)", "trung"], boQua: ["↷ Bỏ qua", "err"], boQuaMau: ["📋 Không phải mục dạng dòng – Điền theo mẫu bỏ qua", "trung"], loi: ["✘ Lỗi", "err"], dung: ["■ Đã dừng", "err"] };
function veBaoCao() {
  const box = $("tdBC");
  box.innerHTML = "";
  if (!td) return;
  for (const [m, r] of Object.entries(td.bc)) {
    if (r.tt === "khongCo") continue;
    const [nhan, lop] = NHAN_TD[r.tt] || [r.tt, ""];
    const soNghi = (r.nghi || []).length;
    const tom = [r.dong && `${r.dong.luu} dòng lưu, ${r.dong.trung} dòng giữ nguyên` + (r.dong.khac ? `, ${r.dong.khac} dòng chưa lưu` : ""),
      r.dien && r.dien.length && `${r.dien.length} ô điền mới`, r.ghiDe && r.ghiDe.length && `${r.ghiDe.length} ô thay dữ liệu cũ`,
      r.loi && r.loi.length && `${r.loi.length} lỗi`, soNghi && `⚠ ${soNghi} ô AI chưa chắc`].filter(Boolean).join(" · ");
    const muc = el("details", { className: "td-muc " + lop, open: !!((r.loi && r.loi.length) || soNghi || (r.giuCu && r.giuCu.length)) },
      el("summary", {}, el("b", { textContent: TEN_MUC[m] + ": " }), nhan + (tom ? " · " + tom : "")));
    if (r.ghiChu) muc.append(el("div", { className: "gt", textContent: r.ghiChu }));
    for (const x of [].concat(r.loiLuu || [])) muc.append(el("div", { className: "gt loi", textContent: "⛔ Lỗi lưu: " + x }));
    if (soNghi) {
      const k = el("div", { className: "td-nghi" }, el("b", { textContent: "Cần rà soát (AI chưa chắc):" }));
      r.nghi.forEach((x) => k.append(el("div", { textContent: `• ${x.nhan}${x.quanTrong ? " (QUAN TRỌNG)" : ""}: "${x.gt}" – ${x.lyDo}` })));
      muc.append(k);
    }
    for (const x of r.giuCu || []) muc.append(el("div", { className: "gt", textContent: `Giữ dữ liệu trên trang: ${x.nhan} "${x.cu}" (file: "${x.moi}")` }));
    for (const x of r.ghiDe || []) muc.append(el("div", { className: "gt", textContent: `Đã thay: ${x.nhan}: "${x.cu}" → "${x.moi}"` }));
    for (const x of r.loi || []) muc.append(el("div", { className: "gt loi", textContent: "✘ " + x }));
    box.append(muc);
  }
}
// v0.8.9.9: tổng kết mục lưu lỗi của TẤT CẢ các bước sau khi chạy xong
function veTongKetLoiLuu() {
  const cu = $("tdTongKetLoi");
  if (cu) cu.remove();
  if (!td) return;
  const ds = td.loiLuu || [];
  const box = el("details", { id: "tdTongKetLoi", className: "td-muc " + (ds.length ? "err" : "ok"), open: ds.length > 0 },
    el("summary", {}, el("b", { textContent: `Tổng kết mục lưu lỗi (${ds.length})` })));
  if (!ds.length) box.append(el("div", { className: "gt", textContent: "Tất cả các bước đều đã lưu thành công." }));
  ds.forEach((x) => box.append(el("div", { className: "gt loi", textContent: `• ${x.muc}: ${x.chiTiet}` })));
  if (ds.length) {
    const nutTai = el("button", { textContent: "⬇ Tải CSV lỗi lưu" });
    nutTai.onclick = () => taiCsvLoiLuu();
    const nutXoa = el("button", { textContent: "✔ Đã xử lý – xóa" });
    nutXoa.onclick = () => { td.loiLuu = []; luuLoiLuu(); veTongKetLoiLuu(); };
    box.append(el("div", { className: "btns" }, nutTai, nutXoa));
  }
  $("tdBC").append(box);
}
function taiCsvLoiLuu() {
  if (!td || !(td.loiLuu || []).length) return;
  const o = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const dong = [["Hồ sơ", "Mục", "Lỗi lưu"], ...td.loiLuu.map((x) => [td.ten, x.muc, x.chiTiet])];
  const blob = new Blob(["\ufeff" + dong.map((r) => r.map(o).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `loiluu_${(hoSo[td.idx] && hoSo[td.idx].identifyNo) || td.ten}.csv`;
  a.click();
}
async function xemLaiMuc(m) {
  if (dangChay || !td) return;
  const d = hoSo[td.idx];
  try {
    const mo = await goi(td.tab, (b) => window.__dhsAutoLib.moMuc(b), [m]);
    if (!mo.ok) return trangThai("tdTT", mo.loi, "err");
    let cfg;
    if (m === "b1") cfg = { form: d.__nghi || {} };
    else if (m === "dd") cfg = { form: d.__dd.__nghi || {} };
    else if (m === "kt") cfg = { form: d.__kt.__nghi || {} };
    else { const nh = Object.fromEntries(DS_BUOC[m].truong); cfg = { bang: { buoc: m, rows: d.__ds[m].filter((x) => x.__nghi && Object.keys(x.__nghi).length).map((x) => ({ x: sach(x), lyDo: Object.entries(x.__nghi).map(([k, l]) => `${nh[k] || k}: ${l}`).join("; ") })) } }; }
    await chay(td.tab, (c) => window.__dhsAutoLib.danhDau(c), [cfg]);
    trangThai("tdTT", `Đã mở ${TEN_MUC[m]} và tô đỏ các ô/dòng AI chưa chắc.`, "ok");
  } catch (e) { trangThai("tdTT", e.message, "err"); }
}
function ketThucTuDong() {
  if (!td) return;
  const ds = Object.values(td.bc);
  const loi = ds.filter((r) => r.tt === "loi" || r.tt === "boQua" || r.tt === "dung").length;
  const dungGiua = td.dung;
  td.raSoat = taoRaSoat();
  trangThai("tdTT", (dungGiua ? "Đã dừng giữa chừng. " : (td.boQuaB1 ? "Đã chạy xong (đã bỏ qua Bước 1 theo tùy chọn). " : (td.tuMuc && td.tuMuc !== "b1" ? `Đã chạy xong từ ${TEN_MUC[td.tuMuc]} → B10. ` : "Đã chạy xong B1 → B10. "))) +
    `${ds.filter((r) => r.tt === "xong").length} mục đã lưu` + (loi ? `, ${loi} mục có lỗi/bỏ qua` : "") + `, ${td.raSoat.length} mục chuyển vào danh sách rà soát` +
    (dungGiua ? "." : ". Ghi chú trên trang đã được xóa.") + " Kiểm tra danh sách bên dưới rồi bấm xác nhận để đóng hồ sơ.", loi || dungGiua ? "err" : "ok");
  $("tdCuoi").hidden = false;
  $("tdDong").textContent = `✔ Xác nhận hoàn tất – Đóng hồ sơ ${td.ten}`;
  veBaoCao();
  veTongKetLoiLuu();
  veRaSoat();
  if (!dungGiua) {
    const t = td, d = hoSo[td.idx], thanhCong = !loi;
    hoanTatRaSoat().then(() => { if (thanhCong && t && d) return ghiDaNhapTuDong(d, t); }).catch(() => {});
  }
}

// ---------- Danh sách rà soát (v0.8.3): các ô AI cân nhắc + các ô/mục chưa điền của 1 hồ sơ ----------
function taoRaSoat() {
  const d = hoSo[td.idx], kq = [];
  const NGB1 = Object.fromEntries(TRUONG_HO_SO.map((t) => [t[1], t[0]])), NGDD = Object.fromEntries(TRUONG_DD.map((t) => [t[1], t[0]])), NGKT = Object.fromEntries(KT_TRUONG.map((t) => [t[1], t[0]]));
  // Gắn vị trí trên trang (mục, mã ô, dòng) vào mục rà soát để nút "Hiện vị trí cụ thể" tìm lại được
  const viTri = (m, nhan) => {
    const tra = (bang) => bang[nhan] || null;
    if (m === "b1") return { ma: m, k: tra(NGB1) };
    if (m === "dd") return { ma: m, k: tra(NGDD) };
    if (m === "kt") return { ma: m, k: tra(NGKT) };
    const cf = DS_BUOC[m], rows = (d && d.__ds && d.__ds[m]) || [];
    if (!cf) return { ma: m };
    for (let i = 0; i < rows.length; i++) {
      const goc = cf.nhan(rows[i]), dong = () => (m === "qh" ? chuanQH(rows[i], !!(d && d.__vietTay))[0] : sach(rows[i]));
      if (nhan === goc) return { ma: m, hang: i, dong: dong() };
      if (nhan.startsWith(goc + " – ")) { const f = cf.truong.find((t) => t[1] === nhan.slice(goc.length + 3)); return { ma: m, hang: i, dong: dong(), k: f ? f[0] : null }; }
    }
    // Dự phòng: nhãn dòng đã chuẩn hóa (VD "?" thay cho quan hệ trống) – tìm dòng theo họ tên / tên tổ chức nằm trong nhãn
    const tienTo = nhan.split(" – ")[0];
    const i = rows.findIndex((r) => { const kh = String(r.fullName || r.companyName || "").trim(); return kh && tienTo.includes(kh); });
    if (i >= 0) { const f = cf.truong.find((t) => nhan.endsWith(" – " + t[1])); return { ma: m, hang: i, dong: m === "qh" ? chuanQH(rows[i], !!(d && d.__vietTay))[0] : sach(rows[i]), k: f ? f[0] : null }; }
    return { ma: m };
  };
  let mHienTai = "";
  const them = (o) => kq.push({ ...o, ...viTri(mHienTai, o.truong) });
  for (const [m, r] of Object.entries(td.bc)) {
    if (r.tt === "khongCo") continue;
    const muc = TEN_MUC[m] || m; mHienTai = m;
    for (const x of (r.nghi || []).filter((y) => !(r.daXN || []).includes(y.nhan))) them({ muc, truong: x.nhan, loai: "AI cân nhắc", giaTri: x.gt, ghiChu: x.lyDo + (x.quanTrong ? " (trường quan trọng)" : "") });
    for (const x of r.macDinh || []) them({ muc, truong: x.nhan, loai: "Tự chọn mặc định", giaTri: x.gt, ghiChu: "Đám mây để trống, tiện ích chọn theo quy tắc mặc định – cần xem lại" });
    for (const x of r.giuCu || []) them({ muc, truong: x.nhan, loai: "Giữ dữ liệu cũ, chưa thay", giaTri: x.moi, ghiChu: `Trên trang: "${x.cu}" – đám mây: "${x.moi}"` });
    for (const x of r.loi || []) them({ muc, truong: ((String(x).match(/^(.+? – [^:–]+?):\s/) || String(x).match(/^([^:]+):\s/) || [])[1]) || String(x), loai: "Chưa điền / lỗi", giaTri: "", ghiChu: String(x) });
    if ((r.tt === "boQua" || r.tt === "dung") && !(r.loi && r.loi.length)) them({ muc, truong: "(cả mục)", loai: "Mục chưa thực hiện", giaTri: "", ghiChu: r.tt === "dung" ? "Đã dừng trước khi hoàn tất" : "Bỏ qua" });
  }
  // v0.8.9.8: 4 trường bỏ qua khi chạy tự động thì không đưa vào rà soát
  const BO_QUA_RS = ["profileNumber", "securityClassification", "activityOfficialOrgId", "identifyNoOld"];
  if (d && td.bc.b1 && td.bc.b1.tt !== "khongCo") for (const [k, nhan, kieu] of TRUONG_HO_SO) {
    if (BO_QUA_RS.includes(k)) continue;
    if (["text", "date", "area"].includes(kieu) || !KHOA.includes(k) || !d[k] || ["currentOccupationId", "educationLevelId", "religionId"].includes(k) || /^(birth|hometown|resident)(Province|Commune)Id$/.test(k)) continue;
    kq.push({ ma: "b1", k, muc: TEN_MUC.b1, truong: nhan, loai: "Chưa điền / lỗi", giaTri: String(d[k]), ghiChu: "Tự động bỏ qua ô dạng menu xổ xuống/lựa chọn – dùng \"Hiện vị trí cụ thể\" để thay thế hoặc nhập tay" });
  }
  if (d && d.__thieuB1) for (const x of d.__thieuB1.filter((y) => y.bb)) if (!d[x.k]) kq.push({ ma: "b1", k: x.k, muc: TEN_MUC.b1, truong: NHAN_B1[x.k] || x.k, loai: "Chưa có dữ liệu (bắt buộc)", giaTri: "", ghiChu: "Không có trong file/đám mây và trống trên trang" });
  return kq;
}
const LOAI_RS = { can: "AI cân nhắc", giu: "Giữ dữ liệu cũ, chưa thay", md: "Tự chọn mặc định", loi: "Chưa điền / lỗi", bb: "Chưa có dữ liệu (bắt buộc)", muc: "Mục chưa thực hiện" };
function thongKeRaSoat(ds) {
  const dem = (l) => (ds || []).filter((x) => x.loai === l).length;
  return { aiCanNhac: dem(LOAI_RS.can), giuCu: dem(LOAI_RS.giu), macDinh: dem(LOAI_RS.md), chuaDien: dem(LOAI_RS.loi) + dem(LOAI_RS.bb) + dem(LOAI_RS.muc), tong: (ds || []).length };
}
function veRaSoat() {
  const box = $("tdRaSoat");
  box.innerHTML = "";
  if (!td || !td.raSoat) return;
  const ds = td.raSoat;
  const sec = el("details", { className: "td-muc " + (ds.length ? "err" : "ok"), open: true },
    el("summary", {}, el("b", { textContent: `Danh sách RÀ SOÁT – ${td.ten} (${ds.length} mục)` })));
  if (!ds.length) sec.append(el("div", { className: "gt", textContent: "Không có ô nào AI cân nhắc hoặc chưa điền." }));
  ds.forEach((x) => sec.append(el("div", { className: "gt", textContent: `• ${x.muc} – ${x.truong} [${x.loai}]${x.giaTri ? `: "${x.giaTri}"` : ""} – ${x.ghiChu}` })));
  sec.append(el("div", { className: "td-ct", id: "tdRaSoatTT" }));
  const nut = el("button", { className: "full", textContent: "⬇ Tải danh sách rà soát (CSV)", onclick: () => taiCsvRaSoat() });
  sec.append(nut);
  box.append(sec);
}
function taiCsvRaSoat() {
  if (!td || !td.raSoat) return;
  const o = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const dong = [["Hồ sơ", "Mục", "Trường", "Loại", "Giá trị đã điền", "Ghi chú"], ...td.raSoat.map((x) => [td.ten, x.muc, x.truong, x.loai, x.giaTri, x.ghiChu])];
  const blob = new Blob(["\ufeff" + dong.map((r) => r.map(o).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rasoat_${(hoSo[td.idx] && hoSo[td.idx].identifyNo) || td.ten}.csv`;
  a.click();
}
const ghiTTRaSoat = (t, lop) => { const e = $("tdRaSoatTT"); if (e) { e.textContent = t; e.className = "tt " + (lop || ""); } };
// Xóa ghi chú trên trang (tô đỏ, hộp hỏi) rồi lưu danh sách rà soát lên đám mây cho team rà soát
async function hoanTatRaSoat() {
  const t = td;
  if (!t) return;
  try { await goi(t.tab, () => { window.__dhsAutoLib.danhDau(null); document.querySelectorAll(".__dhs_hoi").forEach((e) => e.remove()); return true; }, []); }
  catch (e) { ghiTTRaSoat("Chưa xóa được ghi chú trên trang: " + e.message, "err"); }
  const d = hoSo[t.idx], id = d && d.__idMay;
  if (!id) return ghiTTRaSoat("Hồ sơ nhập từ Excel: danh sách rà soát chưa lưu lên đám mây – dùng nút tải CSV.", "");
  try {
    const secret = $("fbSecret").value.trim();
    if (!secret) throw new Error("chưa nhập mã bí mật");
    const r = await fetch(`${FB_URL}/rasoat/${encodeURIComponent(id)}.json?auth=${encodeURIComponent(secret)}`, { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lamSachFb({ id, ten: t.ten, cccd: d.identifyNo || "", capNhat: new Date().toISOString(), trangThai: "chờ rà soát", soMuc: t.raSoat.length, thongKe: thongKeRaSoat(t.raSoat), dsMuc: t.raSoat })) });
    if (!r.ok) throw new Error(`máy chủ ${r.status}`);
    ghiTTRaSoat("✔ Đã lưu danh sách rà soát lên đám mây (mục \"rasoat\").", "ok");
  } catch (e) { ghiTTRaSoat("Chưa lưu được lên đám mây: " + e.message + ". Dùng nút tải CSV.", "err"); }
}
$("tdDong").onclick = async () => {
  if (!td || dangChay) return;
  try {
    const r = await goi(td.tab, () => window.__dhsAutoLib.dongHoSo(), []);
    if (!r.ok) return trangThai("tdTT", r.loi, "err");
  } catch (e) { return trangThai("tdTT", e.message, "err"); }
  const i = td.idx;
  daLuu[i] = true;
  ghiDaNhapTuDong(hoSo[i], td).catch(() => {});
  $("tdCuoi").hidden = true;
  if (i < hoSo.length - 1) {
    veDanhSach(i + 1);
    choTrangMoi = $("tdTuChay").checked && tdKichHoat;
    trangThai("tdTT", `Đã đóng hồ sơ ${td.ten}. Tiếp theo: ${hoSo[i + 1].currentFullName || "(chưa có họ tên)"} – mở trang hồ sơ của người này (hoặc trang Thêm mới)` + (choTrangMoi ? (hoSo[i + 1].__vietTay ? ", tiện ích sẽ tự chạy (văn bản viết tay: sẽ hỏi xác nhận ô AI cân nhắc)." : ", tiện ích sẽ tự chạy.") : ", rồi bấm Chạy tự động."), "ok");
  } else {
    veDanhSach(i);
    trangThai("tdTT", `Đã đóng hồ sơ ${td.ten}. Đây là hồ sơ cuối cùng trong danh sách.`, "ok");
  }
  td = null;
  luu();
};

async function batDauTuDongSauNap() {
  tdKichHoat = false; choTrangMoi = false;
  if (!$("tdTuChay").checked || !hoSo.length) return;
  $("khuTuDong").open = true;
  trangThai("tdTT", `Đã nạp ${hoSo.length} hồ sơ. Mở trang hồ sơ của ${hs().currentFullName || "đảng viên"} (Xem thông tin đảng viên, hoặc Thêm mới) rồi bấm "▶ Bắt đầu chạy". Tiện ích chỉ tự chạy sau khi bấm.`, "ok");
}


// ================= v0.8.4: TRẠNG THÁI "ĐÃ NHẬP TỰ ĐỘNG" VÀ BẢNG XEM RÀ SOÁT =================
// Làm sạch dữ liệu trước khi gửi Firebase: bỏ ký tự lỗi (surrogate lẻ, ký tự điều khiển), sửa khóa không hợp lệ, số NaN/Infinity
function lamSachFb(v, goc) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '').replace(/￾|￿/g, '');
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map(lamSachFb);
  if (typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) { if (x === undefined) continue; o[(lamSachFb(String(k)).replace(/[.$#\[\]\/]/g, '_') || '_')] = lamSachFb(x); }
    return o;
  }
  return String(v);
}
async function fbGhi(phuongThuc, path, obj) {
  const secret = $("fbSecret").value.trim();
  if (!secret) throw new Error("chưa nhập mã bí mật");
  const r = await fetch(`${FB_URL}/${path}.json?auth=${encodeURIComponent(secret)}`, { method: phuongThuc, headers: { "Content-Type": "application/json" }, body: JSON.stringify(lamSachFb(obj, true)) });
  if (!r.ok) throw new Error(`máy chủ ${r.status}`);
}
// Sau khi người dùng đóng hồ sơ: đánh dấu trên đám mây để ẩn khỏi danh sách nạp và để team rà soát nhận biết
async function ghiDaNhapTuDong(d, t) {
  const id = d && d.__idMay;
  if (!id) return;
  const bay = new Date().toISOString(), tk = thongKeRaSoat(t.raSoat || []);
  try {
    await fbGhi("PATCH", "dsHoSo/" + encodeURIComponent(id), { trangThai: "đã nhập tự động", nhapTuDongLuc: bay, thongKeRaSoat: tk });
    await fbGhi("PATCH", "rasoat/" + encodeURIComponent(id), { id, ten: t.ten, cccd: d.identifyNo || "", trangThai: "đã nhập tự động – chờ rà soát", daDong: true, dongLuc: bay, thongKe: tk });
    const x = dsMay.find((y) => y.id === id);
    if (x) { x.trangThai = "đã nhập tự động"; x.chon = false; veDsMay(); }
  } catch (e) { trangThai("tdTT", `Đã đóng hồ sơ nhưng chưa ghi được trạng thái "đã nhập tự động" lên đám mây: ${e.message}`, "err"); }
}
// ---- Xem rà soát (v0.8.5): thẻ Cần rà soát / Đã rà soát / Tất cả, nhóm theo mục, tick từng mục ----
let rsDuLieu = [], rsTab = "can", rsTim = "";
const SO_MUC = (t) => { const m = String(t).match(/^B(\d+)/); return m ? Number(m[1]) : 99; };
function gopMucRs(mucs, xong) {
  const nhom = new Map();
  mucs.forEach((m, i) => {
    const g = nhom.get(m.muc) || nhom.set(m.muc, new Map()).get(m.muc);
    const r = g.get(m.truong) || g.set(m.truong, { truong: m.truong, loai: [], giaTri: "", ghiChu: [], idx: [] }).get(m.truong);
    if (!r.loai.includes(m.loai)) r.loai.push(m.loai);
    if (m.giaTri && !r.giaTri) r.giaTri = m.giaTri;
    if (m.ghiChu && !r.ghiChu.includes(m.ghiChu)) r.ghiChu.push(m.ghiChu);
    r.idx.push(i);
  });
  return [...nhom.entries()].sort((a, b) => SO_MUC(a[0]) - SO_MUC(b[0])).map(([muc, g]) => ({ muc, rows: [...g.values()] }));
}
const lopLoaiRs = (l) => (/mặc định|Giữ dữ liệu cũ/i.test(l) ? "md" : /Chưa|lỗi|Mục chưa/i.test(l) ? "loi" : "");
async function rsGhi(id, duongDan, obj) { await fbGhi("PATCH", `rasoat/${encodeURIComponent(id)}${duongDan}`, obj); }

// ---- Hiện vị trí cụ thể (v0.8.6): đánh dấu viền xanh lá các ô cần rà soát ngay trên trang, có hộp Giữ nguyên / Thay thế, tự tick mục tương ứng ----
let rsVT = null; // { ma, x, res, thay, dung }
async function rsNhanTin(m) {
  if (!rsVT || rsVT.ma !== m.ma || !m.ok) return;
  const x = rsVT.x;
  try {
    const o = {}; (m.idx || []).forEach((i) => { o[i] = { nguoi: ($("khuRaSoat").dataset.nguoi || "").trim() || "?", luc: new Date().toLocaleString("vi-VN"), cach: m.qd }; x.xong[i] = true; });
    if (m.qd === "thay") rsVT.thay++;
    veRaSoatPanel();
    await rsGhi(x.id, "/xong", o);
  } catch (e) { trangThai("ttMay", "Không ghi được tick lên đám mây: " + e.message, "err"); }
}
const KHOA_SUA = { b1: "currentFullName", dd: "leaveDate" };
function cauHinhViTri(ma, ds) {
  const cf = { ma, truong: ma === "dd" ? TRUONG_DD : null }, khongThay = [];
  const ghep = (m) => m.truong + (m.ghiChu ? " – " + m.ghiChu : "");
  const coGT = (m) => !!m.giaTri;
  if (ma in { b1: 1, dd: 1, kt: 1 }) {
    const nhom = new Map();
    for (const { m, i } of ds) {
      if (!m.k) { khongThay.push(i); continue; }
      const g = nhom.get(m.k) || { k: m.k, nhan: m.truong, moi: "", lyDo: [], idx: [], coThay: false };
      if (coGT(m)) { g.moi = String(m.giaTri); g.coThay = true; }
      g.lyDo.push(`[${m.loai}] ${m.ghiChu || ""}`); g.idx.push(i); nhom.set(m.k, g);
    }
    cf.form = [...nhom.values()].filter((g) => !(ma === "b1" && g.k === "profileNumber")).map((g) => ({ ...g, lyDo: g.lyDo.join(" · ") })); // Số lý lịch: giữ nguyên trên trang
  } else {
    const nhom = new Map();
    for (const { m, i } of ds) {
      if (m.hang === undefined || !m.dong) { khongThay.push(i); continue; }
      const g = nhom.get(m.hang) || { x: m.dong, nhan: String(m.truong).split(" – ")[0], lyDo: [], idx: [] };
      g.lyDo.push(`${m.k ? String(m.truong).split(" – ").slice(1).join(" – ") + ": " : ""}[${m.loai}] ${m.ghiChu || ""}`); g.idx.push(i); nhom.set(m.hang, g);
    }
    cf.bang = { buoc: ma, rows: [...nhom.values()].map((g) => ({ ...g, lyDo: g.lyDo.join(" · ") })) };
  }
  return { cf, khongThay };
}
async function hienViTriRS(x) {
  if (rsVT) { rsVT.dung = true; rsVT.res(); return; }
  const con = x.mucs.map((m, i) => ({ m, i })).filter(({ i }) => !x.xong[i]);
  if (!con.length) return trangThai("ttMay", "Hồ sơ này không còn mục nào cần rà soát.", "ok");
  if (!con.some(({ m }) => m.ma)) return trangThai("ttMay", "Danh sách rà soát của hồ sơ này được tạo bằng bản cũ nên chưa có thông tin vị trí. Chạy lại hồ sơ bằng bản v0.8.6 để có nút này.", "err");
  let tab;
  try { tab = await layTab(); } catch (e) { return trangThai("ttMay", e.message, "err"); }
  if (!confirm(`Trang đang mở có đúng là hồ sơ "${x.ten}" (CCCD ${x.cccd || "?"}) không?\nTiện ích sẽ lần lượt mở từng mục có vị trí cần rà soát, viền xanh lá các ô đó.`)) return;
  const thuTu = THU_TU.filter((m) => con.some((c) => c.m.ma === m));
  let khongTim = 0, daLam = 0;
  try {
    for (const ma of thuTu) {
      const ds = con.filter((c) => c.m.ma === ma && !x.xong[c.i]);
      if (!ds.length) continue;
      const { cf, khongThay } = cauHinhViTri(ma, ds);
      khongTim += khongThay.length;
      const mo = await goi(tab.id, (b) => window.__dhsAutoLib.moMuc(b), [ma]);
      if (!mo || !mo.ok) { trangThai("ttMay", `${TEN_MUC[ma]}: ${mo ? mo.loi : "không mở được mục"}`, "err"); khongTim += ds.length - khongThay.length; continue; }
      const laForm = ma in KHOA_SUA;
      if (laForm) { const su = await chay(tab.id, (k) => window.__dhsAutoLib.moSua(k), [KHOA_SUA[ma]]); if (!su || !su.ok) { trangThai("ttMay", `${TEN_MUC[ma]}: ${su ? su.loi : "không mở được chế độ sửa"}`, "err"); khongTim += ds.length - khongThay.length; continue; } }
      rsVT = { ma, x, thay: 0, dung: false, res: null };
      const cho = new Promise((r) => (rsVT.res = r));
      const kq = await chay(tab.id, (c) => window.__dhsAutoLib.hienViTri(c), [cf]);
      khongTim += (kq && kq.khongThay ? kq.khongThay.length : 0);
      if (!kq || !kq.daDanhDau) { rsVT = null; if (laForm) await chay(tab.id, () => window.__dhsAutoLib.huySua(), []).catch(() => {}); continue; }
      daLam += kq.daDanhDau;
      trangThai("ttMay", `${TEN_MUC[ma]}: ${kq.daDanhDau} vị trí viền xanh lá trên trang. Chọn Giữ nguyên / Thay thế ở từng ô, rồi bấm "Xong mục này" (góc phải dưới trang) để sang mục tiếp.`, "ok");
      veRaSoatPanel();
      await cho;
      const { thay, dung } = rsVT; rsVT = null;
      await chay(tab.id, () => window.__dhsAutoLib.xoaViTri(), []).catch(() => {});
      if (laForm) {
        if (thay > 0) { const lu = await chay(tab.id, (k) => window.__dhsAutoLib.luuVaCho({ khoaKey: k }), [KHOA_SUA[ma]]); trangThai("ttMay", lu && lu.ok ? `${TEN_MUC[ma]}: đã lưu ${thay} ô thay thế.` : `${TEN_MUC[ma]}: chưa lưu được – ${lu ? lu.loi : "lỗi"}. Kiểm tra trên trang.`, lu && lu.ok ? "ok" : "err"); }
        else await chay(tab.id, () => window.__dhsAutoLib.huySua(), []).catch(() => {});
      }
      if (dung) break;
    }
    const con2 = x.mucs.filter((_, i) => !x.xong[i]).length;
    trangThai("ttMay", `Đã rà theo vị trí xong (${daLam} vị trí).` + (khongTim ? ` ${khongTim} mục không tìm thấy vị trí trên trang – xử lý thủ công theo danh sách.` : "") + (con2 ? ` Còn ${con2} mục chưa tick.` : " Đã tick hết."), con2 ? "" : "ok");
  } catch (e) { trangThai("ttMay", "Lỗi khi hiện vị trí: " + e.message, "err"); }
  finally { if (rsVT) rsVT = null; try { await chay(tab.id, () => window.__dhsAutoLib.xoaViTri(), []); } catch (e) {} veRaSoatPanel(); }
}
const rsMo = new Set(), rsMoTat = new Set(); // khóa các <details> người dùng đã mở / đã đóng
function veRaSoatPanel() {
  const box = $("khuRaSoat");
  const cuon = document.scrollingElement ? document.scrollingElement.scrollTop : 0;
  box.innerHTML = "";
  const tenNguoi = el("input", { placeholder: "Tên người rà soát", style: "width:100%;margin:4px 0", value: box.dataset.nguoi || "" });
  chrome.storage.local.get(["qlNguoi"], (r) => { if (!tenNguoi.value) tenNguoi.value = r.qlNguoi || ""; });
  tenNguoi.onchange = () => { box.dataset.nguoi = tenNguoi.value; chrome.storage.local.set({ qlNguoi: tenNguoi.value.trim() }); };
  const conLai = (x) => x.mucs.filter((_, i) => !x.xong[i]).length;
  const dsCan = rsDuLieu.filter((x) => x.tt !== "xong" && conLai(x) > 0), dsXong = rsDuLieu.filter((x) => x.tt === "xong");
  const tatCa = rsDuLieu.flatMap((x) => x.mucs.filter((_, i) => !x.xong[i]));
  const dem = (...ls) => tatCa.filter((m) => ls.includes(m.loai)).length;
  box.append(el("div", { className: "rs-tom" },
    el("span", { textContent: `${rsDuLieu.length} hồ sơ` }), el("span", { className: "can", textContent: `AI cân nhắc: ${dem(LOAI_RS.can)}` }),
    el("span", { className: "can", textContent: `Xem lại: ${dem(LOAI_RS.giu, LOAI_RS.md)}` }), el("span", { className: "can", textContent: `Chưa điền: ${dem(LOAI_RS.loi, LOAI_RS.bb, LOAI_RS.muc)}` })), tenNguoi);
  const tabs = el("div", { className: "rs-tabs" });
  [["can", `Cần rà soát (${dsCan.length})`], ["xong", `Đã rà soát (${dsXong.length})`], ["all", `Tất cả (${rsDuLieu.length})`]].forEach(([k, t]) =>
    tabs.append(el("button", { className: "nho" + (rsTab === k ? " on" : ""), textContent: t, onclick: () => { rsTab = k; veRaSoatPanel(); } })));
  const tim = el("input", { placeholder: "Tìm theo tên, CCCD…", value: rsTim, style: "width:100%;margin:4px 0", oninput: (e) => { rsTim = e.target.value; ve2(); } });
  const ds = el("div");
  box.append(tabs, tim, ds);
  const ve2 = () => {
    ds.innerHTML = "";
    const q = khongDau(rsTim);
    const list = (rsTab === "can" ? dsCan : rsTab === "xong" ? dsXong : rsDuLieu).filter((x) => !q || khongDau(`${x.ten} ${x.cccd} ${x.id}`).includes(q));
    if (!list.length) ds.append(el("div", { className: "note", textContent: "Không có hồ sơ nào." }));
    for (const x of list) {
      const cl = conLai(x);
      const kHs = "h|" + x.id;
      const sec = el("details", { className: "rs-hs", open: rsMo.has(kHs) || (!rsMoTat.has(kHs) && list.length <= 2) }, el("summary", {}, el("b", { textContent: x.ten || "(chưa có họ tên)" }),
        ` · ${x.cccd || x.id} · ${cl}/${x.mucs.length} mục còn lại` + (x.vietTay ? " · ✍ viết tay" : "") + (x.tt === "xong" ? " · ✔ đã rà soát" : "")));
      for (const g of gopMucRs(x.mucs, x.xong)) {
        const so = g.rows.filter((r) => r.idx.some((i) => !x.xong[i])).length;
        const kM = "m|" + x.id + "|" + g.muc;
        const mg = el("details", { className: "rs-muc", open: rsMo.has(kM) || (!rsMoTat.has(kM) && so > 0) }, el("summary", {}, el("b", { textContent: g.muc }), ` (${so}/${g.rows.length})`));
        for (const r of g.rows) {
          const da = r.idx.every((i) => x.xong[i]);
          const cb = el("input", { type: "checkbox", checked: da, title: "Đã xử lý" });
          cb.onchange = async () => {
            try {
              const o = {}; r.idx.forEach((i) => (o[i] = cb.checked ? { nguoi: tenNguoi.value.trim() || "?", luc: new Date().toLocaleString("vi-VN") } : null));
              await rsGhi(x.id, "/xong", o); r.idx.forEach((i) => { if (cb.checked) x.xong[i] = true; else delete x.xong[i]; });
              veRaSoatPanel();
            } catch (e) { cb.checked = !cb.checked; trangThai("ttMay", "Không ghi được: " + e.message, "err"); }
          };
          mg.append(el("div", { className: "rs-dong" + (da ? " da" : "") }, cb, el("div", {},
            ...r.loai.map((l) => el("span", { className: "loai " + lopLoaiRs(l), textContent: l })), " ", el("b", { textContent: r.truong }),
            el("small", { textContent: (r.giaTri ? `Đã điền: ${r.giaTri} · ` : "") + r.ghiChu.join(" · ") }))));
        }
        mg.addEventListener("toggle", () => { if (mg.open) { rsMo.add(kM); rsMoTat.delete(kM); } else { rsMo.delete(kM); rsMoTat.add(kM); } });
        sec.append(mg);
      }
      sec.addEventListener("toggle", () => { if (sec.open) { rsMo.add(kHs); rsMoTat.delete(kHs); } else { rsMo.delete(kHs); rsMoTat.add(kHs); } });
      const nut = x.tt === "xong"
        ? el("button", { className: "nho", textContent: "↺ Mở lại để rà soát", onclick: async () => { try { await rsGhi(x.id, "", { trangThai: "đã nhập tự động – chờ rà soát" }); await fbGhi("PATCH", "dsHoSo/" + encodeURIComponent(x.id), { trangThai: "đã nhập tự động" }).catch(() => {}); x.tt = "tu"; veRaSoatPanel(); } catch (e) { trangThai("ttMay", e.message, "err"); } } })
        : el("button", { className: "nho xanh", textContent: "✔ Đánh dấu đã rà soát xong", onclick: async () => {
            if (cl && !confirm(`Còn ${cl} mục chưa tick. Vẫn đánh dấu đã rà soát xong?`)) return;
            try { await rsGhi(x.id, "", { trangThai: "đã rà soát", nguoiRaSoat: tenNguoi.value.trim() || "?", raSoatLuc: new Date().toLocaleString("vi-VN") }); await fbGhi("PATCH", "dsHoSo/" + encodeURIComponent(x.id), { trangThai: "đã rà soát" }).catch(() => {}); x.tt = "xong"; veRaSoatPanel(); } catch (e) { trangThai("ttMay", e.message, "err"); } } });
      if (x.tt !== "xong" && cl) sec.append(el("button", { className: "nho", style: "margin-right:6px", textContent: rsVT && rsVT.x === x ? "■ Dừng hiện vị trí" : "📍 Hiện vị trí cụ thể", title: "Mở từng mục trên trang, viền xanh lá các ô cần rà soát, có hộp Giữ nguyên / Thay thế", onclick: () => hienViTriRS(x) }));
      sec.append(nut);
      ds.append(sec);
    }
  };
  ve2();
  if (document.scrollingElement) document.scrollingElement.scrollTop = cuon;
}
$("xemRaSoat").onclick = async () => {
  const box = $("khuRaSoat");
  const khoaTuDien = (v) => { $("chayTD").disabled = v; $("tdTuChay").disabled = v; if (v) { tdKichHoat = false; choTrangMoi = false; } };
  if (!box.hidden) { box.hidden = true; $("xemRaSoat").textContent = "📋 Xem rà soát"; khoaTuDien(false); return; }
  khoaTuDien(true);
  $("xemRaSoat").disabled = true; trangThai("ttMay", "Đang tải danh sách rà soát…");
  try {
    const [rs, dsh] = await Promise.all([fbDoc("rasoat"), fbDoc("dsHoSo")]);
    rsDuLieu = Object.entries(rs || {}).filter(([, x]) => x && typeof x === "object").map(([id, x]) => {
      const mucs = (Array.isArray(x.dsMuc) ? x.dsMuc : Object.values(x.dsMuc || {})).filter(Boolean);
      return { id, ten: x.ten || "", cccd: x.cccd || "", mucs, xong: { ...(x.xong || {}) }, vietTay: !!((dsh || {})[id] || {}).vietTay, capNhat: x.dongLuc || x.capNhat || "",
        tt: /đã rà soát/i.test(x.trangThai || "") ? "xong" : "tu" };
    }).sort((a, b) => String(b.capNhat).localeCompare(String(a.capNhat)));
    veRaSoatPanel();
    box.hidden = false; $("xemRaSoat").textContent = "▲ Ẩn rà soát";
    trangThai("ttMay", `Đã tải rà soát của ${rsDuLieu.length} hồ sơ.`, "ok");
  } catch (e) { khoaTuDien(false); trangThai("ttMay", "Lỗi: " + e.message, "err"); }
  finally { $("xemRaSoat").disabled = false; }
};

$("vietTay").onchange = () => { const d = hs(); if (!d) return; d.__vietTay = $("vietTay").checked; luu(); capNhatNut(); trangThai("tdTT", d.__vietTay ? "Đã đánh dấu văn bản viết tay: hồ sơ vẫn chạy tự động, nhưng tiện ích dừng hỏi xác nhận ở mỗi ô AI cân nhắc/không rõ." : "Đã bỏ đánh dấu: hồ sơ này chạy tự động bình thường.", "ok"); };

// v0.8.5: trang quản lý hồ sơ đã nhập, rà soát, lọc trùng – mở trong thẻ mới của trình duyệt
$("moCay").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("cay.html") });
$("moChuanHoa").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("chuanhoa.html") });
$("moQuanLy").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("quanly.html") });
$("moSoSanh").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("sosanh.html") });
