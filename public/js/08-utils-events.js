/* =====================================================
   HTML ESCAPE
===================================================== */
function escapeHtml(text) {
  return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#039;");
}
/* =====================================================
   OVERLAY EVENTS
===================================================== */
const overlay = document.getElementById("overlay");
if (overlay) {
  overlay.addEventListener("click", e => {
    if (e.target.id === "overlay") {
      closeModal();
    }
  });
}
const profileOverlay = document.getElementById("profileOverlay");
if (profileOverlay) {
  profileOverlay.addEventListener("click", e => {
    if (e.target.id === "profileOverlay") {
      closeStudentProfile();
    }
  });
}
/* =====================================================
   INITIAL RENDER
===================================================== */
normalizeAllData();
render();
/* =====================================================
   MONGODB / API
===================================================== */
window.API_MODE = true;
