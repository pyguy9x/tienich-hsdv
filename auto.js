// Chế độ tự động: chuyển mục, mở chế độ sửa, bấm Lưu và chờ kết quả, tô đỏ ô AI chưa chắc, đóng hồ sơ.
// Tiêm sau fields.js, fill.js, fill_ds.js, fill_kt.js.
(() => {
  if (window.__dhsAutoVer === 5) return;
  window.__dhsAutoVer = 5;
  const L = window.__dhsLib;
  const { sleep, chuan, q, qa, click, cho, ctl } = L;

  const hien = (e) => !!(e && e.isConnected && e.getClientRects().length && getComputedStyle(e).visibility !== "hidden");
  const nutHien = (re, root = document) => qa("button", root).filter(hien).find((b) => re.test(chuan(b.innerText)));
  const modalMo = () => qa("vts-modal-container, .vts-modal").filter(hien).pop() || null;

  // ---------- Các mục của hồ sơ (danh sách bên trái trang Xem thông tin đảng viên) ----------
  const coBang = (b) => () => {
    const c = (window.CAU_HINH_DS || {})[b];
    if (!c) return false;
    return qa("table").filter(hien).some((t) => {
      const hs = qa("thead th", t).map((th) => chuan(th.innerText));
      if (c.khoaBang) return c.khoaBang.every((ks) => hs.some((h) => [].concat(ks).some((k) => h.includes(k))));
      return c.bang.every((h) => hs.some((th) => th === h));
    });
  };
  const coTab = (ten) => () => qa(".vts-tabs-tab-btn").filter(hien).some((e) => chuan(e.innerText) === ten);
  const coO = (key) => () => hien(L.host(key)) || hien(q(`[formcontrolname="${key}"] input`));
  const MUC = {
    b1: { ten: "Thông tin cơ bản", tu: ["thông tin cơ bản"], so: 0, dau: coO("currentFullName") },
    qtct: { ten: "Quá trình công tác", tu: ["quá trình công tác"], so: 1, dau: coBang("qtct") },
    daotao: { ten: "Đào tạo bồi dưỡng", tu: ["đào tạo"], so: 2, dau: coBang("daotao") },
    huyhieu: { ten: "Huy hiệu Đảng", tu: ["huy hiệu"], so: 3, dau: coBang("huyhieu") },
    khenthuong: { ten: "Khen thưởng, đánh giá, kỷ luật", tu: ["khen thưởng"], so: 4, dau: coTab("khen thưởng") },
    dd: { ten: "Đặc điểm lịch sử", tu: ["đặc điểm lịch sử", "lịch sử"], so: 5, dau: coO("leaveDate") },
    nuocngoai: { ten: "Đi nước ngoài", tu: ["nước ngoài"], so: 6, dau: coBang("nuocngoai") },
    qh: { ten: "Quan hệ gia đình", tu: ["gia đình"], so: 7, dau: coBang("qh") },
    kt: { ten: "Hoàn cảnh kinh tế", tu: ["kinh tế"], so: 8, dau: coO("householdAnnualIncome") },
    mxh: { ten: "Tài khoản mạng xã hội", tu: ["mạng xã hội"], so: 9, dau: coBang("mxh") },
  };
  MUC.danhgia = MUC.kyluat = MUC.khenthuong;

  const cacMuc = () => {
    let ds = qa("vts-steps-item, .vts-steps-item").filter(hien);
    if (!ds.length) ds = qa('[class*="steps-item"]').filter((e) => hien(e) && !e.parentElement.closest('[class*="steps-item"]'));
    return ds;
  };

  // Mở một mục; trả {ok} hoặc {ok:false, loi}
  async function moMuc(b) {
    const m = MUC[b];
    if (!m) return { ok: false, loi: "mục không xác định: " + b };
    if (modalMo()) return { ok: false, loi: "Đang có hộp thoại mở trên trang. Đóng hộp thoại rồi chạy lại." };
    const ds = cacMuc();
    if (!ds.length) return m.dau() ? { ok: true, san: true } : { ok: false, loi: "Không thấy danh sách các mục của hồ sơ (cột bên trái). Mở trang Xem thông tin đảng viên." };
    let it = ds.find((i) => m.tu.some((t) => chuan(i.innerText).includes(t)));
    if (!it && ds.length >= 10) it = ds[m.so];
    if (!it) return { ok: false, loi: `Không thấy mục "${m.ten}" trong danh sách bên trái.` };
    const dangMo = /active|process|current/.test(it.className) && m.dau();
    if (!dangMo) {
      it.scrollIntoView({ block: "center" });
      click(q(".vts-steps-item-container, .vts-steps-item-title, .vts-steps-item-content", it) || it);
      await sleep(600);
    }
    if (!(await cho(m.dau, 10000, 250))) return { ok: false, loi: `Đã bấm mục "${m.ten}" nhưng không thấy nội dung mục này.` };
    if (window.__dhsChonTab && (b === "khenthuong" || b === "danhgia" || b === "kyluat")) await window.__dhsChonTab(b);
    await sleep(700);
    return { ok: true };
  }

  // ---------- Chế độ sửa (Thông tin cơ bản, Đặc điểm lịch sử, Hoàn cảnh kinh tế) ----------
  const biKhoaO = (key) => {
    const h = L.host(key);
    if (!h) return true;
    const i = h.matches("input, textarea") ? h : q("input, textarea", h);
    return h.className.includes("disabled") || !!(i && (i.disabled || i.readOnly));
  };
  async function moSua(khoaKey) {
    if (!biKhoaO(khoaKey) || (!nutHien(/^chỉnh sửa thông tin$/) && nutHien(/^lưu/))) return { ok: true, daMo: false };
    const b = nutHien(/^chỉnh sửa thông tin$/);
    if (!b) return { ok: false, loi: 'Ô đang khóa và không thấy nút "Chỉnh sửa thông tin".' };
    b.scrollIntoView({ block: "center" });
    b.click();
    const ok = await cho(() => !biKhoaO(khoaKey) || (!nutHien(/^chỉnh sửa thông tin$/) && nutHien(/^lưu/)), 8000);
    await sleep(800);
    return ok ? { ok: true, daMo: true } : { ok: false, loi: "Không mở được chế độ sửa." };
  }
  // Thoát chế độ sửa khi không có gì thay đổi (không lưu)
  async function huySua() {
    const b = nutHien(/^(hủy|huỷ|hủy bỏ|huỷ bỏ|hủy chỉnh sửa|đóng)$/);
    if (!b) return false;
    b.click();
    const xn = await cho(() => nutHien(/^(thoát|đồng ý|xác nhận|có)$/, modalMo() || document.createElement("i")), 1500);
    if (xn) xn.click();
    await sleep(600);
    return true;
  }

  // ---------- Bấm Lưu và chờ kết quả ----------
  const SEL_TB = ".vts-message-notice, .vts-notification-notice, .vts-message, .vts-notification, [class*='toast'], [class*='snack'], .cdk-overlay-container [class*='message'], .cdk-overlay-container [class*='notification']";
  const SEL_LOI = ".form-control-error-general, .vts-form-item-explain-error, .form-control-error, .invalid-feedback, [class*='error-message'], [class*='text-error']";
  const docLoi = () => [...new Set(qa(SEL_LOI).filter(hien).map((x) => x.innerText.trim()).filter(Boolean))];
  // opt: { formKey: biểu mẫu trong hộp thoại (đóng lại là đã lưu), khoaKey: ô dùng để nhận biết đã thoát chế độ sửa }
  async function luuVaCho(opt = {}) {
    const md = modalMo();
    const nut = (md && nutHien(/^lưu( thông tin)?$/, md)) || nutHien(/^(lưu thông tin|lưu & tiếp tục|lưu và tiếp tục|lưu)$/);
    if (!nut) return { ok: false, loi: 'Không thấy nút "Lưu thông tin".' };
    const loiTruoc = new Set(docLoi());
    const tbTruoc = new Set(qa(SEL_TB));
    const url0 = location.href;
    let daXacNhan = false;
    ctl.auto = true;
    try {
      nut.scrollIntoView({ block: "center" });
      nut.click();
      for (let t = 0; t < 25000; t += 300) {
        await sleep(300);
        const tb = qa(SEL_TB).filter((x) => !tbTruoc.has(x) && hien(x)).map((x) => x.innerText.trim()).filter(Boolean).join(" | ");
        if (/không thành công|thất bại|lỗi|không hợp lệ/i.test(tb)) return { ok: false, loi: tb };
        if (/thành công/i.test(tb)) return { ok: true, tb };
        // Hộp thoại xác nhận lưu (nếu hệ thống hỏi lại)
        const md2 = modalMo();
        if (!daXacNhan && md2 && md2 !== md) {
          const xn = nutHien(/^(đồng ý|xác nhận|có|ok|tiếp tục)$/, md2);
          if (xn && /lưu|cập nhật|xác nhận/i.test(md2.innerText)) { xn.click(); daXacNhan = true; continue; }
        }
        const loi = docLoi().filter((x) => !loiTruoc.has(x));
        if (loi.length && t >= 600) return { ok: false, loi: loi.slice(0, 5).join("; ") };
        if (opt.formKey && !q(`[formcontrolname="${opt.formKey}"]`) && t >= 600) return { ok: true };
        if (opt.khoaKey && t >= 600 && biKhoaO(opt.khoaKey) && nutHien(/^chỉnh sửa thông tin$/)) return { ok: true };
        if (location.href !== url0 && t >= 600) return { ok: true, chuyenTrang: true };
      }
      const loi = docLoi();
      return { ok: false, loi: loi.length ? loi.slice(0, 5).join("; ") : "Không xác nhận được kết quả lưu sau 25 giây – kiểm tra trên trang." };
    } finally { setTimeout(() => (ctl.auto = false), 2500); }
  }
  // Chờ người dùng sửa lỗi rồi tự bấm Lưu (dùng cho Thông tin cơ bản / Đặc điểm lịch sử)
  function choNguoiLuu(khoaKey) {
    const url0 = location.href;
    return new Promise((xong) => {
      const tick = setInterval(() => {
        if (location.href !== url0) { clearInterval(tick); xong("luu"); return; }
        if (ctl.stopped) { clearInterval(tick); xong("dung"); return; }
        if (window.__dhsBoQua) { window.__dhsBoQua = false; clearInterval(tick); xong("boQua"); return; }
        if (biKhoaO(khoaKey) && nutHien(/^chỉnh sửa thông tin$/)) { clearInterval(tick); xong("luu"); }
      }, 500);
    });
  }

  // ---------- Tô đỏ ô / dòng AI chưa chắc ----------
  let cauHinhDD = null, henDD = null;
  function kieuDD() {
    if (q("#__dhs_style")) return;
    const st = document.createElement("style");
    st.id = "__dhs_style";
    st.textContent = `.__dhs_nghi{outline:3px solid #dc2626!important;outline-offset:1px;border-radius:4px;background:#fef2f2!important}
.__dhs_nghi input,.__dhs_nghi textarea,.__dhs_nghi .vts-select-selector,input.__dhs_nghi,textarea.__dhs_nghi{background:#fef2f2!important}
.__dhs_ghichu{color:#b91c1c;font:600 12px/1.3 Segoe UI,Arial,sans-serif;margin:3px 0 2px}
tr.__dhs_nghi_dong>td{background:#fee2e2!important}
.__dhs_ghichu_dong{color:#b91c1c;font:600 11px/1.3 Segoe UI,Arial,sans-serif}`;
    document.head.appendChild(st);
  }
  function xoaDD() {
    qa(".__dhs_nghi").forEach((e) => e.classList.remove("__dhs_nghi"));
    qa(".__dhs_nghi_dong").forEach((e) => { e.classList.remove("__dhs_nghi_dong"); e.removeAttribute("title"); });
    qa(".__dhs_ghichu, .__dhs_ghichu_dong").forEach((e) => e.remove());
  }
  function apDD() {
    if (!cauHinhDD) return;
    kieuDD();
    const goc = modalMo() || document;
    for (const [key, lyDo] of Object.entries(cauHinhDD.form || {})) {
      const h = q(`[formcontrolname="${key}"]`, goc);
      if (!h || !hien(h)) continue;
      if (!h.classList.contains("__dhs_nghi")) h.classList.add("__dhs_nghi");
      const vo = h.closest(".vts-form-item-control-input, .vts-form-item-control, .vts-col, .col, div") || h.parentElement;
      const id = "__dhs_gc_" + key;
      if (!q(`[data-dhs="${id}"]`, vo.parentElement || vo)) {
        const g = document.createElement("div");
        g.className = "__dhs_ghichu"; g.dataset.dhs = id;
        g.textContent = "⚠ AI chưa chắc: " + lyDo;
        vo.after(g);
      }
    }
    const bg = cauHinhDD.bang;
    if (bg && window.__dhsTimTr && !modalMo()) {
      for (const r of bg.rows || []) {
        const tr = window.__dhsTimTr(bg.buoc, r.x);
        if (!tr || tr.classList.contains("__dhs_nghi_dong")) continue;
        tr.classList.add("__dhs_nghi_dong");
        tr.title = "AI chưa chắc: " + r.lyDo;
        const g = document.createElement("div");
        g.className = "__dhs_ghichu_dong"; g.textContent = "⚠ " + r.lyDo;
        (tr.children[1] || tr.firstElementChild).append(g);
      }
    }
  }
  const quanSat = new MutationObserver(() => { clearTimeout(henDD); henDD = setTimeout(apDD, 400); });
  // cfg: { form: {mã: lý do}, bang: { buoc, rows: [{x, lyDo}] } } ; null để xóa
  function danhDau(cfg) {
    xoaDD();
    cauHinhDD = cfg && (Object.keys(cfg.form || {}).length || (cfg.bang && cfg.bang.rows && cfg.bang.rows.length)) ? cfg : null;
    quanSat.disconnect();
    if (cauHinhDD) { apDD(); quanSat.observe(document.body, { childList: true, subtree: true }); }
    return !!cauHinhDD;
  }

  function kieuHoi() {
    if (!q("#__dhs_style_hoi")) {
      const st = document.createElement("style");
      st.id = "__dhs_style_hoi";
      st.textContent = `.__dhs_hoi{position:fixed;z-index:2147483600;width:300px;max-width:calc(100vw - 16px);background:#fff;border:2px solid #dc2626;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.28);padding:10px 12px;font:13px/1.4 Segoe UI,Arial,sans-serif;color:#1f2937}
.__dhs_hoi b{display:block;color:#b91c1c;margin-bottom:4px}
.__dhs_hoi .cu{opacity:.5;font-style:italic;background:#f3f4f6;border-radius:4px;padding:3px 6px;margin:2px 0 6px;word-break:break-word}
.__dhs_hoi .moi{background:#fef2f2;border-radius:4px;padding:3px 6px;margin:2px 0 4px;word-break:break-word}
.__dhs_hoi small{display:block;color:#b91c1c;margin-bottom:8px}
.__dhs_hoi .nut{display:flex;gap:8px}
.__dhs_hoi button{flex:1;padding:6px 8px;border-radius:6px;border:1px solid #9ca3af;background:#fff;cursor:pointer;font:600 13px Segoe UI,Arial,sans-serif}
.__dhs_hoi button.thay{background:#b91c1c;border-color:#b91c1c;color:#fff}
.__dhs_hoi input{width:100%;box-sizing:border-box;padding:5px 6px;margin:2px 0 6px;border:1px solid #9ca3af;border-radius:4px;font:13px Segoe UI,Arial,sans-serif}`;
      document.head.appendChild(st);
    }
  }
  // ---------- Hỏi Giữ nguyên / Thay thế khi ô AI chưa chắc đang có dữ liệu khác trên trang (v0.8.2) ----------
  // o: { key, nhan, cu, moi, lyDo, el? } → "giu" (giữ dữ liệu cũ) | "thay" (điền dữ liệu đám mây)
  function hoiNghi(o) {
    kieuDD();
    kieuHoi();
    const h = o.el || q(`[formcontrolname="${o.key}"]`, modalMo() || document) || L.host(o.key);
    if (h && h.scrollIntoView) h.scrollIntoView({ block: "center" });
    return new Promise((xong) => {
      const hop = document.createElement("div");
      hop.className = "__dhs_hoi";
      const cu = document.createElement("div"), moi = document.createElement("div"), tieuDe = document.createElement("b"), ld = document.createElement("small");
      tieuDe.textContent = "⚠ " + o.nhan + " – AI chưa chắc";
      cu.className = "cu"; cu.textContent = "Trên trang (gốc): " + (o.cu || "(trống)");
      moi.className = "moi"; moi.textContent = "Đám mây: " + o.moi;
      ld.textContent = o.lyDo || "";
      const nut = document.createElement("div"); nut.className = "nut";
      const giu = document.createElement("button"), thay = document.createElement("button");
      giu.textContent = "Giữ nguyên"; thay.textContent = "Thay thế"; thay.className = "thay";
      nut.append(giu, thay);
      hop.append(tieuDe, cu, moi, ld, nut);
      document.body.appendChild(hop);
      const dat = () => {
        const r = h && h.getBoundingClientRect ? h.getBoundingClientRect() : null;
        const rong = hop.offsetWidth, cao = hop.offsetHeight;
        let top = r ? r.bottom + 6 : (innerHeight - cao) / 2;
        let left = r ? r.left : (innerWidth - rong) / 2;
        if (top + cao > innerHeight - 8) top = r ? Math.max(8, r.top - cao - 6) : 8;
        left = Math.max(8, Math.min(left, innerWidth - rong - 8));
        hop.style.top = top + "px"; hop.style.left = left + "px";
      };
      dat();
      const tick = setInterval(() => { dat(); if (ctl.stopped) ket("giu"); }, 400);
      const ket = (v) => { clearInterval(tick); hop.remove(); xong(v); };
      giu.onclick = () => ket("giu");
      thay.onclick = () => ket("thay");
    });
  }

  // Văn bản viết tay: hỏi người dùng xác nhận ô AI cân nhắc/không rõ. Trả {qd: "thay"|"giu", v: giá trị sau khi xác nhận/sửa}
  function hoiXacNhan(o) {
    kieuHoi();
    const h = o.el || q(`[formcontrolname="${o.key}"]`, modalMo() || document) || L.host(o.key);
    if (h && h.scrollIntoView) h.scrollIntoView({ block: "center" });
    return new Promise((xong) => {
      const hop = document.createElement("div");
      hop.className = "__dhs_hoi";
      const tieuDe = document.createElement("b"), cu = document.createElement("div"), ld = document.createElement("small"), nhan = document.createElement("div"), inp = document.createElement("input");
      tieuDe.textContent = "✍ Văn bản viết tay – xác nhận: " + o.nhan;
      cu.className = "cu"; cu.textContent = "Trên trang (gốc): " + (o.cu || "(trống)");
      nhan.textContent = "AI đọc là (sửa nếu sai):";
      inp.value = o.moi || "";
      ld.textContent = o.lyDo || "";
      const nut = document.createElement("div"); nut.className = "nut";
      const bo = document.createElement("button"), ok = document.createElement("button");
      bo.textContent = "Bỏ qua ô này"; ok.textContent = "Xác nhận & điền"; ok.className = "thay";
      nut.append(bo, ok);
      hop.append(tieuDe, cu, nhan, inp, ld, nut);
      document.body.appendChild(hop);
      const dat = () => {
        const r = h && h.getBoundingClientRect ? h.getBoundingClientRect() : null;
        const rong = hop.offsetWidth, cao = hop.offsetHeight;
        let top = r ? r.bottom + 6 : (innerHeight - cao) / 2;
        let left = r ? r.left : (innerWidth - rong) / 2;
        if (top + cao > innerHeight - 8) top = r ? Math.max(8, r.top - cao - 6) : 8;
        left = Math.max(8, Math.min(left, innerWidth - rong - 8));
        hop.style.top = top + "px"; hop.style.left = left + "px";
      };
      dat(); inp.focus();
      const tick = setInterval(() => { dat(); if (ctl.stopped) ket("giu"); }, 400);
      const ket = (qd) => { clearInterval(tick); hop.remove(); xong({ qd, v: inp.value.trim() }); };
      bo.onclick = () => ket("giu");
      ok.onclick = () => (inp.value.trim() ? ket("thay") : ket("giu"));
      inp.onkeydown = (e) => { if (e.key === "Enter") ok.click(); };
    });
  }

  // ---------- Hiện vị trí cụ thể cần rà soát (v0.8.6): viền xanh lá + hộp Giữ nguyên / Thay thế ----------
  // cfg: { ma, truong, form: [{k, nhan, moi, lyDo, idx, coThay}], bang: { buoc, rows: [{x, nhan, lyDo, idx}] } }
  // Mỗi lựa chọn gửi tin { type: "dhs-rs", ma, idx, qd: "giu"|"thay"|"xem", ok, loi } về bảng bên để tick mục tương ứng.
  let conRS = 0, cfgRS = null;
  function kieuRS() {
    if (q("#__dhs_style_rs")) return;
    const st = document.createElement("style");
    st.id = "__dhs_style_rs";
    st.textContent = `.__dhs_rs{outline:3px solid #16a34a!important;outline-offset:1px;border-radius:4px;background:#f0fdf4!important}
.__dhs_rs input,.__dhs_rs textarea,.__dhs_rs .vts-select-selector,input.__dhs_rs,textarea.__dhs_rs{background:#f0fdf4!important}
tr.__dhs_rs_dong>td{background:#dcfce7!important;outline:2px solid #16a34a}
.__dhs_rsbox{border:2px solid #16a34a;border-radius:8px;background:#fff;padding:8px 10px;margin:4px 0 6px;font:13px/1.4 Segoe UI,Arial,sans-serif;color:#1f2937;max-width:420px;box-sizing:border-box}
.__dhs_rsbox b{display:block;color:#15803d;margin-bottom:3px}
.__dhs_rsbox .cu{opacity:.55;font-style:italic;background:#f3f4f6;border-radius:4px;padding:3px 6px;margin:2px 0;word-break:break-word}
.__dhs_rsbox .moi{background:#f0fdf4;border-radius:4px;padding:3px 6px;margin:2px 0;word-break:break-word}
.__dhs_rsbox small{display:block;color:#166534;margin:3px 0 6px}
.__dhs_rsbox .nut{display:flex;gap:8px}
.__dhs_rsbox button{flex:1;padding:5px 8px;border-radius:6px;border:1px solid #9ca3af;background:#fff;cursor:pointer;font:600 13px Segoe UI,Arial,sans-serif}
.__dhs_rsbox button.thay{background:#15803d;border-color:#15803d;color:#fff}
.__dhs_rsbox.xong{opacity:.6}.__dhs_rsbox.xong .nut{display:none}
.__dhs_rsbox .kq{font-weight:600;color:#15803d}.__dhs_rsbox .kq.loi{color:#b91c1c}
.__dhs_rsbar{position:fixed;right:12px;bottom:12px;z-index:2147483600;background:#15803d;color:#fff;border-radius:8px;padding:8px 12px;font:600 13px Segoe UI,Arial,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3)}
.__dhs_rsbar button{margin-left:10px;padding:3px 8px;border-radius:5px;border:0;background:#fff;color:#15803d;font:600 12px Segoe UI,Arial,sans-serif;cursor:pointer}`;
    document.head.appendChild(st);
  }
  function xoaViTri() {
    qa(".__dhs_rs").forEach((e) => e.classList.remove("__dhs_rs"));
    qa(".__dhs_rs_dong").forEach((e) => e.classList.remove("__dhs_rs_dong"));
    qa(".__dhs_rsbox, .__dhs_rsbar").forEach((e) => e.remove());
    conRS = 0; cfgRS = null;
    return true;
  }
  const docGT = (h) => { const i = h.matches("input, textarea") ? h : q("input, textarea", h); return i && i.value ? i.value : chuan(h.innerText); };
  function hopRS(cf, tieuDe, cu, moi, lyDo, coThay, idx, thucThi) {
    const hop = document.createElement("div");
    hop.className = "__dhs_rsbox";
    const t = document.createElement("b"); t.textContent = "🔍 " + tieuDe;
    hop.append(t);
    if (cu !== null) { const c = document.createElement("div"); c.className = "cu"; c.textContent = "Trên trang: " + (cu || "(trống)"); hop.append(c); }
    if (moi) { const m = document.createElement("div"); m.className = "moi"; m.textContent = "Đám mây: " + moi; hop.append(m); }
    if (lyDo) { const s = document.createElement("small"); s.textContent = lyDo; hop.append(s); }
    const nut = document.createElement("div"); nut.className = "nut";
    const kq = document.createElement("div"); kq.className = "kq";
    let xongRoi = false;
    const ket = (qd, ok, loi) => {
      if (ok) { xongRoi = true; hop.classList.add("xong"); kq.className = "kq"; kq.textContent = qd === "thay" ? "✔ Đã thay bằng dữ liệu đám mây" : qd === "giu" ? "✔ Giữ nguyên" : "✔ Đã xem"; }
      else { kq.className = "kq loi"; kq.textContent = "✘ " + loi; }
      if (ok) { L.gui({ type: "dhs-rs", ma: cf.ma, idx, qd, ok: true }); if (--conRS <= 0) L.gui({ type: "dhs-rs-het", ma: cf.ma }); capNhatBar(); }
    };
    const dat = (qd) => async () => {
      if (xongRoi) return;
      if (qd !== "thay") return ket(qd, true);
      nut.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try { const r = await thucThi(); r.ok ? ket("thay", true) : ket("thay", false, r.loi || "không thay được"); }
      catch (e) { ket("thay", false, e.message); }
      nut.querySelectorAll("button").forEach((b) => (b.disabled = false));
    };
    if (coThay && moi) {
      const giu = document.createElement("button"), thay = document.createElement("button");
      giu.textContent = "Giữ nguyên"; thay.textContent = "Thay thế"; thay.className = "thay";
      giu.onclick = dat("giu"); thay.onclick = dat("thay");
      nut.append(giu, thay);
    } else {
      const xem = document.createElement("button"); xem.textContent = coThay ? "Giữ nguyên" : "Đã xem – giữ nguyên"; xem.className = "thay";
      xem.onclick = dat(coThay ? "giu" : "xem"); nut.append(xem);
    }
    hop.append(nut, kq);
    return hop;
  }
  function capNhatBar() {
    const b = q(".__dhs_rsbar span");
    if (b) b.textContent = conRS > 0 ? `Rà soát: còn ${conRS} vị trí` : "Đã xử lý hết vị trí của mục này";
  }
  async function thayO(cf, k, moi, cu) {
    if (cf.ma === "kt") {
      const r = await window.__dhsKTDienCho({ [k]: moi }, [k], {});
      if (!r || r.loiChung) return { ok: false, loi: r ? r.loiChung : "không điền được" };
      if (r.ketQua === "loi") return { ok: false, loi: r.loi || "lưu lỗi" };
      const o = (r.o || [])[0];
      return o && !o.ok ? { ok: false, loi: o.loi } : { ok: true };
    }
    const r = await window.__dhsDienCho([{ key: k, moi, cu }], cf.ma === "dd" ? cf.truong : null);
    if (!r || r.loiChung) return { ok: false, loi: r ? r.loiChung : "không điền được" };
    const o = (r.kq || [])[0];
    return o && o.ok ? { ok: true } : { ok: false, loi: o ? o.loi : "không điền được" };
  }
  // Trả { daDanhDau, khongThay: [idx...] } (khongThay: các vị trí không tìm thấy trên trang)
  function hienViTri(cf) {
    xoaViTri(); xoaDD(); kieuDD(); kieuRS();
    cfgRS = cf;
    const khongThay = [];
    const goc = modalMo() || document;
    for (const f of cf.form || []) {
      const h = q(`[formcontrolname="${f.k}"]`, goc);
      if (!h || !hien(h)) { khongThay.push(...f.idx); continue; }
      h.classList.add("__dhs_rs");
      const cu = docGT(h);
      const hop = hopRS(cf, f.nhan, cu, f.moi, f.lyDo, !!f.coThay, f.idx, () => thayO(cf, f.k, f.moi, cu));
      const vo = h.closest(".vts-form-item-control-input, .vts-form-item-control, .vts-col, .col, div") || h.parentElement;
      vo.after(hop);
      conRS++;
    }
    const bg = cf.bang;
    if (bg && window.__dhsTimTr && !modalMo()) {
      for (const r of bg.rows || []) {
        const tr = window.__dhsTimTr(bg.buoc, r.x);
        if (!tr) { khongThay.push(...r.idx); continue; }
        tr.classList.add("__dhs_rs_dong");
        const hop = hopRS(cf, r.nhan, null, "", r.lyDo, false, r.idx, null);
        (tr.children[1] || tr.firstElementChild).append(hop);
        conRS++;
      }
    } else if (bg) for (const r of bg.rows || []) khongThay.push(...r.idx);
    const bar = document.createElement("div");
    bar.className = "__dhs_rsbar";
    const sp = document.createElement("span"), xong = document.createElement("button");
    xong.textContent = "Xong mục này ▶"; xong.onclick = () => L.gui({ type: "dhs-rs-het", ma: cf.ma, ep: true });
    bar.append(sp, xong); document.body.appendChild(bar); capNhatBar();
    const dau = q(".__dhs_rs, .__dhs_rs_dong");
    if (dau && dau.scrollIntoView) dau.scrollIntoView({ block: "center" });
    return { daDanhDau: conRS, khongThay };
  }

  // Chờ danh mục của một ô chọn (VD 07) Xã/Phường) tải đủ dữ liệu xổ xuống. Trả { ok, n } hoặc { ok:false, loi }
  // Giữ dropdown mở, chờ bằng MutationObserver, thấy option là xong (không đóng giữa chừng để huỷ tải).
  // canTren: danh sách tên xã cần điền → chỉ cần 1 mục khớp là đủ, khỏi chờ toàn bộ danh mục.
  async function choDanhMuc(key, toiDa = 15000, canTren = null) {
    const t0 = Date.now();
    const con = (canTren || []).map(chuan).filter(Boolean);
    const conMot = (ds) => !con.length || ds.some((o) => { const t = chuan(o.innerText); return !!t && con.some((c) => t.includes(c) || c.includes(t)); });
    const layDs = () => { const ps = qa(".cdk-overlay-pane").filter((p) => p.querySelector("vts-option-item")); return ps.length ? qa("vts-option-item", ps[ps.length - 1]) : []; };
    let loiCuoi = "ô chưa hiển thị trên trang";
    while (Date.now() - t0 < toiDa) {
      if (ctl.stopped) return { ok: false, loi: "Đã dừng." };
      const h = q(`vts-select[formcontrolname="${key}"]`);
      if (!h) loiCuoi = `không thấy ô ${key} trên trang`;
      else if (h.className.includes("vts-select-disabled")) loiCuoi = `ô ${key} đang bị khóa (chưa chọn Tỉnh hoặc chưa mở chế độ sửa)`;
      else {
        const conTren = () => { const ds = layDs(); return ds.length && conMot(ds) ? { n: ds.length } : null; };
        const san = layDs();
        if (san.length && conMot(san)) return { ok: true, n: san.length };
        h.scrollIntoView({ block: "center" });
        if (q("vts-select.vts-select-open")) await L.dongPopup();
        click(q("vts-select-top-control", h));
        // Giữ dropdown mở: vừa có option là trả về ngay, không đóng để huỷ request đang tải
        let ok = await L.doiDoiO(conTren, 3000);
        if (!ok && layDs().length) ok = { n: layDs().length }; // danh mục đã có, chỉ chưa thấy đúng tên cần tìm
        if (!ok) {
          // Danh sách tải theo từ khóa: gõ thử một ký tự để biết nguồn dữ liệu đã sẵn sàng
          const tim = q("input.vts-select-selection-search-input", h);
          const choBatKy = () => { const ds = layDs(); return ds.length ? { n: ds.length } : null; };
          if (tim) L.datGiaTri(tim, "a");
          ok = await L.doiDoiO(choBatKy, Math.max(1500, toiDa - (Date.now() - t0)));
          if (tim && !ok) L.datGiaTri(tim, "");
        }
        const ds = layDs();
        if (ok || ds.length) { await L.dongPopup(); L.dmGhi(key, ds.map((x) => x.innerText)); return { ok: true, n: (ok && ok.n) || ds.length }; }
        loiCuoi = "danh sách Xã/Phường chưa có dữ liệu";
        await L.dongPopup();
      }
      await sleep(300);
    }
    return { ok: false, loi: `Quá ${Math.round(toiDa / 1000)} giây: ${loiCuoi}.` };
  }

  // ---------- Đóng hồ sơ (bước xác nhận cuối do người dùng bấm trên bảng bên) ----------
  async function dongHoSo() {
    danhDau(null);
    const b = nutHien(/^đóng hồ sơ$/);
    if (!b) return { ok: false, loi: 'Không thấy nút "Đóng hồ sơ" trên trang.' };
    b.click();
    const xn = await cho(() => { const md = modalMo(); return md && nutHien(/^(đồng ý|xác nhận|có|thoát|ok)$/, md); }, 1500);
    if (xn) xn.click();
    await sleep(800);
    return { ok: true };
  }

  const trangThaiTrang = () => ({
    url: location.pathname,
    taoMoi: /\/create/.test(location.pathname),
    coDanhSachMuc: cacMuc().length > 0,
    dangSua: !!nutHien(/^lưu/) && !nutHien(/^chỉnh sửa thông tin$/),
    hopThoai: !!modalMo(),
  });

  window.__dhsAutoLib = { moMuc, moSua, huySua, luuVaCho, choNguoiLuu, danhDau, hienViTri, xoaViTri, choDanhMuc, hoiNghi, hoiXacNhan, dongHoSo, trangThaiTrang, MUC };
})();
