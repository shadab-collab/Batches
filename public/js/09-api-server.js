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
    todos = Array.isArray(data.todos) ? data.todos : [];
    normalizeAllData();
    localStorage.setItem("batchManagerData", JSON.stringify(batches));
    localStorage.setItem("inactiveStudentsData", JSON.stringify(inactiveStudents));
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
   Every small action (mark Away, tick a To-Do, etc.) calls this,
   each time sending the FULL current state. If two of these ran
   at once, whichever network response came back later could
   overwrite the server with an older snapshot — silently undoing
   whatever the other save had just written. To stop that, only
   ONE save is ever in flight: a save requested while one is
   already running is queued and re-run (with whatever the state
   is BY THEN) right after the current one finishes, instead of
   firing in parallel.
===================================================== */
let batchSaveInFlight = null;
let batchSaveQueued = false;

function saveBatchesToServer() {
  if (batchSaveInFlight) {
    batchSaveQueued = true;
    return batchSaveInFlight;
  }
  batchSaveQueued = false;
  batchSaveInFlight = doSaveBatchesToServer().finally(() => {
    batchSaveInFlight = null;
    if (batchSaveQueued) {
      batchSaveQueued = false;
      saveBatchesToServer();
    }
  });
  return batchSaveInFlight;
}

async function doSaveBatchesToServer() {
  try {
    const response = await fetch("/api/batches", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batches: batches,
        inactiveStudents: inactiveStudents,
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
    if (Array.isArray(data.todos)) {
      todos = data.todos;
    }
    localStorage.setItem("batchManagerData", JSON.stringify(batches));
    localStorage.setItem("inactiveStudentsData", JSON.stringify(inactiveStudents));
    localStorage.setItem("todosData", JSON.stringify(todos));
    return true;
  } catch (error) {
    console.warn("Could not save to MongoDB API.", error);
    localStorage.setItem("batchManagerData", JSON.stringify(batches));
    localStorage.setItem("inactiveStudentsData", JSON.stringify(inactiveStudents));
    localStorage.setItem("todosData", JSON.stringify(todos));
    alert("⚠️ बदलाव Server पर Save नहीं हो सका (Internet चेक करें) — अभी सिर्फ इसी Phone में सुरक्षित है, इंटरनेट आते ही दोबारा कोई भी बदलाव करके पक्का कर लें।");
    return false;
  }
}
/* =====================================================
   LOAD ON PAGE OPEN
===================================================== */
window.addEventListener("load", async () => {
  await loadBatchesFromServer();
});