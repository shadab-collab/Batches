/* =====================================================
   LOAD LOCAL DATA
===================================================== */
const savedVersion = localStorage.getItem("batchManagerDataVersion");
if (savedVersion !== DATA_VERSION) {
  let oldBatches = null;
  const oldRaw = localStorage.getItem("batchManagerData");
  if (oldRaw) {
    try {
      oldBatches = JSON.parse(oldRaw);
    } catch (error) {
      oldBatches = null;
    }
  }
  batches = Array.isArray(oldBatches) ? oldBatches : defaultBatches;
  let oldInactive = [];
  const inactiveRaw = localStorage.getItem("inactiveStudentsData");
  if (inactiveRaw) {
    try {
      const parsed = JSON.parse(inactiveRaw);
      if (Array.isArray(parsed)) {
        oldInactive = parsed;
      }
    } catch (error) {
      oldInactive = [];
    }
  }
  inactiveStudents = oldInactive;
  normalizeAllData();
  localStorage.setItem("batchManagerDataVersion", DATA_VERSION);
  localStorage.setItem("batchManagerData", JSON.stringify(batches));
  localStorage.setItem("inactiveStudentsData", JSON.stringify(inactiveStudents));
} else {
  try {
    batches = JSON.parse(localStorage.getItem("batchManagerData")) || defaultBatches;
  } catch (error) {
    batches = defaultBatches;
  }
  try {
    inactiveStudents = JSON.parse(localStorage.getItem("inactiveStudentsData")) || [];
  } catch (error) {
    inactiveStudents = [];
  }
  normalizeAllData();
}
/* =====================================================
   SAVE DATA
===================================================== */
function saveData() {
  localStorage.setItem("batchManagerData", JSON.stringify(batches));
  localStorage.setItem("inactiveStudentsData", JSON.stringify(inactiveStudents));
  if (window.API_MODE && typeof saveBatchesToServer === "function") {
    saveBatchesToServer();
  }
}
/* =====================================================
   FORMAT TIME
===================================================== */
function formatTime(t) {
  if (!t) {
    return "Time Set";
  }
  const [h, m] = t.split(":");
  let hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${ hour }:${ m } ${ ampm }`;
}
