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

  /* The first cycle whose PERIOD (cycleStart..cycleEnd) covers the joining
     date or comes after it — a student is never charged for a cycle whose
     entire period already finished before they joined. (Comparing against
     cycleEnd, not dueDate, matters when someone joins exactly on a due day:
     e.g. joining on the 15th with dueDateType 15 must NOT match the cycle
     that ends the day before, on the 14th.) */
  function getFirstCycleOnOrAfter(dueDateType, joiningIso) {
    const j = parseISODate(joiningIso);
    let year = j.year;
    let month = j.month;
    let cycle = cycleForMonth(dueDateType, year, month);

    while (compareISODate(cycle.cycleEnd, joiningIso) < 0) {
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

  function computeCycleStatus(amountDue, paidSum, charitySum) {
    const charity = charitySum || 0;
    if (charity > 0) {
      return paidSum > 0 ? "Partial / Charity" : "Charity";
    }
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

  /* The cycle whose period (cycleStart..cycleEnd) contains the given date.
     Used to find the last cycle a student should still be billed for when
     they leave mid-cycle. */
  function getCycleContaining(dueDateType, dateIso) {
    const d = parseISODate(dateIso);
    let year = d.year;
    let month = d.month;
    let cycle = cycleForMonth(dueDateType, year, month);

    while (compareISODate(cycle.cycleEnd, dateIso) < 0) {
      const next = nextMonth(year, month);
      year = next.year;
      month = next.month;
      cycle = cycleForMonth(dueDateType, year, month);
    }
    while (compareISODate(cycle.cycleStart, dateIso) > 0) {
      const prev = prevMonth(year, month);
      year = prev.year;
      month = prev.month;
      cycle = cycleForMonth(dueDateType, year, month);
    }

    return cycle;
  }

  function formatDDMM(iso) {
    const { month, day } = parseISODate(iso);
    return `${ pad2(day) }/${ pad2(month) }`;
  }

  const HINDI_MONTHS = [
    "जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून",
    "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"
  ];

  function formatHindiDate(iso) {
    const { year, month, day } = parseISODate(iso);
    return `${ day } ${ HINDI_MONTHS[month - 1] } ${ year }`;
  }

  /* Display label for a cycle: start date to the NEXT due date (not the
     internal cycleEnd, which is one day earlier) — e.g. "15 मार्च 2026 से
     15 अप्रैल 2026 तक", matching how the coaching owner actually thinks
     about the period. */
  function formatCycleRange(cycle) {
    return `${ formatHindiDate(cycle.cycleStart) } से ${ formatHindiDate(cycle.dueDate) } तक`;
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
    computeCycleStatus,
    getCycleContaining,
    formatDDMM,
    formatHindiDate,
    formatCycleRange
  };

});
