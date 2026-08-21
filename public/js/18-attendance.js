/* =====================================================
   DAILY MARKING (per batch, from the batch Manage modal)
===================================================== */
let attendanceBatchIndex = null;

function openAttendancePage() {
  if (currentBatch === null) {
    return;
  }
  attendanceBatchIndex = currentBatch;

  document.getElementById("overlay").style.display = "none";
  document.getElementById("attendancePage").style.display = "block";
  window.scrollTo(0, 0);

  const dateInput = document.getElementById("attendanceDateInput");
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
  loadAttendanceDay();
}

function closeAttendancePage() {
  document.getElementById("attendancePage").style.display = "none";
  attendanceBatchIndex = null;
  if (currentBatch !== null) {
    document.getElementById("overlay").style.display = "flex";
  }
}

function shiftAttendanceDate(deltaDays) {
  const input = document.getElementById("attendanceDateInput");
  const d = new Date(input.value);
  d.setDate(d.getDate() + deltaDays);
  input.value = d.toISOString().slice(0, 10);
  loadAttendanceDay();
}

async function loadAttendanceDay() {
  const body = document.getElementById("attendanceDayBody");
  body.innerHTML = `<div class="empty">लोड हो रहा है...</div>`;

  const batch = batches[attendanceBatchIndex];
  if (!batch) {
    return;
  }
  const date = document.getElementById("attendanceDateInput").value;
  const weekday = new Date(date).getDay();

  // full-day holiday check
  try {
    const holRes = await fetch(`/api/attendance/holidays?month=${ date.slice(0, 7) }`);
    const holData = await holRes.json();
    if (holData.success && holData.holidays.some(h => h.date === date)) {
      body.innerHTML = `<div class="empty">🏖️ आज पूरे दिन की Holiday है — किसी Batch की Attendance नहीं ली जाएगी।</div>`;
      return;
    }
  } catch (error) {
    // if the holiday check fails, fall through and still try to show the day
  }

  if ((batch.weeklyHolidays || []).includes(weekday)) {
    body.innerHTML = `<div class="empty">📅 आज इस Batch की Weekly Holiday है।</div>`;
    return;
  }

  const students = batch.students;
  if (!students.length) {
    body.innerHTML = `<div class="empty">इस Batch में कोई Active Student नहीं है।</div>`;
    return;
  }

  try {
    const res = await fetch("/api/attendance/day", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, studentIds: students.map(s => s.id) })
    });
    const data = await res.json();
    if (!data.success) {
      body.innerHTML = `<div class="empty">${ escapeHtml(data.message || "Error") }</div>`;
      return;
    }
    const absentSet = new Set(data.absentStudentIds);

    body.innerHTML = students.map(s => {
      const isAbsent = absentSet.has(s.id);
      return `
                <div class="dashboard-row">
                    <span>${ escapeHtml(s.name) }${ s.identity ? ` <span class="student-identity">(${ escapeHtml(s.identity) })</span>` : "" }</span>
                    <button class="small-btn ${ isAbsent ? "btn-danger" : "btn-light" }" onclick="toggleAttendance('${ s.id }', ${ !isAbsent })">
                        ${ isAbsent ? "Absent ✗" : "Present ✓" }
                    </button>
                </div>
            `;
    }).join("");
  } catch (error) {
    body.innerHTML = `<div class="empty">Load नहीं हो सका। इंटरनेट चेक करें।</div>`;
  }
}

async function toggleAttendance(studentId, makeAbsent) {
  const date = document.getElementById("attendanceDateInput").value;
  try {
    await fetch("/api/attendance/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, date, absent: makeAbsent })
    });
    loadAttendanceDay();
  } catch (error) {
    alert("Save नहीं हो सका। इंटरनेट चेक करें।");
  }
}


/* =====================================================
   FULL-DAY HOLIDAYS
===================================================== */
function openHolidaysModal() {
  document.getElementById("holidaysOverlay").style.display = "flex";
  renderHolidaysForm();
}

function closeHolidaysModal() {
  document.getElementById("holidaysOverlay").style.display = "none";
}

function renderHolidaysForm() {
  const thisMonth = new Date().toISOString().slice(0, 7);
  document.getElementById("holidaysModalBody").innerHTML = `
        <div class="field">
            <label>नई Holiday जोड़ें</label>
            <input id="newHolidayDate" type="date">
        </div>
        <div class="field">
            <label>Note (optional)</label>
            <input id="newHolidayNote" type="text" placeholder="जैसे: Eid">
        </div>
        <button class="btn-main" style="width:100%;margin-bottom:14px;" onclick="addHoliday()">Holiday जोड़ें</button>

        <div class="field">
            <label>महीना देखें</label>
            <input id="holidayViewMonth" type="month" value="${ thisMonth }" onchange="loadHolidaysList()">
        </div>
        <div id="holidaysList"><div class="empty">लोड हो रहा है...</div></div>
    `;
  loadHolidaysList();
}

async function loadHolidaysList() {
  const box = document.getElementById("holidaysList");
  const month = document.getElementById("holidayViewMonth").value;
  box.innerHTML = `<div class="empty">लोड हो रहा है...</div>`;
  try {
    const res = await fetch(`/api/attendance/holidays?month=${ month }`);
    const data = await res.json();
    if (!data.success) {
      box.innerHTML = `<div class="empty">${ escapeHtml(data.message || "Error") }</div>`;
      return;
    }
    if (!data.holidays.length) {
      box.innerHTML = `<div class="empty">इस महीने कोई Holiday दर्ज नहीं है</div>`;
      return;
    }
    box.innerHTML = data.holidays.map(h => `
            <div class="dashboard-row">
                <span>${ FeeUtils.formatDDMM(h.date) }${ h.note ? " — " + escapeHtml(h.note) : "" }</span>
                <button class="small-btn btn-danger" onclick="removeHoliday('${ h.date }')">हटाएं</button>
            </div>
        `).join("");
  } catch (error) {
    box.innerHTML = `<div class="empty">Load नहीं हो सका।</div>`;
  }
}

async function addHoliday() {
  const date = document.getElementById("newHolidayDate").value;
  const note = document.getElementById("newHolidayNote").value;
  if (!date) {
    alert("Date चुनें");
    return;
  }
  try {
    const res = await fetch("/api/attendance/holiday", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, note })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Save नहीं हुआ");
      return;
    }
    document.getElementById("holidayViewMonth").value = date.slice(0, 7);
    renderHolidaysForm();
  } catch (error) {
    alert("Save नहीं हो सका। इंटरनेट चेक करें।");
  }
}

async function removeHoliday(date) {
  if (!confirm("यह Holiday हटानी है?")) {
    return;
  }
  try {
    await fetch("/api/attendance/holiday/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date })
    });
    loadHolidaysList();
  } catch (error) {
    alert("Remove नहीं हो सका। इंटरनेट चेक करें।");
  }
}


/* =====================================================
   MONTHLY ATTENDANCE CALENDAR (per student)
===================================================== */
let attendanceCalendarStudent = null;
let attendanceCalendarData = null;
let generatedCalendarBlob = null;

function openAttendanceCalendarModal() {
  const student = getCurrentProfileStudent();
  if (!student) {
    return;
  }
  attendanceCalendarStudent = student;
  generatedCalendarBlob = null;

  document.getElementById("attendanceCalendarModalBody").innerHTML = `
        <div class="field">
            <label>महीना</label>
            <input id="calMonthPicker" type="month" value="${ new Date().toISOString().slice(0, 7) }" onchange="loadAttendanceCalendarData()">
        </div>
        <div id="calSummaryPreview"><div class="empty">लोड हो रहा है...</div></div>
    `;
  document.getElementById("attendanceCalendarModalActions").innerHTML = `
        <button class="btn-main" onclick="generateAttendanceCalendarImage()">Calendar Generate करें</button>
        <button class="btn-light" onclick="closeAttendanceCalendarModal()">Close</button>
    `;
  document.getElementById("attendanceCalendarOverlay").style.display = "flex";
  loadAttendanceCalendarData();
}

function closeAttendanceCalendarModal() {
  document.getElementById("attendanceCalendarOverlay").style.display = "none";
}

function findBatchWeeklyHolidays(batchId) {
  const batch = batches.find(b => b.id === batchId);
  return batch ? (batch.weeklyHolidays || []) : [];
}

async function loadAttendanceCalendarData() {
  const student = attendanceCalendarStudent;
  const month = document.getElementById("calMonthPicker").value;
  const weeklyHolidays = findBatchWeeklyHolidays(student.batchId);
  const preview = document.getElementById("calSummaryPreview");
  preview.innerHTML = `<div class="empty">लोड हो रहा है...</div>`;

  try {
    const res = await fetch(`/api/attendance/calendar/${ student.id }?month=${ month }&weeklyHolidays=${ weeklyHolidays.join(",") }`);
    const data = await res.json();
    if (!data.success) {
      preview.innerHTML = `<div class="empty">${ escapeHtml(data.message || "Error") }</div>`;
      return;
    }
    attendanceCalendarData = data;
    preview.innerHTML = `
            <div class="dashboard-row"><span>Present</span><strong>${ data.presentCount }</strong></div>
            <div class="dashboard-row"><span>Absent</span><strong>${ data.absentCount }</strong></div>
            <div class="dashboard-row"><span>Attendance %</span><strong>${ data.percentage === null ? "-" : data.percentage + "%" }</strong></div>
        `;
  } catch (error) {
    preview.innerHTML = `<div class="empty">Load नहीं हो सका। इंटरनेट चेक करें।</div>`;
  }
}

const CALENDAR_WEEKDAY_LABELS = ["र", "सो", "मं", "बु", "गु", "शु", "श"];
const HINDI_MONTH_NAMES = ["जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];

function buildCalendarGridHtml(days) {
  let html = `<div class="calendar-weekday-row">${ CALENDAR_WEEKDAY_LABELS.map(w => `<div class="calendar-weekday-cell">${ w }</div>`).join("") }</div>`;
  html += `<div class="calendar-days-grid">`;

  for (let i = 0; i < days[0].weekday; i++) {
    html += `<div class="calendar-day-cell blank"></div>`;
  }

  days.forEach(d => {
    let cellClass = "calendar-day-cell";
    let mark = "";
    if (d.status === "present") {
      cellClass += " present";
      mark = `<div class="calendar-mark">✓</div>`;
    } else if (d.status === "absent") {
      cellClass += " absent";
      mark = `<div class="calendar-mark">✗</div>`;
    } else if (d.status === "holiday" || d.status === "weekly-holiday") {
      cellClass += " holiday";
      mark = `<div class="calendar-mark">H</div>`;
    } else {
      cellClass += " muted";
      mark = `<div class="calendar-mark">&nbsp;</div>`;
    }
    html += `<div class="${ cellClass }">${ mark }<div class="calendar-date-num">${ d.day }</div></div>`;
  });

  html += `</div>`;
  return html;
}

async function generateAttendanceCalendarImage() {
  if (!attendanceCalendarData) {
    alert("Data अभी लोड नहीं हुआ, थोड़ा रुकें");
    return;
  }
  const student = attendanceCalendarStudent;
  const data = attendanceCalendarData;
  const [year, m] = data.month.split("-").map(Number);

  document.getElementById("calStudentName").textContent = student.name;
  document.getElementById("calMonthLabel").textContent = `${ HINDI_MONTH_NAMES[m - 1] } ${ year }`;
  document.getElementById("calSummary").textContent =
    `Present: ${ data.presentCount } · Absent: ${ data.absentCount } · Attendance: ${ data.percentage === null ? "-" : data.percentage + "%" }`;
  document.getElementById("calGrid").innerHTML = buildCalendarGridHtml(data.days);

  const modalBody = document.getElementById("attendanceCalendarModalBody");
  modalBody.innerHTML = `<div class="receipt-search-result"><div class="empty">Image बन रही है...</div></div>`;
  document.getElementById("attendanceCalendarModalActions").innerHTML = `
        <button class="btn-light" onclick="closeAttendanceCalendarModal()">Close</button>
    `;

  try {
    const el = document.getElementById("calendarTemplate");
    const rect = el.getBoundingClientRect();
    const longerEdge = Math.max(rect.width, rect.height);
    const scale = Math.min(4, Math.max(2, 1920 / longerEdge));

    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale,
      useCORS: true,
      letterRendering: true
    });
    canvas.toBlob(blob => {
      generatedCalendarBlob = blob;
      showCalendarPreview(blob);
    }, "image/png");
  } catch (error) {
    modalBody.innerHTML = `<div class="receipt-search-result"><div class="empty">Image नहीं बन सकी। इंटरनेट/browser चेक करें।</div></div>`;
  }
}

function showCalendarPreview(blob) {
  const url = URL.createObjectURL(blob);
  document.getElementById("attendanceCalendarModalBody").innerHTML = `
        <div class="receipt-search-result">
            <img class="receipt-preview-img" src="${ url }">
            <div class="receipt-share-actions">
                <a class="btn-main" download="Attendance-${ attendanceCalendarStudent.name }.png" href="${ url }">Download</a>
                <button class="btn-light" onclick="shareCalendarImage()">Share</button>
            </div>
        </div>
    `;
  document.getElementById("attendanceCalendarModalActions").innerHTML = `
        <button class="btn-light" onclick="closeAttendanceCalendarModal()">Close</button>
    `;
}

async function shareCalendarImage() {
  if (!generatedCalendarBlob) {
    return;
  }
  const file = new File([generatedCalendarBlob], `Attendance-${ attendanceCalendarStudent.name }.png`, { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Attendance Calendar" });
    } catch (error) {
      // user cancelled — nothing to do
    }
  } else {
    alert("इस डिवाइस/browser पर सीधे Share उपलब्ध नहीं है। Download करके WhatsApp पर भेजें।");
  }
}
