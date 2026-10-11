// Bấm biểu tượng tiện ích -> mở bảng bên (side panel). Bảng bên không tự đóng khi chọn file Excel
// hoặc khi bấm vào trang, nên quá trình điền 1–2 phút không bị ngắt.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
