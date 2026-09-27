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
  let oldAway = [];
  const awayRaw = localStorage.getItem("awayStudentsData");
  if (awayRaw) {
    try {
      const parsedAway = JSON.parse(awayRaw);
      if (Array.isArray(parsedAway)) {
        oldAway = parsedAway;
      }
    } catch (error) {
      oldAway = [];
    }
  }
  awayStudents = oldAway;
  let oldTodos = [];
  const todosRaw = localStorage.getItem("todosData");
  if (todosRaw) {
    try {
      const parsedTodos = JSON.parse(todosRaw);
      if (Array.isArray(parsedTodos)) {
        oldTodos = parsedTodos;
      }
    } catch (error) {
      oldTodos = [];
    }
  }
  todos = oldTodos;
  normalizeAllData();
  localStorage.setItem("batchManagerDataVersion", DATA_VERSION);
  localStorage.setItem("batchManagerData", JSON.stringify(batches));
  localStorage.setItem("inactiveStudentsData", JSON.stringify(inactiveStudents));
  localStorage.setItem("awayStudentsData", JSON.stringify(awayStudents));
  localStorage.setItem("todosData", JSON.stringify(todos));
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
  try {
    awayStudents = JSON.parse(localStorage.getItem("awayStudentsData")) || [];
  } catch (error) {
    awayStudents = [];
  }
  try {
    todos = JSON.parse(localStorage.getItem("todosData")) || [];
  } catch (error) {
    todos = [];
  }
  normalizeAllData();
}
/* =====================================================
   SAVE DATA
===================================================== */
function saveData() {
  localStorage.setItem("batchManagerData", JSON.stringify(batches));
  localStorage.setItem("inactiveStudentsData", JSON.stringify(inactiveStudents));
  localStorage.setItem("awayStudentsData", JSON.stringify(awayStudents));
  localStorage.setItem("todosData", JSON.stringify(todos));
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
