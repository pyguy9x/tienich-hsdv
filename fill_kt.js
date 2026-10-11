// Bước 9 – Hoàn cảnh kinh tế (một biểu mẫu). Tiêm sau fill.js.
// Chỉ điền ô còn trống; ô đã có dữ liệu giữ nguyên và báo lại. Không tự bấm Lưu.
(() => {
  if (window.__dhsKTVer === 2) return;
  window.__dhsKTVer = 2;
  const L = window.__dhsLib;
  const { sleep, chuan, q, qa, cho, diemDung, ctl, gui } = L;

  // Thứ tự ô trên trang (13 ô cố định đầu tiên + từng cặp tài sản)
  const O_CO_DINH = [
    ["householdAnnualIncome", "Tổng thu nhập hộ gia đình/năm (đồng)", "tien"],
    ["perCapitaAnnualIncome", "Thu nhập bình quân đầu người (đồng)", "tien"],
    ["economicActivity", "Hoạt động kinh tế", "text"],
    ["countWorker", "Số lao động thuê mướn (người)", "so"],
    ["nhaCapLoai", "Nhà được cấp, được thuê – loại nhà", "text"],
    ["nhaCapDienTich", "Nhà được cấp, được thuê – diện tích (m2)", "so"],
    ["nhaMuaLoai", "Nhà tự mua, tự xây – loại nhà", "text"],
    ["nhaMuaDienTich", "Nhà tự mua, tự xây – diện tích (m2)", "so"],
    ["datCap", "Đất được cấp (m2)", "so"],
    ["datMua", "Đất tự mua (m2)", "so"],
    ["datTrangTrai", "Đất trang trại (ha)", "so"],
  ];
  const SO_TAI_SAN = 3;
  const TRUONG_KT = [...O_CO_DINH];
  for (let k = 1; k <= SO_TAI_SAN; k++) TRUONG_KT.push([`taiSan${k}Ten`, `Tài sản ${k} – tên`, "text"], [`taiSan${k}GiaTri`, `Tài sản ${k} – giá trị (đồng)`, "tien"]);
  window.TRUONG_KT = TRUONG_KT;

  const dsO = () => qa("[formcontrolname]").filter((e) => e.tagName === "INPUT" || e.tagName === "TEXTAREA");
  const coBuoc9 = () => !!q('[formcontrolname="householdAnnualIncome"]');
  const dangSua = () => coBuoc9() && !q('[formcontrolname="householdAnnualIncome"]').disabled && !q('[formcontrolname="householdAnnualIncome"]').readOnly;
  const nut = (re) => qa("button").find((b) => re.test(chuan(b.innerText)));
  const chiSo = (v) => String(v).replace(/\D/g, "");
  const soChuan = (v) => String(v).trim().replace(/\s/g, "").replace(",", ".");
  const giong = (kieu, a, b) => kieu === "tien" ? chiSo(a) === chiSo(b) && chiSo(a) !== "" : kieu === "so" ? soChuan(a) === soChuan(b) && soChuan(a) !== "" : chuan(a) === chuan(b);

  // Ô tương ứng với từng mã (tài sản k: cặp ô thứ 11+2(k-1), 12+2(k-1))
  function oCua(key) {
    const ds = dsO();
    const i = O_CO_DINH.findIndex((t) => t[0] === key);
    if (i >= 0) return ds[i] || null;
    const m = key.match(/^taiSan(\d)(Ten|GiaTri)$/);
    if (!m) return null;
    return ds[O_CO_DINH.length + 2 * (Number(m[1]) - 1) + (m[2] === "Ten" ? 0 : 1)] || null;
  }

  async function choOnDinh() {
    let truoc = "";
    for (let i = 0; i < 8; i++) {
      const hien = dsO().map((e) => e.value).join("|");
      if (hien === truoc && i > 1) return;
      truoc = hien;
      await sleep(500);
    }
  }

  window.__dhsKTSoSanh = async (duLieu) => {
    if (!coBuoc9()) return { loiChung: 'Chưa thấy mục "Hoàn cảnh kinh tế". Mở mục 9 của hồ sơ.' };
    await choOnDinh();
    const ds = [];
    for (const [key, nhan, kieu] of TRUONG_KT) {
      const moi = String(duLieu[key] ?? "").trim();
      const o = oCua(key);
      const cu = o ? o.value : "";
      if (!moi && !cu) continue;
      let tt;
      if (!moi) tt = "chiTrang";
      else if (!o) tt = /^taiSan/.test(key) ? "themMoi" : "an";
      else if (giong(kieu, cu, moi)) tt = "trung";
      else if (!cu) tt = "trong";
      else tt = "khac";
      ds.push({ key, nhan, cu, moi, tt });
    }
    return { ds, dangSua: dangSua() };
  };

  function choNguoiDung() {
    return new Promise((xong) => {
      let ketQua = null;
      const nghe = (e) => {
        const b = e.target.closest && e.target.closest("button");
        if (!b) return;
        const t = chuan(b.innerText);
        if (/^lưu/.test(t)) ketQua = "luu";
        else if (["đóng", "hủy", "huỷ", "thoát"].includes(t)) ketQua = ketQua === "luu" ? "luu" : "dong";
      };
      document.addEventListener("click", nghe, true);
      const tick = setInterval(() => {
        if (ctl.stopped) { fin("dung"); return; }
        if (!dangSua()) fin(ketQua === "luu" ? "luu" : ketQua || "dong");
        else if (ketQua === "luu") {
          const loi = qa(".form-control-error-general").map((x) => x.innerText.trim()).filter(Boolean);
          if (loi.length) { ketQua = null; gui({ type: "dhs-ds-loi", loi: [...new Set(loi)].slice(0, 4) }); }
        }
      }, 400);
      function fin(v) { clearInterval(tick); document.removeEventListener("click", nghe, true); xong(v); }
    });
  }

  // opt (chế độ tự động): { tuLuu, ghiDe, nghi: {mã: lý do} }
  async function dienKTCore(duLieu, chon, opt = {}) {
    const kq = { buoc: "kt", ten: "Hoàn cảnh kinh tế", o: [], ketQua: "" };
    const A = window.__dhsAutoLib;
    try {
      if (!dangSua()) {
        const b = nut(/^chỉnh sửa thông tin$/);
        if (!b) throw new Error('không thấy nút "Chỉnh sửa thông tin"');
        b.click();
        if (!(await cho(dangSua, 8000))) throw new Error("không mở được chế độ sửa");
      }
      await choOnDinh();
      const nghi = opt.nghi || {};
      if (opt.tuLuu && A) A.danhDau({ form: nghi });
      const ds = TRUONG_KT.filter(([k]) => chon.includes(k) && String(duLieu[k] ?? "").trim());
      let n = 0;
      for (const [key, nhan, kieu] of ds) {
        n++;
        await diemDung();
        gui({ type: "dhs-progress", n, tong: ds.length, nhan, paused: ctl.paused });
        L.veBang(`Hoàn cảnh kinh tế ${n}/${ds.length}: ${nhan}`, kq.o.filter((o) => !o.ok), false);
        let moi = String(duLieu[key]).trim();
        const gn = nghi[key] ? { nghi: nghi[key] } : {};
        let o = oCua(key);
        const m = key.match(/^taiSan(\d)/);
        if (!o && m) { // thêm dòng tài sản cho đủ
          for (let lan = 0; lan < 3 && !oCua(key); lan++) {
            const b = nut(/^thêm tài sản$/);
            if (!b) break;
            b.click();
            await sleep(600);
          }
          o = oCua(key);
        }
        if (!o) { kq.o.push({ key, nhan, ok: false, loi: "không có ô trên trang", ...gn }); continue; }
        const cu = o.value;
        if (cu && giong(kieu, cu, moi)) { kq.o.push({ key, nhan, ok: true, hien: cu, tt: "trung", ...gn }); continue; }
        if (opt.hoiXN && gn.nghi && A && A.hoiXacNhan) {
          const k2 = await A.hoiXacNhan({ key, nhan, cu, moi, lyDo: gn.nghi, el: o });
          if (k2.qd !== "thay") { kq.o.push({ key, nhan, ok: true, hien: cu, cu, moi, tt: "giu", ...gn }); continue; }
          moi = k2.v; gn.xacNhan = true;
          if (cu && giong(kieu, cu, moi)) { kq.o.push({ key, nhan, ok: true, hien: cu, tt: "trung", ...gn }); continue; }
        }
        if (cu && gn.nghi && opt.hoiNghi && A && A.hoiNghi) {
          const qd = await A.hoiNghi({ key, nhan, cu, moi, lyDo: gn.nghi, el: o });
          if (qd !== "thay") { kq.o.push({ key, nhan, ok: true, hien: cu, cu, moi, tt: "giu", ...gn }); continue; }
        }
        if (cu && !opt.ghiDe) { kq.o.push({ key, nhan, ok: false, tt: "khac", loi: `đã có "${cu}" – giữ nguyên (file: "${moi}")` }); continue; }
        if (kieu === "so" && !/^\d+$/.test(soChuan(moi))) { kq.o.push({ key, nhan, ok: false, loi: `hệ thống chỉ nhận số nguyên, file ghi "${moi}"`, ...gn }); continue; }
        o.scrollIntoView({ block: "center" });
        o.focus();
        L.datGiaTri(o, kieu === "tien" ? chiSo(moi) || moi : kieu === "so" ? soChuan(moi) : moi);
        o.dispatchEvent(new Event("blur", { bubbles: true }));
        await sleep(250);
        const ok = giong(kieu, o.value, moi);
        kq.o.push({ key, nhan, ok, hien: o.value, cu, tt: cu ? "ghiDe" : "dien", loi: ok ? "" : `trang hiện "${o.value}"`, ...gn });
      }
      const loi = kq.o.filter((o) => !o.ok);
      const soDoi = kq.o.filter((o) => o.tt === "dien" || o.tt === "ghiDe").length;
      if (opt.tuLuu) {
        if (A) A.danhDau({ form: nghi });
        if (!soDoi) { await A.huySua(); kq.ketQua = "trung"; }
        else {
          L.veBang(`Hoàn cảnh kinh tế: điền ${soDoi} ô – đang bấm Lưu thông tin…`, loi, false);
          const r = await A.luuVaCho({ khoaKey: "householdAnnualIncome" });
          if (r.ok) kq.ketQua = "luu";
          else {
            kq.loiLuu = r.loi;
            gui({ type: "dhs-auto-cho", muc: "kt", ten: kq.ten, loi: r.loi });
            L.veBang('Hoàn cảnh kinh tế: trang báo lỗi khi lưu – SỬA trên trang rồi bấm "Lưu thông tin"', [{ ok: false, nhan: "Lỗi", loi: r.loi }], false);
            kq.ketQua = await choNguoiDung();
          }
        }
      } else {
        L.veBang(`Hoàn cảnh kinh tế: điền ${soDoi} ô` + (loi.length ? `, ${loi.length} cần xem` : "") + ' – KIỂM TRA rồi bấm "Lưu thông tin" (hoặc "Đóng" để bỏ)', loi, false);
        gui({ type: "dhs-ds-cho", buoc: "kt", i: 0, tong: 1, kq });
        kq.ketQua = await choNguoiDung();
      }
    } catch (e) {
      kq.ketQua = e.message === "__STOP__" ? "dung" : "loi";
      kq.loi = e.message;
    }
    L.veBang(`Hoàn cảnh kinh tế: ${kq.ketQua === "luu" ? "đã lưu" : kq.ketQua === "trung" ? "không có gì thay đổi" : kq.ketQua === "dong" ? "đã đóng, không lưu" : kq.loi || kq.ketQua}`, kq.o.filter((o) => !o.ok), true);
    return kq;
  }

  window.__dhsKTDien = (duLieu, chon) => {
    if (ctl.running) return { loiChung: "Đang chạy một việc khác." };
    if (!coBuoc9()) return { loiChung: 'Chưa thấy mục "Hoàn cảnh kinh tế". Mở mục 9 của hồ sơ.' };
    ctl.running = true; ctl.paused = false; ctl.stopped = false;
    (async () => {
      const kq = await dienKTCore(duLieu, chon);
      ctl.running = false;
      gui({ type: "dhs-ds-mot", buoc: "kt", kq });
      gui({ type: "dhs-ds-xong", buoc: "kt", tong: [kq], dung: ctl.stopped });
    })();
    return { batDau: true };
  };
  window.__dhsKTDienCho = async (duLieu, chon, opt) => {
    if (ctl.running) return { loiChung: "Đang chạy một việc khác." };
    if (!coBuoc9()) return { loiChung: 'Chưa thấy mục "Hoàn cảnh kinh tế".' };
    ctl.running = true; ctl.paused = false; ctl.stopped = false;
    try { return await dienKTCore(duLieu, chon, { tuLuu: true, ghiDe: true, ...(opt || {}) }); }
    finally { ctl.running = false; }
  };
})();
