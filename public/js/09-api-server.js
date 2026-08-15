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
    normalizeAllData();
    localStorage.setItem("batchManagerData", JSON.stringify(batches));
    localStorage.setItem("inactiveStudentsData", JSON.stringify(inactiveStudents));
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
   SAVE BATCHES + INACTIVE TO SERVER
===================================================== */
async function saveBatchesToServer() {
  try {
    const response = await fetch("/api/batches", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batches: batches,
        inactiveStudents: inactiveStudents
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
    localStorage.setItem("batchManagerData", JSON.stringify(batches));
    localStorage.setItem("inactiveStudentsData", JSON.stringify(inactiveStudents));
    return true;
  } catch (error) {
    console.warn("Could not save to MongoDB API.", error);
    localStorage.setItem("batchManagerData", JSON.stringify(batches));
    localStorage.setItem("inactiveStudentsData", JSON.stringify(inactiveStudents));
    return false;
  }
}
/* =====================================================
   LOAD ON PAGE OPEN
===================================================== */
window.addEventListener("load", async () => {
  await loadBatchesFromServer();
});