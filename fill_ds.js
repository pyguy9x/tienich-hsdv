// Các bước dạng DANH SÁCH: 2 – Quá trình công tác, 8 – Quan hệ gia đình. Tiêm sau fields.js và fill.js.
// Nguyên tắc: dòng ĐÃ CÓ trên trang chỉ được điền ô còn trống, không đổi ô đã có dữ liệu
// (riêng "Là đảng viên" của người thân: file ghi Có thì chọn Có). Dòng CHƯA CÓ: bấm "Thêm mới" rồi điền.
// Mỗi dòng: điền xong thì DỪNG, chờ người dùng tự bấm "Lưu thông tin" (hoặc "Đóng" để bỏ qua) rồi mới sang dòng kế tiếp.
(() => {
  if (window.__dhsDSVer === 3) return;
  window.__dhsDSVer = 3;
  const L = window.__dhsLib;
  const { sleep, chuan, q, qa, click, cho, dienSelect, dienText, diemDung, ctl, gui, laCo } = L;

  const DONG_NGHIA_QH = {
    "em gái": "Em ruột", "em trai": "Em ruột", "em": "Em ruột",
    "anh trai": "Anh ruột", "anh": "Anh ruột", "chị gái": "Chị ruột", "chị": "Chị ruột",
    "bố": "Bố đẻ", "cha": "Bố đẻ", "cha đẻ": "Bố đẻ", "mẹ": "Mẹ đẻ",
    "con trai": "Con đẻ", "con gái": "Con đẻ", "con": "Con đẻ",
    "cha vợ": "Bố vợ", "cha chồng": "Bố chồng",
  };
  // So tên lỏng: bỏ ký tự ẩn + so không phân biệt dấu (Thu = Thụ), chỉ dùng kèm quan hệ + năm sinh để khỏi nhầm người
  const boDau = (s) => {
    const t = chuan(s).normalize("NFD").split("");
    let r = "";
    for (let i = 0; i < t.length; i++) {
      const n = t[i].charCodeAt(0);
      if (n >= 768 && n <= 879) continue;
      if (n === 8203 || n === 8204 || n === 8205 || n === 65279) continue;
      r += (t[i] === "đ" || t[i] === "Đ") ? "d" : t[i];
    }
    return r;
  };
  const giongLo = (a, b) => boDau(a) === boDau(b);
  // "4/2003" -> "04/2003"
  const thangChuan = (v) => { const m = String(v).trim().match(/^(\d{1,2})[\/.\-](\d{4})$/); return m ? `${m[1].padStart(2, "0")}/${m[2]}` : String(v).trim(); };

  const CAU_HINH = {
    qh: {
      ten: "Quan hệ gia đình",
      formKey: "familyMemberId",
      bang: ["quan hệ", "họ và tên"],
      truong: [
        ["type", "Phân loại", "select"], ["familyMemberId", "Quan hệ", "select"], ["isPartyMember", "Là đảng viên", "select"],
        ["fullName", "Họ và tên", "text"], ["identifyNo", "Số căn cước", "text"], ["birthDate", "Năm sinh", "year"],
        ["currentStatus", "Tình trạng (đã qua đời/ly hôn)", "select"], ["finishedYear", "Đã qua đời/ly hôn năm", "year"],
        ["currentJob", "Công việc", "text"], ["nationalityId", "Quốc tịch", "select"], ["nationId", "Nơi ở hiện nay", "select"],
        ["residentPlace", "Chi tiết nơi ở", "text"], ["hometown", "Quê quán", "text"], ["note", "Ghi chú", "text"],
      ],
      macDinh: { type: "Bản thân", isPartyMember: "Không", nationalityId: "Việt Nam", nationId: "Việt Nam" },
      chuanHoa: (x) => ({ ...x, familyMemberId: x.familyMemberId ? DONG_NGHIA_QH[chuan(x.familyMemberId)] || x.familyMemberId : x.familyMemberId }),
      nhan: (x) => `${x.familyMemberId || "?"}: ${x.fullName}`,
      dong: (o) => ({ ten: o["họ và tên"], quanHe: o["quan hệ"], namSinh: String(o["năm sinh"] || "").replace(/[^0-9]/g, "") }),
      // v0.8.9.8: luôn ưu tiên SỬA (Cập nhật) dòng đã có; chỉ THÊM MỚI khi Họ tên + năm sinh trên trang đều không có trong đám mây.
      // Không sửa chỉ vì trùng tên (tránh nhầm người trùng tên khác năm sinh).
      khop: (r, x) => {
        if (chuan(r.ten) !== chuan(x.fullName)) return false;
        const nsX = String(x.birthDate == null ? "" : x.birthDate).replace(/[^0-9]/g, "");
        if (nsX && r.namSinh && r.namSinh !== nsX) return false;
        if (nsX && r.namSinh) return !x.familyMemberId || chuan(r.quanHe) === chuan(x.familyMemberId);
        return !!x.familyMemberId && chuan(r.quanHe) === chuan(x.familyMemberId);
      },
      khop2: (r, x) => {
        if (chuan(r.ten) !== chuan(x.fullName)) return false;
        const nsX = String(x.birthDate == null ? "" : x.birthDate).replace(/[^0-9]/g, "");
        if (nsX && r.namSinh) return false; // đã xét ở khop
        return !!x.familyMemberId && chuan(r.quanHe) === chuan(x.familyMemberId);
      },
      khop3: (r, x) => {
        const ns = String(x.birthDate == null ? "" : x.birthDate).replace(/[^0-9]/g, "");
        return !!ns && r.namSinh === ns && chuan(r.quanHe) === chuan(x.familyMemberId || "") && giongLo(r.ten, x.fullName);
      },
    },
    qtct: {
      ten: "Quá trình công tác",
      formKey: "companyName",
      bang: ["thời gian", "tên tổ chức"],
      truong: [
        ["nationId", "Quốc gia", "select"], ["fromDate", "Từ tháng/năm", "thang"], ["toDate", "Đến tháng/năm", "thang"],
        ["companyName", "Tên tổ chức", "text"], ["partyPositionIds", "Chức vụ đảng", "multi"],
        ["concurrentPartyPosition", "Chức vụ Đảng kiêm nhiệm", "text"], ["companyPosition", "Chức danh, chức vụ, nghề nghiệp", "text"],
        ["note", "Ghi chú", "text"],
      ],
      macDinh: { nationId: "Việt Nam" },
      chuanHoa: (x) => ({ ...x, fromDate: x.fromDate ? thangChuan(x.fromDate) : x.fromDate, toDate: x.toDate ? thangChuan(x.toDate) : x.toDate }),
      nhan: (x) => `${x.fromDate || "?"}${x.toDate ? " – " + x.toDate : ""}: ${x.companyName || x.companyPosition || ""}`,
      dong: (o) => ({ thoiGian: o["thời gian"], toChuc: o["tên tổ chức"] }),
      khop3: (r, x) => !!x.fromDate && chuan(r.thoiGian).indexOf(chuan(x.fromDate)) === 0 && giongLo(r.toChuc, x.companyName || ""),
      khop: (r, x) => !!x.fromDate && chuan(r.thoiGian).startsWith(chuan(x.fromDate)) && chuan(r.toChuc) === chuan(x.companyName),
      khop2: (r, x) => !!x.fromDate && !!x.toDate && chuan(r.thoiGian).replace(/\s/g, "") === chuan(`${x.fromDate}-${x.toDate}`),
    },
  };
  // Các mục bổ sung khai báo trong fields.js (DS_THEM): B3, B4, B5 (3 tab), B7, B10
  for (const [b, c] of Object.entries(window.DS_THEM || {})) {
    const thang = c.truong.filter((t) => t[2] === "thang").map((t) => t[0]);
    CAU_HINH[b] = {
      ten: c.ten, formKey: c.formKey, bang: c.bang, tab: c.tab,
      truong: c.truong.map(([k, n, kieu]) => [k, n, kieu]),
      macDinh: {},
      chuanHoa: (x) => { const y = { ...x }; thang.forEach((k) => { if (y[k]) y[k] = thangChuan(y[k]); }); return y; },
      nhan: c.nhan,
      dong: (o) => o,
      khop: (r, x) => c.khop.every(([cot, k, cach]) => { const a = chuan(r[cot]), v = chuan(x[k]); return !!v && (cach === "dau" ? a.startsWith(v) : a === v); }),
      khop2: () => false,
    };
  }
  window.CAU_HINH_DS = Object.fromEntries(Object.entries(CAU_HINH).map(([k, v]) => [k, { ten: v.ten, truong: v.truong, bang: v.bang, tab: v.tab, formKey: v.formKey }]));

  const nut = (re) => qa("button").find((b) => re.test(chuan(b.innerText)));

  function docO(key, kieu) {
    const h = q(`[formcontrolname="${key}"]`);
    if (!h) return null;
    if (kieu === "year" || kieu === "pk") return q("input", h)?.value || "";
    if (kieu === "multi") return qa("vts-select-item, .vts-select-selection-item", h).map((x) => x.innerText.trim()).filter((t) => t && !/^\+\s*\d/.test(t)).join("; ");
    if (h.tagName === "VTS-SELECT") { const t = q("vts-select-top-control", h).innerText.trim(); return t.startsWith("--") ? "" : t; }
    return h.value || "";
  }
  const biKhoa = (key) => { const h = q(`[formcontrolname="${key}"]`); return !h || h.disabled || h.className.includes("disabled") || !!q("input:disabled", h); };

  async function dienNam(key, val) {
    if (!/^\d{4}$/.test(val)) throw new Error(`năm "${val}" phải có dạng yyyy, VD 1958`);
    const h = q(`vts-date-picker[formcontrolname="${key}"]`);
    if (!(await cho(() => !h.className.includes("disabled") && !q("input:disabled", h), 4000))) throw new Error("ô đang bị khóa trên trang");
    const inp = q("input", h);
    h.scrollIntoView({ block: "center" });
    click(inp); inp.focus();
    await sleep(300);
    L.datGiaTri(inp, val);
    await sleep(300);
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    await sleep(400);
    inp.dispatchEvent(new Event("blur", { bubbles: true }));
    const khac = q('[formcontrolname="fullName"], [formcontrolname="companyName"]');
    if (khac) click(khac); // bấm ra ngoài để đóng bảng chọn năm (không dùng Esc vì Esc xóa giá trị vừa gõ)
    await sleep(400);
    if (inp.value !== val) throw new Error(`trang không nhận năm "${val}"`);
  }
  async function dienThang(key, val) {
    if (!/^(\d{2}\/)?\d{4}$/.test(val)) throw new Error(`"${val}" phải có dạng mm/yyyy hoặc yyyy, VD 04/2003`);
    await dienText(key, val);
    const ok = await cho(() => q(`[formcontrolname="${key}"]`).value === val, 1500);
    if (!ok) throw new Error(`trang không nhận "${val}" (đang hiện "${q(`[formcontrolname="${key}"]`).value}")`);
  }
  // Ô chọn nhiều (Chức vụ đảng): các giá trị cách nhau bằng dấu ";"
  async function dienNhieu(key, val) {
    const h = q(`vts-select[formcontrolname="${key}"]`);
    const ds = val.split(";").map((x) => x.trim()).filter(Boolean);
    const thieu = [];
    h.scrollIntoView({ block: "center" });
    for (const v of ds) {
      if (!h.className.includes("vts-select-open")) { click(q("vts-select-top-control", h)); await sleep(700); }
      const pane = qa(".cdk-overlay-pane").filter((p) => p.querySelector("vts-option-item")).pop();
      if (!pane) { thieu.push(v); continue; }
      let o = qa("vts-option-item", pane).find((x) => chuan(x.innerText) === chuan(v));
      const vp = q("cdk-virtual-scroll-viewport", pane);
      if (!o && vp) {
        for (let y = 0; y <= vp.scrollHeight && !o; y += Math.max(100, vp.clientHeight * 0.8)) {
          vp.scrollTop = y; vp.dispatchEvent(new Event("scroll")); await sleep(80);
          o = qa("vts-option-item", pane).find((x) => chuan(x.innerText) === chuan(v));
        }
      }
      if (!o) { thieu.push(v); continue; }
      if (!o.className.includes("selected")) { o.click(); await sleep(300); }
    }
    const inp = q("input", h);
    if (inp) inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true }));
    await sleep(300);
    if (thieu.length) throw new Error(`không tìm thấy lựa chọn: ${thieu.join("; ")}`);
  }
  const HAM = { select: dienSelect, text: dienText, year: dienNam, thang: dienThang, multi: dienNhieu, pk: L.dienPk };
  // Mục có nhiều tab (Khen thưởng / Đánh giá / Kỷ luật): chuyển đúng tab trước khi đọc bảng hoặc Thêm mới
  async function chonTab(ch) {
    if (!ch.tab) return true;
    const t = qa(".vts-tabs-tab-btn").find((e) => e.offsetParent && chuan(e.innerText) === chuan(ch.tab));
    if (!t) return false;
    const vo = t.closest(".vts-tabs-tab");
    if (vo && vo.className.includes("vts-tabs-tab-active")) return true;
    click(t); await sleep(1500);
    return true;
  }

  function docBang(ch) {
    const thay = (x) => ch.bang.every((b) => qa("thead th", x).some((th) => chuan(th.innerText) === b));
    const tables = qa("table");
    const t = tables.find((x) => x.offsetParent !== null && thay(x));
    if (!t && tables.some((x) => thay(x))) return { rows: [], coBang: false, anBang: true };
    if (!t) {
      // Bảng tách header/body (header ở bảng riêng, body ở bảng riêng, không có thead):
      // lấy tiêu đề từ bảng header, đọc dòng từ bảng body.
      const vis = tables.filter((x) => x.isConnected && x.offsetParent !== null);
      const headsOf = (tb) => { const r = qa("tr", tb)[0]; return r ? [...r.children].map((c) => chuan(c.innerText || c.textContent)) : []; };
      const tH = vis.find((x) => ch.bang.every((b) => headsOf(x).some((h) => h === b)));
      if (tH) {
        const th = headsOf(tH);
        const tB = vis.find((x) => x !== tH && qa("tr", x).some((tr) => tr.children.length > 3 && !ch.bang.every((b) => [...tr.children].some((c) => chuan(c.innerText || c.textContent) === b)))) || tH;
        const rows = qa("tr", tB).filter((tr) => tr.children.length > 3 && !ch.bang.every((b) => [...tr.children].some((c) => chuan(c.innerText || c.textContent) === b))).map((tr) => {
          const o = {};
          th.forEach((h, i) => { o[h] = tr.children[i]?.innerText.trim() || ""; });
          return { tr, ...ch.dong(o) };
        });
        const trangSau = qa("vts-pagination li, .vts-pagination li").some((li) => /next/.test(li.className) && !/disabled/.test(li.className));
        return { rows, coBang: true, trangSau };
      }
      return { rows: [], coBang: false };
    }
    const th = qa("thead th", t).map((x) => chuan(x.innerText));
    const rows = qa("tbody tr", t).filter((tr) => tr.children.length > 3).map((tr) => {
      const o = {};
      th.forEach((h, i) => { o[h] = tr.children[i]?.innerText.trim() || ""; });
      return { tr, ...ch.dong(o) };
    });
    const trangSau = qa("vts-pagination li, .vts-pagination li").some((li) => /next/.test(li.className) && !/disabled/.test(li.className));
    return { rows, coBang: true, trangSau };
  }
  // Bảng trên trang tải chậm: đã thấy bảng nhưng chưa có dòng nào trong khi file có dữ liệu → chờ thêm cho chắc (tránh nhận nhầm "chưa có" rồi Thêm mới trùng)
  async function choBangCoDong(ch, coBaoNhieu) {
    const t0 = Date.now();
    let bang = docBang(ch);
    while (bang.coBang && !bang.rows.length && coBaoNhieu && Date.now() - t0 < 3000) {
      if (ctl.stopped) break;
      await sleep(500);
      bang = docBang(ch);
    }
    return bang;
  }
  const timDong = (ch, bang, x) => bang.rows.find((r) => ch.khop(r, x)) || bang.rows.find((r) => ch.khop2(r, x)) || (ch.khop3 ? bang.rows.find((r) => ch.khop3(r, x)) : null);
  // Dùng cho tô đỏ dòng nghi ngờ trên bảng (auto.js)
  window.__dhsTimTr = (buoc, x) => { const ch = CAU_HINH[buoc]; if (!ch) return null; const r = timDong(ch, docBang(ch), ch.chuanHoa(x)); return r ? r.tr : null; };
  window.__dhsChonTab = (buoc) => chonTab(CAU_HINH[buoc] || {});
  // v0.8.9.9 B8: popup tất cả thành viên – chọn 40/trang rồi gom hết các trang (không bỏ sót)
  async function qhChon40() {
    const pag = q("vts-pagination, .vts-pagination");
    const vung = (pag && pag.parentElement) || document;
    for (const s of qa("vts-select", vung)) {
      const top = q("vts-select-top-control", s);
      if (top && !/trang|\/ *tr|10|20|40|50|100/.test(chuan(top.innerText))) continue;
      click(top || s);
      await sleep(700);
      const pane = qa(".cdk-overlay-pane").filter((p) => p.querySelector("vts-option-item")).pop();
      if (!pane) continue;
      const o40 = qa("vts-option-item", pane).find((x) => /^40(\D|$)/.test(x.innerText.trim()));
      if (o40) { o40.click(); await sleep(1800); return true; }
      if (top) { click(top); await sleep(300); }
    }
    return false;
  }
  function qhNutNext() {
    const pag = q("vts-pagination, .vts-pagination");
    if (!pag) return null;
    return qa("li", pag).find((li) => /next/.test(li.className) && !/disabled/.test(li.className)) || null;
  }
  // Đọc dự phòng: trang dùng 2 bảng riêng (1 bảng header + 1 bảng body, không có thead).
  // Lấy vị trí cột từ bảng header, đọc dòng từ MỌI bảng đang hiện.
  function qhDocFallback() {
    const ra = [];
    let iTen = -1, iQh = -1, iNs = -1;
    for (const t of qa("table")) {
      if (iTen >= 0 || !t.isConnected || !t.getClientRects().length) continue;
      const first = qa("tr", t)[0];
      if (!first) continue;
      const heads = [...first.children].map((c) => chuan(c.innerText || c.textContent));
      const it = heads.findIndex((h) => h.includes("họ và tên"));
      if (it < 0) continue;
      iTen = it;
      iQh = heads.findIndex((h) => h === "quan hệ");
      if (iQh < 0) iQh = heads.findIndex((h) => h.includes("quan hệ"));
      iNs = heads.findIndex((h) => h.includes("năm sinh"));
    }
    if (iTen < 0) return ra;
    for (const t of qa("table")) {
      if (!t.isConnected || !t.getClientRects().length) continue;
      for (const tr of qa("tr", t)) {
        const tds = [...tr.children].map((c) => (c.innerText || "").trim());
        if (tds.length < 4 || tds.some((c) => chuan(c).includes("họ và tên"))) continue;
        const ten = (tds[iTen] || "").trim();
        if (!ten) continue;
        const ns = iNs >= 0 ? ((tds[iNs] || "").match(/\d{4}/) || [""])[0] : "";
        ra.push({ ten, quanHe: iQh >= 0 ? (tds[iQh] || "").trim() : "", namSinh: ns, tr });
      }
    }
    return ra;
  }
  window.__dhsQHDocHet = async () => {
    const ch = CAU_HINH.qh;
    if (q(`[formcontrolname="${ch.formKey}"]`)) return { loi: "Đang mở biểu mẫu. Bấm Đóng hoặc Lưu trên trang trước." };
    // Luôn chọn 40/trang TRƯỚC rồi mới đọc (không bỏ sót)
    let chon40 = false;
    try { chon40 = await qhChon40(); } catch (e) {}
    let bang = docBang(ch);
    if (bang.coBang && !bang.rows.length) bang = await choBangCoDong(ch, 1);
    if (!bang.coBang) {
      const tables = qa("table").filter((x) => x.offsetParent !== null);
      return { loi: `Chưa thấy bảng Quan hệ gia đình (tìm thấy ${tables.length} bảng khác trên trang). Hãy mở đúng mục Quan hệ gia đình, đợi bảng hiện rồi bấm lại.`, dbg: tables.slice(0, 3).map((t) => qa("thead th", t).map((x) => (x.innerText || "").trim()).join(" | ")) };
    }
    const ra = [], thay = new Set();
    const nap = (o) => {
      const k = chuan(o.ten) + "|" + o.namSinh;
      if (o.ten && !thay.has(k)) { thay.add(k); ra.push(o); }
    };
    for (let t = 0; t < 20; t++) {
      try { await diemDung(); } catch (e) { return { loi: "đã dừng" }; }
      const bang = docBang(ch);
      if (!bang.coBang) return { loi: "Chưa thấy bảng Quan hệ gia đình. Mở mục Quan hệ gia đình của hồ sơ." };
      for (const r of bang.rows) nap({ ten: r.ten || "", quanHe: r.quanHe || "", namSinh: r.namSinh || "" });
      if (!bang.rows.length) qhDocFallback().forEach(nap); // bảng không dùng thead/tbody chuẩn
      const nx = qhNutNext();
      if (!nx) break;
      click(nx);
      await sleep(1500);
    }
    // Bảng chuẩn không có dòng (cấu trúc thead/tbody khác) → đọc dự phòng theo vị trí cột
    if (!ra.length) qhDocFallback().forEach(nap);
    if (!ra.length) {
      const tables = qa("table").filter((x) => x.isConnected && x.getClientRects().length);
      return { loi: `Bảng Quan hệ gia đình chưa có dòng nào (đang hiện ${tables.length} bảng). Đợi bảng hiện đủ rồi bấm lại.`, dbg: tables.slice(0, 3).map((x) => `tr=${qa("tr", x).length} bodytr=${qa("tbody tr", x).length} head=[${qa("thead th", x).map((h) => (h.innerText || "").trim()).join("|")}]`) };
    }
    return { ok: true, chon40, tong: ra.length, ds: ra };
  };
  // Đổi Họ và tên các dòng trùng thành "Đã xóa" ngay trên trang (mở Sửa → gõ → Lưu từng dòng)
  window.__dhsQHDoiTenDaXoa = async (keys) => {
    const ch = CAU_HINH.qh;
    const coForm = () => !!q(`[formcontrolname="${ch.formKey}"]`);
    const kq = [];
    let dung = false;
    for (const kk of keys || []) {
      try {
        await diemDung();
        let tim = null;
        for (let t = 0; t < 20 && !tim; t++) {
          const bang = docBang(ch);
          if (bang.coBang) {
            const r = bang.rows.find((x) => chuan(x.ten) === chuan(kk.ten) && (!kk.namSinh || x.namSinh === kk.namSinh));
            if (r) { tim = r.tr; break; }
          }
          // Bảng tách header/body: tìm trực tiếp theo vị trí cột
          const fb = qhDocFallback().find((x) => chuan(x.ten) === chuan(kk.ten) && (!kk.namSinh || x.namSinh === kk.namSinh));
          if (fb && fb.tr) { tim = fb.tr; break; }
          const nx = qhNutNext();
          if (!nx) break;
          click(nx);
          await sleep(1500);
        }
        if (!tim) { kq.push({ ten: kk.ten, ok: false, loi: "không thấy dòng trên trang" }); continue; }
        const nutSua = qa("button", tim.lastElementChild).find((b) => q(".vtsicon-FilePen\\:custom", b)) || q("button", tim.lastElementChild);
        click(nutSua);
        if (!(await cho(coForm, 8000))) throw new Error("biểu mẫu không mở được");
        await sleep(900);
        const tenMoi = "(X) " + kk.ten;
        await dienText("fullName", tenMoi);
        await sleep(200);
        try { await dienSelect("isPartyMember", "Không"); } catch (e) {}
        await sleep(200);
        const b = nut(/^lưu/);
        if (!b) throw new Error('không thấy nút "Lưu"');
        b.click();
        if (!(await cho(() => !coForm(), 12000))) throw new Error("lưu chưa xong (form vẫn mở) – kiểm tra trên trang");
        await sleep(800);
        kq.push({ ten: kk.ten, ok: true, tenMoi });
      } catch (e) {
        if (e.message === "__STOP__") { dung = true; kq.push({ ten: (kk && kk.ten) || "", ok: false, loi: "đã dừng hẳn" }); break; }
        kq.push({ ten: (kk && kk.ten) || "", ok: false, loi: e.message });
        await dongForm(ch);
      }
    }
    return { kq, dung };
  };

  window.__dhsDSSoSanh = async (buoc, ds) => {
    const ch = CAU_HINH[buoc];
    ds = ds.map(ch.chuanHoa);
    if (q(`[formcontrolname="${ch.formKey}"]`)) return { loiChung: `Đang mở biểu mẫu ${ch.ten}. Bấm Đóng hoặc Lưu trước rồi so sánh lại.` };
    if (ch.tab && !(await chonTab(ch))) return { loiChung: `Không thấy tab "${ch.tab}". Mở mục 5 Khen thưởng, đánh giá, kỷ luật của hồ sơ.` };
    let bang = docBang(ch);
    if (bang.coBang && !bang.rows.length && ds.length) bang = await choBangCoDong(ch, ds.length);
    if (!bang.coBang) return { loiChung: bang.anBang ? `Bảng ${ch.ten} đang bị thu gọn/ẩn trên trang. Hãy mở ra rồi bấm Đối chiếu lại.` : `Chưa thấy bảng ${ch.ten}. Mở mục "${ch.ten}" của hồ sơ.` };
    return { soDong: bang.rows.length, trangSau: bang.trangSau, ds: ds.map((x) => ({ ten: ch.nhan(x), daCo: !!timDong(ch, bang, x) })) };
  };

  // Mở 1 dòng trên bảng để đọc chi tiết (dùng cho trang So sánh): tìm dòng chứa các chuỗi parts,
  // bấm Sửa, đọc toàn bộ ô trong biểu mẫu, rồi Đóng lại. Trả { ok: true, dong } hoặc { loi }.
  window.__dhsMoDong = async (buoc, parts) => {
    const ch = CAU_HINH[buoc];
    if (!ch) return { loi: "Mục chưa hỗ trợ đọc dòng: " + buoc };
    if (q('[formcontrolname="' + ch.formKey + '"]')) return { loi: "Đang mở một biểu mẫu khác. Bấm Đóng hoặc Lưu trên trang trước." };
    let bang = docBang(ch);
    if (bang.coBang && !bang.rows.length) bang = await choBangCoDong(ch, 1);
    if (!bang.coBang) return { loi: "Chưa thấy bảng " + ch.ten + ". Hãy mở đúng mục trên trang." };
    const ps = (parts || []).map((p) => chuan(p)).filter(Boolean);
    if (!ps.length) return { loi: "Dòng trên mây đang trống, không có gì để đối chiếu." };
    const r = bang.rows.find((x) => ps.every((p) => chuan(x.tr.innerText).indexOf(p) >= 0));
    if (!r) return { loi: "Không thấy dòng tương ứng trên trang (trang chỉ hiện 10 dòng đầu)." };
    const btns = qa("button", r.tr.lastElementChild);
    if (!btns.length) return { loi: "Không thấy nút Sửa trên dòng." };
    click(btns[0]);
    const mo = await cho(() => q('[formcontrolname="' + ch.formKey + '"]'), 8000);
    if (!mo) return { loi: "Không mở được biểu mẫu của dòng (nếu lỡ bấm nút Xóa, hãy bấm Đóng hộp thoại trên trang)." };
    await sleep(700);
    const out = {};
    qa("[formcontrolname]").forEach((h) => {
      const k = h.getAttribute("formcontrolname");
      if (!k || out[k] !== undefined) return;
      const tag = h.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") out[k] = h.value || "";
      else if (tag === "VTS-SELECT" || h.querySelector("vts-select-top-control")) {
        const t = h.querySelector("vts-select-top-control");
        const v = t ? t.innerText.trim() : h.innerText.trim();
        out[k] = v.slice(0, 2) === "--" ? "" : v;
      } else if (h.querySelector("input[type=checkbox]")) out[k] = h.querySelector("input[type=checkbox]").checked ? "Có" : "";
      else {
        const lab = h.querySelector("label.vts-radio-wrapper-checked");
        out[k] = lab ? lab.innerText.trim() : h.innerText.trim();
      }
    });
    await dongForm(ch);
    return { ok: true, dong: out };
  };

  // Chờ người dùng bấm Lưu/Đóng trên trang: choMs > 0 thì quá hạn tự bấm Lưu hộ,
  // đợi quá 10 giây (form vẫn mở) thì bấm Lưu lại, lỗi đứng yên quá 15 giây thì dừng và báo.
  function choNguoiDung(ch, choMs) {
    return new Promise((xong) => {
      let ketQua = null, loiDau = "", loiTu = 0;
      const bamLuu = () => { const b = nut(/^lưu/); if (b) { b.click(); return true; } return false; };
      const hc = choMs ? setTimeout(() => {
        if (ketQua) return;
        if (bamLuu()) ketQua = "luu";
      }, choMs) : null;
      const retry = choMs ? setTimeout(() => {
        if (ketQua === "luu" && coForm()) bamLuu();
      }, 10000) : null;
      const coForm = () => !!q(`[formcontrolname="${ch.formKey}"]`);
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
        if (!coForm()) fin(ketQua === "luu" ? "luu" : ketQua || "dong");
        else {
          const loi = [...new Set(qa(".form-control-error-general").map((x) => x.innerText.trim()).filter(Boolean))].slice(0, 4);
          const sig = loi.join("; ");
          if (choMs && sig) {
            if (sig !== loiDau) { loiDau = sig; loiTu = Date.now(); }
            else if (Date.now() - loiTu > 15000) { fin("loiLuu:" + sig); return; }
          } else { loiDau = ""; loiTu = 0; }
          if (ketQua === "luu" && loi.length) { ketQua = null; gui({ type: "dhs-ds-loi", loi }); }
        }
      }, 400);
      function fin(v) { clearInterval(tick); if (hc) clearTimeout(hc); if (retry) clearTimeout(retry); document.removeEventListener("click", nghe, true); xong(v); }
    });
  }
  async function dongForm(ch) {
    if (!q(`[formcontrolname="${ch.formKey}"]`)) return;
    const d = nut(/^đóng$/);
    if (d) d.click();
    const thoat = await cho(() => nut(/^thoát$/), 2000);
    if (thoat) thoat.click();
    await cho(() => !q(`[formcontrolname="${ch.formKey}"]`), 3000);
  }

  // opt (chế độ tự động): { tuLuu: tự bấm "Lưu thông tin", ghiDe: thay ô đã có dữ liệu khác, nghi: [{mã: lý do}] theo từng dòng }
  async function dienDSCore(buoc, ds, opt = {}) {
    const ch = CAU_HINH[buoc];
    const coForm = () => !!q(`[formcontrolname="${ch.formKey}"]`);
    const A = () => window.__dhsAutoLib;
    const tong = [];
    for (let i = 0; i < ds.length; i++) {
      const x = ds[i];
      const kq = { buoc, i, ten: ch.nhan(x), o: [], ketQua: "" };
      try {
        await diemDung();
        await chonTab(ch);
        let bang = docBang(ch);
        if (bang.coBang && !bang.rows.length && ds.length) bang = await choBangCoDong(ch, ds.length);
        const dong = timDong(ch, bang, x);
        kq.loai = dong ? "sua" : "them";
        // Chế độ chỉ cập nhật: dòng chưa có trên trang thì bỏ qua, KHÔNG bấm "Thêm mới"
        if (!dong && opt.chiSua) { kq.ketQua = "boQua"; kq.loi = "chưa có trên trang – bỏ qua (chế độ chỉ SỬA)"; tong.push(kq); continue; }
        // Chế độ chỉ thêm mới: dòng đã có trên trang thì bỏ qua, không sửa
        if (dong && opt.chiThem) { kq.ketQua = "boQua"; kq.loi = "đã có trên trang – bỏ qua (chế độ chỉ THÊM MỚI)"; tong.push(kq); continue; }
        L.veBang(`${ch.ten} ${i + 1}/${ds.length}: ${kq.ten} – đang mở biểu mẫu`, [], false);
        if (dong) {
          const nutSua = qa("button", dong.tr.lastElementChild).find((b) => q(".vtsicon-FilePen\\:custom", b)) || q("button", dong.tr.lastElementChild);
          click(nutSua);
        } else {
          const b = nut(/^thêm mới$/);
          if (!b) throw new Error('không thấy nút "Thêm mới"');
          b.click();
        }
        if (!(await cho(coForm, 8000))) throw new Error("biểu mẫu không mở được");
        await sleep(900);
        const nghiDong = (opt.nghi && opt.nghi[i]) || {};
        if (opt.tuLuu && A()) A().danhDau({ form: nghiDong });
        const thuLai = new Set();
        for (const [key, nhan, kieu] of ch.truong) {
          let moi = String(x[key] ?? "").trim();
          if (!moi) continue;
          await diemDung();
          gui({ type: "dhs-progress", n: i + 1, tong: ds.length, nhan: `${kq.ten}: ${nhan}`, paused: ctl.paused });
          const cu = docO(key, kieu);
          const laDV = buoc === "qh" && key === "isPartyMember";
          const trung = chuan(cu) === chuan(moi) || (laDV && laCo(moi) === (chuan(cu) === "có"));
          const ghiNghi = nghiDong[key] ? { nghi: nghiDong[key] } : {};
          const laMD = !!(opt.macDinh && opt.macDinh[i] && opt.macDinh[i][key]);
          if (laMD && chuan(cu)) { kq.o.push({ key, nhan, ok: true, hien: cu, tt: "trung" }); continue; }
          if (trung) { kq.o.push({ key, nhan, ok: true, hien: cu, tt: "trung", ...ghiNghi }); continue; }
          const trong = !chuan(cu) || (!dong && ch.macDinh[key] && chuan(cu) === chuan(ch.macDinh[key]));
          if (opt.hoiXN && nghiDong[key] && A() && A().hoiXacNhan) {
            const k2 = await A().hoiXacNhan({ key, nhan, cu, moi, lyDo: nghiDong[key] });
            if (k2.qd !== "thay") { kq.o.push({ key, nhan, ok: true, hien: cu, cu, moi, tt: "giu", ...ghiNghi }); continue; }
            moi = k2.v; ghiNghi.xacNhan = true;
            if (chuan(cu) === chuan(moi)) { kq.o.push({ key, nhan, ok: true, hien: cu, tt: "trung", xacNhan: true, ...ghiNghi }); continue; }
          }
          if (!trong && !laDV && !opt.ghiDe) { kq.o.push({ key, nhan, ok: false, tt: "khac", loi: `đã có "${cu}" – giữ nguyên (file: "${moi}")` }); continue; }
          if (!trong && !laDV && nghiDong[key] && opt.hoiNghi && A() && A().hoiNghi) {
            const qd = await A().hoiNghi({ key, nhan, cu, moi, lyDo: nghiDong[key] });
            if (qd !== "thay") { kq.o.push({ key, nhan, ok: true, hien: cu, cu, moi, tt: "giu", ...ghiNghi }); continue; }
          }
          if (biKhoa(key) && kieu !== "year") { kq.o.push({ key, nhan, ok: false, loi: "ô đang bị khóa" }); continue; }
          try {
            await HAM[kieu](key, laDV ? (laCo(moi) ? "Có" : "Không") : moi);
            await sleep(150);
            // v0.8.9.8 B8: luôn kiểm tra "Là đảng viên" đã điền hay chưa rồi mới làm tiếp
            if (laDV && opt.tuLuu) {
              const muon = laCo(moi) ? "có" : "không";
              let hien = chuan(docO(key, kieu));
              if (hien !== muon && hien !== (muon === "có" ? "co" : "khong")) {
                await sleep(1000);
                try { await HAM[kieu](key, laCo(moi) ? "Có" : "Không"); await sleep(150); } catch (e2) {}
                hien = chuan(docO(key, kieu));
              }
              if (!hien) throw new Error(`"Là đảng viên" chưa điền được (muốn chọn "${laCo(moi) ? "Có" : "Không"}") – kiểm tra lại trên trang rồi chạy tiếp`);
            }
            kq.o.push({ key, nhan, ok: true, hien: docO(key, kieu), cu, tt: trong ? "dien" : "ghiDe", ...ghiNghi });
          } catch (e) {
            // Menu chưa có lựa chọn nào (danh mục đang tải): chờ thêm rồi thử lại 1 lần, nhất là ô "Quan hệ" ở B8
            if (kieu === "select" && opt.tuLuu && !thuLai.has(key)) {
              thuLai.add(key);
              await sleep(2500);
              try {
                await HAM[kieu](key, laDV ? (laCo(moi) ? "Có" : "Không") : moi);
                await sleep(150);
                kq.o.push({ key, nhan, ok: true, hien: docO(key, kieu), cu, tt: trong ? "dien" : "ghiDe", ...ghiNghi });
                continue;
              } catch (e2) {}
            }
            const MD_DAU = buoc === "qh" && (key === "familyMemberId" || key === "type") ? { familyMemberId: "Bố đẻ", type: "Bản thân" }[key] : "";
            let ok2 = false;
            if (MD_DAU && moi !== MD_DAU && opt.tuLuu) {
              try { await HAM[kieu](key, MD_DAU); await sleep(150); kq.o.push({ key, nhan, ok: true, hien: docO(key, kieu), cu, tt: "dien", macDinh: `không khớp danh mục ("${moi}") – đã chọn mục đầu tiên "${MD_DAU}"`, ...ghiNghi }); ok2 = true; } catch (e2) {}
            }
            // Menu xổ xuống không có lựa chọn khớp dữ liệu: chọn mục đầu tiên của menu (nếu có) và báo lại
            if (!ok2 && kieu === "select" && opt.tuLuu) {
              try {
                await HAM[kieu](key, "__FIRST__");
                await sleep(150);
                const daChon = docO(key, kieu);
                if (chuan(daChon)) { kq.o.push({ key, nhan, ok: true, hien: daChon, cu, tt: "dien", macDinh: `không khớp danh mục ("${moi}") – đã chọn mục đầu tiên "${daChon}"`, ...ghiNghi }); ok2 = true; }
              } catch (e2) {}
            }
            if (!ok2) {
              kq.o.push({ key, nhan, ok: false, loi: e.message + " (menu chưa có lựa chọn – đã tắt tự tải lại trang, ô này bỏ qua)", ...ghiNghi });
            }
          }
        }
        const loi = kq.o.filter((o) => !o.ok);
        const soDoi = kq.o.filter((o) => o.tt === "dien" || o.tt === "ghiDe").length;
        if (opt.tuLuu) {
          if (dong && !soDoi) { await dongForm(ch); kq.ketQua = "trung"; }
          else {
            L.veBang(`${kq.ten}: điền ${soDoi} ô` + (loi.length ? `, ${loi.length} cần xem` : "") + " – đang bấm Lưu thông tin…", loi, false);
            const r = await A().luuVaCho({ formKey: ch.formKey });
            if (r.ok) kq.ketQua = "luu";
            else {
              // Trang báo lỗi: dừng chờ người dùng sửa trên trang rồi tự bấm Lưu (hoặc Đóng để bỏ qua dòng này)
              kq.loiLuu = r.loi;
              if (opt.tuBoQua) { await dongForm(ch); kq.ketQua = "loi"; kq.loi = "không lưu được, đã tự bỏ qua dòng này: " + r.loi; tong.push(kq); continue; }
              gui({ type: "dhs-auto-cho", muc: buoc, ten: kq.ten, loi: r.loi });
              L.veBang(`${kq.ten}: trang báo lỗi khi lưu – SỬA trên trang rồi bấm "Lưu thông tin" (hoặc "Đóng" để bỏ qua dòng này)`, [{ ok: false, nhan: "Lỗi", loi: r.loi }], false);
          const cwDs = await choNguoiDung(ch, opt.choMs);
          if (typeof cwDs === "string" && cwDs.indexOf("loiLuu:") === 0) {
            kq.ketQua = "loi";
            kq.loi = cwDs.slice(7) + " (lỗi quá 15 giây – đã dừng, bạn sửa tay trên trang rồi chạy tiếp)";
            tong.push(kq);
            break;
          }
          kq.ketQua = cwDs;
            }
          }
        } else {
          const tuBam = opt.tuLuuNeuChuan && !loi.length;
          L.veBang(`${kq.ten}: điền ${soDoi} ô` + (loi.length ? `, ${loi.length} cần xem` : "") + (tuBam ? ' – đạt chuẩn, 3 giây nữa tự bấm "Lưu thông tin"' : ' – KIỂM TRA rồi bấm "Lưu thông tin" để sang dòng tiếp theo, hoặc "Đóng" để bỏ qua') + (!tuBam && opt.choMs ? ` (quá ${opt.choMs / 1000} giây không bấm thì tự bấm Lưu hộ; đợi quá 10 giây bấm lại, lỗi quá 15 giây thì dừng)` : ""), loi, false);
          gui({ type: "dhs-ds-cho", buoc, i, tong: ds.length, kq });
          const cwDs2 = await choNguoiDung(ch, tuBam ? 3000 : opt.choMs);
          if (typeof cwDs2 === "string" && cwDs2.indexOf("loiLuu:") === 0) {
            kq.ketQua = "loi";
            kq.loi = cwDs2.slice(7) + " (lỗi quá 15 giây – đã dừng, bạn sửa tay trên trang rồi chạy tiếp)";
            tong.push(kq);
            break;
          }
          kq.ketQua = cwDs2;
        }
        if (kq.ketQua === "dung") { tong.push(kq); break; }
        await sleep(opt.super ? 2000 : 1200);
      } catch (e) {
        if (e.message === "__STOP__") { kq.ketQua = "dung"; tong.push(kq); break; }
        kq.ketQua = "loi"; kq.loi = e.message;
        await dongForm(ch);
      }
      tong.push(kq);
      if (!opt.tuLuu) gui({ type: "dhs-ds-mot", buoc, kq });
    }
    const luu = tong.filter((k) => k.ketQua === "luu").length;
    L.veBang(`${ch.ten}: đã lưu ${luu}/${ds.length} dòng` + (ctl.stopped ? " (đã dừng hẳn)" : ""), tong.filter((k) => k.ketQua !== "luu" && k.ketQua !== "trung").map((k) => ({ ok: false, nhan: k.ten, loi: k.ketQua === "dong" ? "đã bỏ qua (Đóng)" : k.loi || k.ketQua })), true);
    return tong;
  }

  window.__dhsDSDien = (buoc, ds, opt) => {
    const ch = CAU_HINH[buoc];
    ds = ds.map(ch.chuanHoa);
    if (ctl.running) return { loiChung: "Đang chạy một việc khác." };
    if (q(`[formcontrolname="${ch.formKey}"]`)) return { loiChung: `Đang mở biểu mẫu ${ch.ten}. Bấm Đóng hoặc Lưu trước.` };
    ctl.running = true; ctl.paused = false; ctl.stopped = false;
    (async () => {
      const tong = await dienDSCore(buoc, ds, opt || {});
      ctl.running = false;
      gui({ type: "dhs-ds-xong", buoc, tong, dung: ctl.stopped });
    })();
    return { batDau: true };
  };
  // Chế độ tự động: điền + tự Lưu từng dòng, chờ xong rồi trả kết quả
  window.__dhsDSDienCho = async (buoc, ds, opt) => {
    const ch = CAU_HINH[buoc];
    if (!ch) return { loiChung: "Không có cấu hình mục " + buoc };
    if (ctl.running) return { loiChung: "Đang chạy một việc khác." };
    if (q(`[formcontrolname="${ch.formKey}"]`)) return { loiChung: `Đang mở biểu mẫu ${ch.ten}. Bấm Đóng hoặc Lưu trước.` };
    ctl.running = true; ctl.paused = false; ctl.stopped = false;
    try { return { tong: await dienDSCore(buoc, ds.map(ch.chuanHoa), { tuLuu: true, ghiDe: true, ...(opt || {}) }), dung: ctl.stopped }; }
    finally { ctl.running = false; }
  };
})();
