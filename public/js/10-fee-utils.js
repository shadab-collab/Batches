/* =====================================================
   FEE UTILS (shared)
   Pure date/cycle math — no DOM, no database.
   Works both as a browser global (window.FeeUtils) and as
   a Node module (require), so the SAME cycle logic runs on
   the server and in the browser — they can never drift apart.
===================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FeeUtils = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toISODate(y, m, d) {
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function prevMonth(year, month) {
    return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  }

  function nextMonth(year, month) {
    return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  }

  function parseISODate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return { year: y, month: m, day: d };
  }

  function compareISODate(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function todayISO() {
    const d = new Date();
    return toISODate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  /* Cycle for a given (dueDateType, year, month) —
     dueDateType 1  => period = previous month (1 to last day), due on the 1st
     dueDateType 15 => period = 15th of prev month to 14th of this month, due on the 15th */
  function cycleForMonth(dueDateType, year, month) {
    const dueDateISO = toISODate(year, month, dueDateType);
    let cycleStartISO;
    let cycleEndISO;

    if (dueDateType === 1) {
      const prev = prevMonth(year, month);
      cycleStartISO = toISODate(prev.year, prev.month, 1);
      cycleEndISO = toISODate(prev.year, prev.month, daysInMonth(prev.year, prev.month));
    } else {
      const prev = prevMonth(year, month);
      cycleStartISO = toISODate(prev.year, prev.month, 15);
      cycleEndISO = toISODate(year, month, 14);
    }

    return {
      cycleKey: dueDateISO,
      dueDate: dueDateISO,
      cycleStart: cycleStartISO,
      cycleEnd: cycleEndISO
    };
  }

  /* The cycle that is currently "due" as of todayISO */
  function getCurrentCycle(dueDateType, todayIso) {
    const today = parseISODate(todayIso);
    let year = today.year;
    let month = today.month;

    if (dueDateType === 15 && today.day < 15) {
      const prev = prevMonth(year, month);
      year = prev.year;
      month = prev.month;
    }

    return cycleForMonth(dueDateType, year, month);
  }

  /* The first cycle whose due date falls on/after the joining date —
     a student is never charged for a cycle that came due before they joined. */
  function getFirstCycleOnOrAfter(dueDateType, joiningIso) {
    const j = parseISODate(joiningIso);
    let year = j.year;
    let month = j.month;
    let cycle = cycleForMonth(dueDateType, year, month);

    while (compareISODate(cycle.dueDate, joiningIso) < 0) {
      const next = nextMonth(year, month);
      year = next.year;
      month = next.month;
      cycle = cycleForMonth(dueDateType, year, month);
    }

    return cycle;
  }

  /* All cycles from fromCycleKey to toCycleKey inclusive, stepping one cycle at a time */
  function listCycles(dueDateType, fromCycleKey, toCycleKey) {
    const from = parseISODate(fromCycleKey);
    const cycles = [];
    let year = from.year;
    let month = from.month;
    let cycle = cycleForMonth(dueDateType, year, month);
    let guard = 0;

    while (compareISODate(cycle.dueDate, toCycleKey) <= 0 && guard < 600) {
      cycles.push(cycle);
      const next = nextMonth(year, month);
      year = next.year;
      month = next.month;
      cycle = cycleForMonth(dueDateType, year, month);
      guard++;
    }

    return cycles;
  }

  function computeCycleStatus(amountDue, paidSum) {
    if (paidSum <= 0) {
      return "Unpaid";
    }
    if (paidSum < amountDue) {
      return "Partial";
    }
    if (paidSum === amountDue) {
      return "Paid";
    }
    return "Advance";
  }

  return {
    pad2,
    toISODate,
    daysInMonth,
    prevMonth,
    nextMonth,
    parseISODate,
    compareISODate,
    todayISO,
    cycleForMonth,
    getCurrentCycle,
    getFirstCycleOnOrAfter,
    listCycles,
    computeCycleStatus
  };

});
