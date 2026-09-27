/* =====================================================
   LOAD BATCHES FROM SERVER
===================================================== */
async function loadBatchesFromServer() {
  try {
    const response = await fetch("/api/batches");
    if (!response.ok) {
      throw new Error("API error");
    }
    const data = await response.json();
    /*
           MongoDB में data नहीं है
        */
    if (!Array.isArray(data.batches)) {
      normalizeAllData();
      await saveBatchesToServer();
      render();
      return true;
    }
    /*
           MongoDB source of truth
        */
    batches = data.batches;
    inactiveStudents = Array.isArray(data.inactiveStudents) ? data.inactiveStudents : [];
    awayStudents = Array.isArray(data.awayStudents) ? data.awayStudents : [];
    todos = Array.isArray(data.todos) ? data.todos : [];
    normalizeAllData();
    localStorage.setItem("batchManagerData", JSON.stringify(batches));
    localStorage.setItem("inactiveStudentsData", JSON.stringify(inactiveStudents));
    localStorage.setItem("awayStudentsData", JSON.stringify(awayStudents));
    localStorage.setItem("todosData", JSON.stringify(todos));
    render();
    return true;
  } catch (error) {
    console.warn("MongoDB API unavailable; using local browser data.", error);
    normalizeAllData();
    render();
    return false;
  }
}
/* =====================================================
   SAVE BATCHES + INACTIVE + TODOS TO SERVER
===================================================== */
async function saveBatchesToServer() {
  try {
    const response = await fetch("/api/batches", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batches: batches,
        inactiveStudents: inactiveStudents,
        awayStudents: awayStudents,
        todos: todos
      })
    });
    if (!response.ok) {
      throw new Error("Save failed");
    }
    const data = await response.json();
    if (Array.isArray(data.batches)) {
      batches = data.batches;
    }
    if (Array.isArray(data.inactiveStudents)) {
      inactiveStudents = data.inactiveStudents;
    }
    if (Array.isArray(data.awayStudents)) {
      awayStudents = data.awayStudents;
    }
    if (Array.isArray(data.todos)) {
      todos = data.todos;
    }
    localStorage.setItem("batchManagerData", JSON.stringify(batches));
    localStorage.setItem("inactiveStudentsData", JSON.stringify(inactiveStudents));
    localStorage.setItem("awayStudentsData", JSON.stringify(awayStudents));
    localStorage.setItem("todosData", JSON.stringify(todos));
    showSaveStatus(true);
    return true;
  } catch (error) {
    console.warn("Could not save to MongoDB API.", error);
    localStorage.setItem("batchManagerData", JSON.stringify(batches));
    localStorage.setItem("inactiveStudentsData", JSON.stringify(inactiveStudents));
    localStorage.setItem("awayStudentsData", JSON.stringify(awayStudents));
    localStorage.setItem("todosData", JSON.stringify(todos));
    showSaveStatus(false);
    return false;
  }
}
/* =====================================================
   VISIBLE SAVE STATUS — so a failed save is never silent.
   Green = confirmed saved to Server just now (auto-hides).
   Red = Server save failed, stays on screen until the next
   successful save.
===================================================== */
function showSaveStatus(ok) {
  let el = document.getElementById("saveStatusBadge");
  if (!el) {
    el = document.createElement("div");
    el.id = "saveStatusBadge";
    el.style.cssText = "position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:9999;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.2);color:#fff;";
    document.body.appendChild(el);
  }
  if (ok) {
    el.style.background = "#2e7d32";
    el.textContent = "✅ Server पर Save हो गया (" + new Date().toLocaleTimeString("hi-IN") + ")";
    el.style.display = "block";
    clearTimeout(window._saveStatusTimer);
    window._saveStatusTimer = setTimeout(() => {
      el.style.display = "none";
    }, 3000);
  } else {
    el.style.background = "#c62828";
    el.textContent = "❌ Server पर Save नहीं हो सका — Internet चेक करें";
    el.style.display = "block";
  }
}
/* =====================================================
   LOAD ON PAGE OPEN
===================================================== */
window.addEventListener("load", async () => {
  await loadBatchesFromServer();
});