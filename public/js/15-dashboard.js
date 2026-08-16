let dashboardActiveTab = "monthly";


function currentYearMonth() {
  const d = new Date();
  return `${ d.getFullYear() }-${ String(d.getMonth() + 1).padStart(2, "0") }`;
}

function previousYearMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${ d.getFullYear() }-${ String(d.getMonth() + 1).padStart(2, "0") }`;
}

function monthLabel(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  const names = ["जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
  return `${ names[m - 1] } ${ y }`;
}


/* =====================================================
   OPEN / CLOSE
===================================================== */
function openDashboardPage() {
  document.getElementById("studentProfilePage").style.display = "none";
  document.getElementById("overlay").style.display = "none";
  document.getElementById("profileOverlay").style.display = "none";
  document.querySelector(".header").style.display = "none";
  document.getElementById("batchGrid").style.display = "none";
  const inactiveWrap = document.querySelector(".inactive-home-wrap");
  if (inactiveWrap) {
    inactiveWrap.style.display = "none";
  }
  document.getElementById("dashboardPage").style.display = "block";
  window.scrollTo(0, 0);

  switchDashboardView("monthly");
  refreshDashboardSnapshotAndLoad();
}

function closeDashboardPage() {
  document.getElementById("dashboardPage").style.display = "none";
  document.querySelector(".header").style.display = "";
  document.getElementById("batchGrid").style.display = "";
  const inactiveWrap = document.querySelector(".inactive-home-wrap");
  if (inactiveWrap) {
    inactiveWrap.style.display = "";
  }
  render();
  window.scrollTo(0, 0);
}

function switchDashboardView(view) {
  dashboardActiveTab = view;
  document.getElementById("dashTabMonthly").classList.toggle("active", view === "monthly");
  document.getElementById("dashTabDaily").classList.toggle("active", view === "daily");
  document.getElementById("dashTabWeekly").classList.toggle("active", view === "weekly");

  document.getElementById("dashboardMonthlyView").style.display = view === "monthly" ? "block" : "none";
  document.getElementById("dashboardRangeView").style.display = view === "monthly" ? "none" : "block";

  if (view !== "monthly") {
    const today = new Date().toISOString().slice(0, 10);
    const fromInput = document.getElementById("dashRangeFrom");
    const toInput = document.getElementById("dashRangeTo");
    if (!fromInput.value) {
      fromInput.value = today.slice(0, 8) + "01";
    }
    if (!toInput.value) {
      toInput.value = today;
    }
    loadDashboardRange();
  }
}


/* =====================================================
   CURRENT-MONTH LIVE SNAPSHOT
   Computes today's Active Student count + total committed
   monthly fee from the app's own loaded data, and records
   it for the current month. Past months are never touched
   here — the backend refuses to overwrite them once the
   calendar has moved on (see routes/dashboard.js).
===================================================== */
async function refreshDashboardSnapshotAndLoad() {
  const activeStudentCount = batches.reduce((sum, b) => sum + b.students.length, 0);
  const owners = collectFeeOwnersFromBatches();

  let totalMonthlyFeeCommitted = 0;
  try {
    if (owners.length) {
      const res = await fetch("/api/fees/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owners })
      });
      const data = await res.json();
      if (data.success) {
        totalMonthlyFeeCommitted = Object.values(data.statuses)
          .reduce((sum, s) => sum + (s.amountDue || 0), 0);
      }
    }

    await fetch("/api/dashboard/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yearMonth: currentYearMonth(),
        activeStudentCount,
        totalMonthlyFeeCommitted
      })
    });
  } catch (error) {
    // snapshot refresh is best-effort — still show whatever summary loads next
  }

  loadDashboardMonthly();
}

async function loadDashboardMonthly() {
  const view = document.getElementById("dashboardMonthlyView");
  view.innerHTML = `<div class="empty">लोड हो रहा है...</div>`;

  try {
    const [curRes, prevRes] = await Promise.all([
      fetch(`/api/dashboard/summary?month=${ currentYearMonth() }`),
      fetch(`/api/dashboard/summary?month=${ previousYearMonth() }`)
    ]);
    const cur = await curRes.json();
    const prev = await prevRes.json();

    if (!cur.success) {
      view.innerHTML = `<div class="empty">${ escapeHtml(cur.message || "Error") }</div>`;
      return;
    }

    const collectionDiff = cur.collection - (prev.collection || 0);
    const diffText = collectionDiff === 0
      ? "पिछले महीने जितना ही"
      : (collectionDiff > 0
        ? `+₹${ collectionDiff } पिछले महीने से ज़्यादा`
        : `₹${ Math.abs(collectionDiff) } पिछले महीने से कम`);

    view.innerHTML = `
            <div class="dashboard-card">
                <div class="dashboard-card-title">${ monthLabel(cur.yearMonth) } (इस महीने)</div>
                <div class="dashboard-row"><span>Active Students</span><strong>${ cur.activeStudentCount ?? "-" }</strong></div>
                <div class="dashboard-row"><span>Total Monthly Fee (सभी Active)</span><strong>₹${ cur.totalMonthlyFeeCommitted ?? "-" }</strong></div>
                <div class="dashboard-row"><span>Collection अब तक (Tuition)</span><strong>₹${ cur.tuitionCollection }</strong></div>
                <div class="dashboard-row"><span>Collection अब तक (Admission)</span><strong>₹${ cur.admissionCollection }</strong></div>
                <div class="dashboard-row"><span>कुल Collection</span><strong>₹${ cur.collection }</strong></div>
            </div>

            <div class="dashboard-card">
                <div class="dashboard-card-title">${ monthLabel(prev.yearMonth) } (पिछला महीना)</div>
                <div class="dashboard-row"><span>Active Students</span><strong>${ prev.activeStudentCount ?? "-" }</strong></div>
                <div class="dashboard-row"><span>कुल Collection</span><strong>₹${ prev.collection || 0 }</strong></div>
            </div>

            <div class="dashboard-progress">${ diffText }</div>
        `;
  } catch (error) {
    view.innerHTML = `<div class="empty">Load नहीं हो सका। इंटरनेट चेक करें।</div>`;
  }
}


/* =====================================================
   DAILY / WEEKLY BREAKDOWN
===================================================== */
async function loadDashboardRange() {
  const from = document.getElementById("dashRangeFrom").value;
  const to = document.getElementById("dashRangeTo").value;
  const resultsBox = document.getElementById("dashboardRangeResults");
  if (!from || !to) {
    return;
  }

  resultsBox.innerHTML = `<div class="empty">लोड हो रहा है...</div>`;

  try {
    const groupBy = dashboardActiveTab === "weekly" ? "week" : "day";
    const res = await fetch(`/api/dashboard/range?from=${ from }&to=${ to }&groupBy=${ groupBy }`);
    const data = await res.json();
    if (!data.success) {
      resultsBox.innerHTML = `<div class="empty">${ escapeHtml(data.message || "Error") }</div>`;
      return;
    }
    if (!data.buckets.length) {
      resultsBox.innerHTML = `<div class="empty">इस अवधि में कोई Collection नहीं है</div>`;
      return;
    }
    resultsBox.innerHTML = data.buckets.map(b => `
            <div class="dashboard-row">
                <span>${ escapeHtml(b.bucket) }</span>
                <strong>₹${ b.amount }</strong>
            </div>
        `).join("");
  } catch (error) {
    resultsBox.innerHTML = `<div class="empty">Load नहीं हो सका। इंटरनेट चेक करें।</div>`;
  }
}


/* =====================================================
   MANUAL / HISTORICAL ENTRY
===================================================== */
function openDashboardManualEntry() {
  document.getElementById("dashboardManualBody").innerHTML = `
        <div class="field">
            <label>Year-Month (जैसे 2023-04)</label>
            <input id="dmeYearMonth" type="month">
        </div>
        <div class="field">
            <label>Active Students (उस महीने)</label>
            <input id="dmeActiveCount" type="number">
        </div>
        <div class="field">
            <label>Tuition Collection (₹)</label>
            <input id="dmeCollection" type="number">
        </div>
        <div class="field">
            <label>Admission Fee Collection (₹)</label>
            <input id="dmeAdmissionCollection" type="number">
        </div>
    `;
  document.getElementById("dashboardManualOverlay").style.display = "flex";
}

function closeDashboardManualEntry() {
  document.getElementById("dashboardManualOverlay").style.display = "none";
}

async function saveDashboardManualEntry() {
  const yearMonth = document.getElementById("dmeYearMonth").value;
  if (!yearMonth) {
    alert("Year-Month चुनें");
    return;
  }

  const body = {
    yearMonth,
    activeStudentCount: Number(document.getElementById("dmeActiveCount").value) || 0,
    collection: Number(document.getElementById("dmeCollection").value) || 0,
    admissionCollection: Number(document.getElementById("dmeAdmissionCollection").value) || 0
  };

  try {
    const res = await fetch("/api/dashboard/manual-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Save नहीं हुआ");
      return;
    }
    closeDashboardManualEntry();
    loadDashboardMonthly();
  } catch (error) {
    alert("Save नहीं हो सका। इंटरनेट चेक करें।");
  }
}
