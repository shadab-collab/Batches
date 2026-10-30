/* =====================================================
   ATTENDANCE

   - Home का "Attendance" बटन एक पूरा पेज खोलता है, सभी Batch क्रम से।
   - नाम को दाएं (→) swipe = उस दिन Present; बाएं (←) swipe = गलती से
     लगी Attendance हटाना।
   - नाम के बगल में इस महीने की Present-गिनती (नीला counter)। एक दिन में
     एक student की गिनती सिर्फ एक बार बढ़ती है (दुबारा दाएं swipe करने
     पर कुछ नहीं होता — सर्वर पर भी {student, date} unique है)।
   - हर Batch की अपनी साप्ताहिक छुट्टी (किसी का Sunday, किसी का Friday)
     और त्योहार की छुट्टियां (सभी Batch के लिए एक साथ)। Holiday वाले दिन
     उस Batch में swipe बंद रहता है।
   - Absent अलग से कहीं दर्ज नहीं होता: किसी गुज़रे, गैर-Holiday दिन
     Present की entry ना हो तो वो Absent गिना जाता है।
===================================================== */

const ATT_WEEKDAYS = ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"];
const ATT_WEEKDAYS_SHORT = ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"];
const ATT_MONTHS = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];

let attSelectedDate = "";
let attPresentToday = new Set();
let attMonthCounts = {};
let attProfileStudent = null;
let attProfileBatch = null;
let attCalendarContext = null;

/* ---------- छोटे helper ---------- */

function attParse(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function attWeekday(iso) {
  const { y, m, d } = attParse(iso);
  return new Date(y, m - 1, d).getDay();
}

function attDaysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

function attISO(y, m, d) {
  return `${ y }-${ String(m).padStart(2, "0") }-${ String(d).padStart(2, "0") }`;
}

function attFormatDate(iso) {
  const { y, m, d } = attParse(iso);
  return `${ d }/${ m }/${ y }`;
}

function attFestival(iso) {
  return holidays.find(h => h.date === iso) || null;
}

/* उस Batch के लिए उस दिन छुट्टी है या नहीं (त्योहार या साप्ताहिक) */
function attHolidayInfo(batch, iso) {
  const fest = attFestival(iso);
  if (fest) {
    return { label: fest.label ? `त्योहार की छुट्टी — ${ fest.label }` : "त्योहार की छुट्टी" };
  }
  const wd = attWeekday(iso);
  if ((batch.weeklyHolidays || []).includes(wd)) {
    return { label: `साप्ताहिक छुट्टी — ${ ATT_WEEKDAYS[wd] }` };
  }
  return null;
}

/* =====================================================
   PAGE OPEN / CLOSE
===================================================== */

function openAttendancePage() {
  document.getElementById("studentProfilePage").style.display = "none";
  document.getElementById("overlay").style.display = "none";
  document.getElementById("profileOverlay").style.display = "none";
  document.querySelector(".header").style.display = "none";
  document.getElementById("batchGrid").style.display = "none";
  const inactiveWrap = document.querySelector(".inactive-home-wrap");
  if (inactiveWrap) {
    inactiveWrap.style.display = "none";
  }
  document.getElementById("attendancePage").style.display = "block";
  window.scrollTo(0, 0);

  const today = FeeUtils.todayISO();
  const input = document.getElementById("attDateInput");
  input.max = today;
  input.value = today;
  attSelectedDate = today;

  renderFestivalHolidayList();
  reloadAttendancePage();
}

function closeAttendancePage() {
  document.getElementById("attendancePage").style.display = "none";
  document.querySelector(".header").style.display = "";
  document.getElementById("batchGrid").style.display = "";
  const inactiveWrap = document.querySelector(".inactive-home-wrap");
  if (inactiveWrap) {
    inactiveWrap.style.display = "";
  }
  render();
  window.scrollTo(0, 0);
}

function onAttendanceDateChange() {
  const input = document.getElementById("attDateInput");
  const today = FeeUtils.todayISO();
  if (!input.value) {
    input.value = attSelectedDate;
    return;
  }
  if (input.value > today) {
    alert("आगे की तारीख की Attendance नहीं लग सकती।");
    input.value = attSelectedDate;
    return;
  }
  attSelectedDate = input.value;
  reloadAttendancePage();
}

async function reloadAttendancePage() {
  document.getElementById("attendanceBatchList").innerHTML = `<div class="empty">लोड हो रहा है...</div>`;
  await loadAttendanceData();
  renderAttendancePage();
}

async function loadAttendanceData() {
  const date = attSelectedDate;
  const ym = date.slice(0, 7);
  try {
    const [onRes, cntRes] = await Promise.all([
      fetch(`/api/attendance/on/${ date }`).then(r => r.json()),
      fetch(`/api/attendance/month-counts/${ ym }`).then(r => r.json())
    ]);
    if (date !== attSelectedDate) {
      return;
    }
    attPresentToday = new Set(onRes.success ? onRes.studentIds : []);
    attMonthCounts = cntRes.success ? cntRes.counts : {};
  } catch (error) {
    attPresentToday = new Set();
    attMonthCounts = {};
    alert("Attendance लोड नहीं हो सकी। इंटरनेट चेक करें।");
  }
}

/* =====================================================
   RENDER
===================================================== */

function renderAttendancePage() {
  const wrap = document.getElementById("attendanceBatchList");
  document.getElementById("attDateInfo").textContent = ATT_WEEKDAYS[attWeekday(attSelectedDate)];

  if (!batches.length) {
    wrap.innerHTML = `<div class="empty">कोई Batch नहीं है।</div>`;
    return;
  }

  wrap.innerHTML = batches.map((batch, bi) => {
    const holiday = attHolidayInfo(batch, attSelectedDate);
    const weekly = (batch.weeklyHolidays || [])[0];
    const options = `<option value="">कोई नहीं</option>` + ATT_WEEKDAYS.map((name, i) =>
      `<option value="${ i }" ${ weekly === i ? "selected" : "" }>${ name }</option>`
    ).join("");

    const rows = batch.students.map((student, si) => {
      const present = attPresentToday.has(student.id);
      const count = attMonthCounts[student.id] || 0;
      return `
            <div class="att-row ${ present ? "present" : "" } ${ holiday ? "disabled" : "" }"
                 data-sid="${ escapeHtml(student.id) }"
                 data-bid="${ escapeHtml(batch.id) }"
                 data-disabled="${ holiday ? "1" : "0" }">
                <div class="att-row-inner">
                    <span class="att-serial">${ si + 1 }.</span>
                    <span class="att-name">${ escapeHtml(student.name) }</span>
                    <span class="att-tick">${ present ? "✓" : "" }</span>
                    <span class="att-count">${ count }</span>
                </div>
            </div>`;
    }).join("");

    return `
        <div class="att-batch">
            <div class="att-batch-head">
                <div>
                    <div class="att-batch-name">${ escapeHtml(batch.name) }</div>
                    <div class="att-batch-sub">${ formatTime(batch.time) } · ${ batch.students.length } बच्चे</div>
                </div>
                <label class="att-batch-sub">साप्ताहिक छुट्टी:
                    <select onchange="onBatchWeeklyHolidayChange(${ bi }, this.value)">${ options }</select>
                </label>
            </div>
            ${ holiday ? `<div class="att-holiday-banner">🎉 ${ escapeHtml(holiday.label) } — इस दिन Attendance नहीं लगेगी</div>` : "" }
            ${ rows || `<div class="empty" style="padding:14px;">इस Batch में कोई बच्चा नहीं।</div>` }
        </div>`;
  }).join("");
}

/* =====================================================
   MARK / UNMARK
===================================================== */

function attUpdateRow(row, present, bump) {
  row.classList.toggle("present", present);
  row.querySelector(".att-tick").textContent = present ? "✓" : "";
  const counter = row.querySelector(".att-count");
  counter.textContent = attMonthCounts[row.dataset.sid] || 0;
  if (bump) {
    counter.classList.remove("bump");
    void counter.offsetWidth;
    counter.classList.add("bump");
  }
}

async function attMark(row) {
  const sid = row.dataset.sid;
  const bid = row.dataset.bid;
  const date = attSelectedDate;

  // एक दिन में गिनती सिर्फ एक बार बढ़ती है
  if (attPresentToday.has(sid)) {
    return;
  }

  attPresentToday.add(sid);
  attMonthCounts[sid] = (attMonthCounts[sid] || 0) + 1;
  attUpdateRow(row, true, true);

  try {
    const res = await fetch("/api/attendance/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: sid, batchId: bid, date })
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error("mark failed");
    }
  } catch (error) {
    if (date === attSelectedDate) {
      attPresentToday.delete(sid);
      attMonthCounts[sid] = Math.max(0, (attMonthCounts[sid] || 1) - 1);
      attUpdateRow(row, false, false);
    }
    alert("Attendance save नहीं हो सकी। इंटरनेट चेक करें।");
  }
}

async function attUnmark(row) {
  const sid = row.dataset.sid;
  const date = attSelectedDate;

  if (!attPresentToday.has(sid)) {
    return;
  }

  attPresentToday.delete(sid);
  attMonthCounts[sid] = Math.max(0, (attMonthCounts[sid] || 1) - 1);
  attUpdateRow(row, false, true);

  try {
    const res = await fetch("/api/attendance/unmark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: sid, date })
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error("unmark failed");
    }
  } catch (error) {
    if (date === attSelectedDate) {
      attPresentToday.add(sid);
      attMonthCounts[sid] = (attMonthCounts[sid] || 0) + 1;
      attUpdateRow(row, true, false);
    }
    alert("Attendance हटाई नहीं जा सकी। इंटरनेट चेक करें।");
  }
}

/* =====================================================
   SWIPE (touch + mouse, Pointer Events)
   .att-row पर CSS में touch-action: pan-y है, इसलिए ऊपर-नीचे scroll
   ब्राउज़र ही संभालता है और दाएं-बाएं का हिलना हमें मिलता है।
===================================================== */

let attDrag = null;
const ATT_SWIPE_THRESHOLD = 70;

function attOnPointerDown(e) {
  if (e.pointerType === "mouse" && e.button !== 0) {
    return;
  }
  const row = e.target.closest(".att-row");
  if (!row || row.dataset.disabled === "1") {
    return;
  }
  attDrag = {
    row,
    inner: row.querySelector(".att-row-inner"),
    startX: e.clientX,
    startY: e.clientY,
    dx: 0,
    axis: null,
    pointerId: e.pointerId
  };
}

function attOnPointerMove(e) {
  if (!attDrag || e.pointerId !== attDrag.pointerId) {
    return;
  }
  const dx = e.clientX - attDrag.startX;
  const dy = e.clientY - attDrag.startY;

  if (attDrag.axis === null) {
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      attDrag.axis = "h";
      attDrag.row.classList.add("dragging");
      try {
        attDrag.row.setPointerCapture(e.pointerId);
      } catch (error) {
        /* ignore */
      }
    } else if (Math.abs(dy) > 8) {
      attDrag = null;
    }
    return;
  }

  attDrag.dx = dx;
  const shown = Math.max(-120, Math.min(120, dx));
  attDrag.inner.style.transform = `translateX(${ shown }px)`;
  attDrag.row.classList.toggle("swipe-right", dx > 20);
  attDrag.row.classList.toggle("swipe-left", dx < -20);
}

function attFinishDrag(commit) {
  if (!attDrag) {
    return;
  }
  const { row, inner, dx, axis } = attDrag;
  attDrag = null;
  inner.style.transform = "";
  row.classList.remove("dragging", "swipe-right", "swipe-left");
  if (!commit || axis !== "h") {
    return;
  }
  if (dx >= ATT_SWIPE_THRESHOLD) {
    attMark(row);
  } else if (dx <= -ATT_SWIPE_THRESHOLD) {
    attUnmark(row);
  }
}

function attOnPointerUp(e) {
  if (attDrag && e.pointerId === attDrag.pointerId) {
    attFinishDrag(true);
  }
}

function attOnPointerCancel() {
  attFinishDrag(false);
}

(function initAttendanceSwipe() {
  const wrap = document.getElementById("attendanceBatchList");
  if (!wrap) {
    return;
  }
  wrap.addEventListener("pointerdown", attOnPointerDown);
  wrap.addEventListener("pointermove", attOnPointerMove);
  wrap.addEventListener("pointerup", attOnPointerUp);
  wrap.addEventListener("pointercancel", attOnPointerCancel);
})();

/* =====================================================
   HOLIDAYS
===================================================== */

function onBatchWeeklyHolidayChange(batchIndex, value) {
  const batch = batches[batchIndex];
  if (!batch) {
    return;
  }
  batch.weeklyHolidays = value === "" ? [] : [Number(value)];
  saveData();
  renderAttendancePage();
}

function addFestivalHoliday() {
  const dateEl = document.getElementById("attHolidayDate");
  const labelEl = document.getElementById("attHolidayLabel");
  const date = dateEl.value;
  const label = labelEl.value.trim();
  if (!date) {
    alert("पहले छुट्टी की तारीख चुनें।");
    return;
  }
  if (holidays.some(h => h.date === date)) {
    alert("यह तारीख पहले से जुड़ी हुई है।");
    return;
  }
  holidays.push({ date, label });
  holidays.sort((a, b) => (a.date < b.date ? -1 : 1));
  saveData();
  dateEl.value = "";
  labelEl.value = "";
  renderFestivalHolidayList();
  renderAttendancePage();
}

function removeFestivalHoliday(date) {
  if (!confirm(`${ attFormatDate(date) } की छुट्टी हटानी है?`)) {
    return;
  }
  holidays = holidays.filter(h => h.date !== date);
  saveData();
  renderFestivalHolidayList();
  renderAttendancePage();
}

function renderFestivalHolidayList() {
  const box = document.getElementById("attHolidayList");
  if (!box) {
    return;
  }
  if (!holidays.length) {
    box.innerHTML = `<div class="empty" style="text-align:left;padding:4px 0;">अभी कोई त्योहार की छुट्टी नहीं जुड़ी।</div>`;
    return;
  }
  box.innerHTML = holidays.map(h => `
        <div class="att-holiday-item">
            <span>${ attFormatDate(h.date) } (${ ATT_WEEKDAYS_SHORT[attWeekday(h.date)] })${ h.label ? " — " + escapeHtml(h.label) : "" }</span>
            <button onclick="removeFestivalHoliday('${ h.date }')">✕</button>
        </div>`).join("");
}

/* =====================================================
   PROFILE — इस महीने की Attendance का Summary
   (सिर्फ Active batch के बच्चे की profile में दिखता है)
===================================================== */

function loadAttendanceProfileBlock(student, batch) {
  const section = document.getElementById("attendanceProfileSection");
  if (!section) {
    return;
  }
  if (!student || !batch) {
    attProfileStudent = null;
    attProfileBatch = null;
    section.style.display = "none";
    return;
  }
  attProfileStudent = student;
  attProfileBatch = batch;
  section.style.display = "";
  document.getElementById("attProfileMonth").value = FeeUtils.todayISO().slice(0, 7);
  refreshAttendanceProfileBlock();
}

async function fetchStudentMonthDates(studentId, ym) {
  const res = await fetch(`/api/attendance/student/${ encodeURIComponent(studentId) }/${ ym }`);
  const data = await res.json();
  if (!data.success) {
    throw new Error("load failed");
  }
  return data.dates;
}

/* महीने के हर दिन का हाल: present / absent / holiday / (खाली = आगे का दिन या
   admission से पहले का दिन)। Absent = गुज़रा गैर-Holiday दिन जिसमें Present नहीं। */
function attComputeMonth(student, batch, ym, presentDates) {
  const [y, m] = ym.split("-").map(Number);
  const todayIso = FeeUtils.todayISO();
  const total = attDaysInMonth(y, m);
  const presentSet = new Set(presentDates);
  const days = [];
  const stats = { present: 0, absent: 0, holiday: 0 };

  for (let d = 1; d <= total; d++) {
    const iso = attISO(y, m, d);
    let state = "";
    const isFuture = iso > todayIso;
    const beforeAdmission = student.admissionDate && iso < student.admissionDate;

    if (presentSet.has(iso)) {
      state = "present";
      stats.present++;
    } else if (!isFuture && !beforeAdmission) {
      if (attHolidayInfo(batch, iso)) {
        state = "holiday";
        stats.holiday++;
      } else {
        state = "absent";
        stats.absent++;
      }
    }
    days.push({ d, iso, state });
  }
  return { days, stats, y, m };
}

async function refreshAttendanceProfileBlock() {
  const box = document.getElementById("attProfileSummary");
  const student = attProfileStudent;
  const batch = attProfileBatch;
  if (!student || !batch) {
    return;
  }
  const ym = document.getElementById("attProfileMonth").value;
  if (!ym) {
    return;
  }
  box.textContent = "लोड हो रहा है...";
  try {
    const dates = await fetchStudentMonthDates(student.id, ym);
    if (student !== attProfileStudent) {
      return;
    }
    const { stats } = attComputeMonth(student, batch, ym, dates);
    box.innerHTML = `
            <div class="att-stat-row">
                <div class="att-stat green"><b>${ stats.present }</b><span>Present</span></div>
                <div class="att-stat red"><b>${ stats.absent }</b><span>Absent</span></div>
                <div class="att-stat"><b>${ stats.present + stats.absent }</b><span>कुल कक्षा-दिन</span></div>
                <div class="att-stat"><b>${ stats.holiday }</b><span>छुट्टी</span></div>
            </div>
            <div class="empty" style="text-align:left;padding:6px 0 0;">
                छुट्टी इस Batch की अभी की साप्ताहिक छुट्टी और त्योहार की छुट्टियों के हिसाब से गिनी जाती है।
            </div>`;
  } catch (error) {
    box.textContent = "Attendance लोड नहीं हो सकी।";
  }
}

/* =====================================================
   MONTHLY CALENDAR (हरा ✓ = आया, लाल ✗ = नहीं आया, ग्रे = छुट्टी)
===================================================== */

async function openAttendanceCalendar() {
  const student = attProfileStudent;
  const batch = attProfileBatch;
  const ym = document.getElementById("attProfileMonth").value;
  if (!student || !batch || !ym) {
    return;
  }
  let dates;
  try {
    dates = await fetchStudentMonthDates(student.id, ym);
  } catch (error) {
    alert("Attendance लोड नहीं हो सकी। इंटरनेट चेक करें।");
    return;
  }
  const { days, stats, y, m } = attComputeMonth(student, batch, ym, dates);
  const firstWeekday = new Date(y, m - 1, 1).getDay();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(`<div class="att-cal-cell empty"></div>`);
  }
  days.forEach(day => {
    let mark = "";
    if (day.state === "present") {
      mark = `<div class="mark">✓</div>`;
    } else if (day.state === "absent") {
      mark = `<div class="mark">✗</div>`;
    } else if (day.state === "holiday") {
      mark = `<div style="font-size:10px;">छुट्टी</div>`;
    }
    cells.push(`<div class="att-cal-cell ${ day.state }"><div>${ day.d }</div>${ mark }</div>`);
  });

  document.getElementById("attCalendarPaper").innerHTML = `
        <div class="att-cal-title">${ escapeHtml(student.name) }</div>
        <div class="att-cal-sub">${ escapeHtml(batch.name) } · ${ ATT_MONTHS[m - 1] } ${ y }<br>Present ${ stats.present } / ${ stats.present + stats.absent } दिन</div>
        <div class="att-cal-grid">
            ${ ATT_WEEKDAYS_SHORT.map(n => `<div class="att-cal-dow">${ n }</div>`).join("") }
            ${ cells.join("") }
        </div>
        <div class="att-cal-legend">
            <span style="color:#2e7d32;">✓ आया</span>
            <span style="color:#c62828;">✗ नहीं आया</span>
            <span style="color:#78909c;">छुट्टी</span>
        </div>`;

  attCalendarContext = { name: student.name, ym };
  document.getElementById("attendanceCalendarOverlay").style.display = "flex";
}

function closeAttendanceCalendar() {
  document.getElementById("attendanceCalendarOverlay").style.display = "none";
}

/* WhatsApp पर भेजने के लिए image — html2canvas सिर्फ तभी लोड होता है जब
   "Image Download" दबाया जाए, इसलिए बाकी app पर कोई बोझ नहीं पड़ता। */
function attLoadHtml2Canvas() {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("html2canvas load failed"));
    document.head.appendChild(script);
  });
}

async function downloadAttendanceCalendarImage() {
  if (!attCalendarContext) {
    return;
  }
  try {
    await attLoadHtml2Canvas();
    const canvas = await window.html2canvas(document.getElementById("attCalendarPaper"), {
      backgroundColor: "#ffffff",
      scale: 2
    });
    const link = document.createElement("a");
    link.download = `${ attCalendarContext.name }-${ attCalendarContext.ym }-attendance.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (error) {
    alert("Image नहीं बन सकी। इंटरनेट चेक करें, या Calendar का screenshot ले लें।");
  }
}
