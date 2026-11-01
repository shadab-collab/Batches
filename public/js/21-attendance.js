/* =====================================================
   ATTENDANCE (मुख्य app वाला हिस्सा)

   Attendance लगाने और गिनती देखने का पूरा काम अलग पेज
   (/attendance.html) पर होता है, जो Growth Analysis की तरह नए tab में
   खुलता है। यहां सिर्फ दो चीज़ें हैं:
   - Home का Attendance बटन वो पेज खोलता है
   - हर Active बच्चे की profile में इस महीने का Summary और
     Monthly Calendar (हरा ✓ आया, लाल ✗ नहीं आया, ग्रे छुट्टी)

   छुट्टियों की सेटिंग (Batch की साप्ताहिक + त्योहार) सर्वर से ली जाती है,
   मुख्य app की अपनी memory से नहीं।
===================================================== */

const ATT_WEEKDAYS_SHORT = ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"];
const ATT_MONTHS = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];

let attProfileStudent = null;
let attProfileBatch = null;
let attCalendarContext = null;

function openAttendancePage() {
  window.open("/attendance.html", "_blank");
}

/* ---------- छोटे helper ---------- */

function attWeekday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function attDaysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

function attISO(y, m, d) {
  return `${ y }-${ String(m).padStart(2, "0") }-${ String(d).padStart(2, "0") }`;
}

/* Batch की पहचान — Attendance पेज वाली ही (batch.id, ना हो तो नाम) */
function attBatchKey(batch) {
  return batch.id || ("name:" + batch.name);
}

async function fetchAttendanceConfig() {
  const res = await fetch("/api/attendance/config");
  const data = await res.json();
  if (!data.success) {
    throw new Error("config load failed");
  }
  const weeklyByBatch = {};
  (data.weekly || []).forEach(w => { weeklyByBatch[w.batchId] = w.day; });
  return { weeklyByBatch, festivals: data.holidays || [] };
}

async function fetchStudentMonthDates(studentId, ym) {
  const res = await fetch(`/api/attendance/student/${ encodeURIComponent(studentId) }/${ ym }`);
  const data = await res.json();
  if (!data.success) {
    throw new Error("load failed");
  }
  return data.dates;
}

function attHolidayInfo(batch, iso, cfg) {
  if (cfg.festivals.some(f => f.date === iso)) {
    return true;
  }
  const weekly = cfg.weeklyByBatch[attBatchKey(batch)];
  return weekly !== undefined && weekly === attWeekday(iso);
}

/* महीने के हर दिन का हाल: present / absent / holiday / (खाली = आगे का दिन या
   admission से पहले का दिन)। Absent = गुज़रा गैर-Holiday दिन जिसमें Present नहीं। */
function attComputeMonth(student, batch, ym, presentDates, cfg) {
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
      if (attHolidayInfo(batch, iso, cfg)) {
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
    const [dates, cfg] = await Promise.all([
      fetchStudentMonthDates(student.id, ym),
      fetchAttendanceConfig()
    ]);
    if (student !== attProfileStudent) {
      return;
    }
    const { stats } = attComputeMonth(student, batch, ym, dates, cfg);
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
  let cfg;
  try {
    [dates, cfg] = await Promise.all([
      fetchStudentMonthDates(student.id, ym),
      fetchAttendanceConfig()
    ]);
  } catch (error) {
    alert("Attendance लोड नहीं हो सकी। इंटरनेट चेक करें।");
    return;
  }
  const { days, stats, y, m } = attComputeMonth(student, batch, ym, dates, cfg);
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
