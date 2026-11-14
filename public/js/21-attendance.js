/* =====================================================
   ATTENDANCE (मुख्य app वाला हिस्सा)

   Attendance लगाने और गिनती देखने का पूरा काम अलग पेज
   (/attendance.html) पर होता है, जो Growth Analysis की तरह नए tab में
   खुलता है। यहां सिर्फ दो चीज़ें हैं:
   - Home का Attendance बटन वो पेज खोलता है
   - हर Active बच्चे की profile में इस महीने का Summary और
     Monthly Calendar (हरा ✓ उपस्थित, लाल ✗ अनुपस्थित, ग्रे छुट्टी)

   छुट्टियों की सेटिंग (Batch की साप्ताहिक + त्योहार) सर्वर से ली जाती है,
   मुख्य app की अपनी memory से नहीं।
===================================================== */

const ATT_WEEKDAYS_SHORT = ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"];
const ATT_MONTHS = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];

let attProfileStudent = null;
let attProfileBatch = null;
let attCalendarContext = null;
let attProfileOpts = null;   // Away / Inactive बच्चे के लिए: { status, until, batchName }
let attProfileInfo = null;   // उस बच्चे के पूरे Attendance का सार (कुल दिन, पहली/आख़िरी तारीख)

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

async function fetchAttendanceInfo(studentId) {
  const res = await fetch(`/api/attendance/student/${ encodeURIComponent(studentId) }/info`);
  const data = await res.json();
  if (!data.success) {
    throw new Error("info load failed");
  }
  return data;
}

function attFmt(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${ d }/${ m }/${ y }`;
}

async function fetchStudentMonthDates(studentId, ym) {
  const res = await fetch(`/api/attendance/student/${ encodeURIComponent(studentId) }/${ ym }`);
  const data = await res.json();
  if (!data.success) {
    throw new Error("load failed");
  }
  return data.dates;
}

/* batch खाली (null) हो सकता है — जैसे पुराना Inactive बच्चा जिसका Batch अब पता
   नहीं; तब सिर्फ "सभी Batch" वाली छुट्टियां लगती हैं, साप्ताहिक नहीं। */
function attHolidayInfo(batch, iso, cfg) {
  const key = batch ? attBatchKey(batch) : null;
  // batchIds खाली (या ना हो) = सभी Batch की छुट्टी, वरना सिर्फ चुने हुए Batch की
  if (cfg.festivals.some(f => f.date === iso
      && (!f.batchIds || !f.batchIds.length || (key !== null && f.batchIds.includes(key))))) {
    return true;
  }
  if (!batch) {
    return false;
  }
  const weekly = cfg.weeklyByBatch[key];
  return weekly !== undefined && weekly === attWeekday(iso);
}

/* महीने के हर दिन का हाल: present / absent / holiday / (खाली = आगे का दिन,
   admission से पहले का दिन, या `until` (Away/Inactive होने की तारीख) के बाद का दिन)।
   Absent = गुज़रा गैर-Holiday दिन जिसमें Present नहीं — जाने के बाद के दिन Absent नहीं गिने जाते। */
function attComputeMonth(student, batch, ym, presentDates, cfg, until) {
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
    } else if (!isFuture && !beforeAdmission && !(until && iso >= until)) {
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

async function loadAttendanceProfileBlock(student, batch, opts) {
  const section = document.getElementById("attendanceProfileSection");
  if (!section) {
    return;
  }
  if (!student) {
    attProfileStudent = null;
    attProfileBatch = null;
    attProfileOpts = null;
    attProfileInfo = null;
    section.style.display = "none";
    return;
  }
  attProfileStudent = student;
  attProfileBatch = batch || null;
  attProfileOpts = opts || null;
  attProfileInfo = null;
  section.style.display = "";

  const picker = document.getElementById("attProfileMonth");
  picker.value = FeeUtils.todayISO().slice(0, 7);

  // Away / Inactive बच्चे: आज के महीने में तो कुछ होगा नहीं, इसलिए उस महीने से
  // शुरू करो जिसमें उनकी आख़िरी Attendance लगी थी; और Batch पता ना हो तो
  // आख़िरी Attendance वाले Batch से पहचान लो।
  if (opts) {
    document.getElementById("attProfileSummary").textContent = "लोड हो रहा है...";
    try {
      const info = await fetchAttendanceInfo(student.id);
      if (student !== attProfileStudent) {
        return;
      }
      attProfileInfo = info;
      if (!attProfileBatch && info.lastBatchId) {
        attProfileBatch = batches.find(b => attBatchKey(b) === info.lastBatchId) || null;
      }
      const anchor = info.lastDate || opts.until || FeeUtils.todayISO();
      picker.value = anchor.slice(0, 7);
    } catch (error) {
      /* सार नहीं मिला तो भी चुने महीने का record दिखाने की कोशिश आगे होगी */
    }
  }
  refreshAttendanceProfileBlock();
}

/* Away / Inactive बच्चे की profile में ऊपर की सूचना + पूरे समय का सार */
function attHistoryNote() {
  if (!attProfileOpts) {
    return "";
  }
  const statusName = attProfileOpts.status === "away" ? "Temporarily Away" : "Inactive";
  const since = attProfileOpts.until ? ` (${ attFmt(attProfileOpts.until) } से)` : "";
  let summary = "";
  if (attProfileInfo) {
    summary = attProfileInfo.total
      ? `<br>कुल उपस्थित: <b>${ attProfileInfo.total } दिन</b> · पहली उपस्थिति ${ attFmt(attProfileInfo.firstDate) } · आख़िरी उपस्थिति ${ attFmt(attProfileInfo.lastDate) }`
      : "<br>इस बच्चे का कोई Attendance record नहीं मिला।";
  }
  return `
        <div class="empty" style="text-align:left;padding:0 0 10px;">
            यह बच्चा अभी <b>${ statusName }</b> है${ since } — नीचे पुराना Attendance record है, नई Attendance अब नहीं लगती।
            ${ summary }
        </div>`;
}

async function refreshAttendanceProfileBlock() {
  const box = document.getElementById("attProfileSummary");
  const student = attProfileStudent;
  const batch = attProfileBatch;
  if (!student) {
    return;
  }
  const ym = document.getElementById("attProfileMonth").value;
  if (!ym) {
    return;
  }
  const until = attProfileOpts ? attProfileOpts.until : null;
  box.textContent = "लोड हो रहा है...";
  try {
    const [dates, cfg] = await Promise.all([
      fetchStudentMonthDates(student.id, ym),
      fetchAttendanceConfig()
    ]);
    if (student !== attProfileStudent) {
      return;
    }
    const { stats } = attComputeMonth(student, batch, ym, dates, cfg, until);
    box.innerHTML = attHistoryNote() + `
            <div class="att-stat-row">
                <div class="att-stat green"><b>${ stats.present }</b><span>Present</span></div>
                <div class="att-stat red"><b>${ stats.absent }</b><span>Absent</span></div>
                <div class="att-stat"><b>${ stats.present + stats.absent }</b><span>कुल कक्षा-दिन</span></div>
                <div class="att-stat"><b>${ stats.holiday }</b><span>छुट्टी</span></div>
            </div>
            <div class="empty" style="text-align:left;padding:6px 0 0;">
                छुट्टी इस Batch की अभी की साप्ताहिक छुट्टी और तारीख वाली छुट्टियों के हिसाब से गिनी जाती है।
            </div>`;
  } catch (error) {
    box.textContent = "Attendance लोड नहीं हो सकी।";
  }
}

/* =====================================================
   MONTHLY CALENDAR (हरा ✓ = उपस्थित, लाल ✗ = अनुपस्थित, ग्रे = छुट्टी)
===================================================== */

async function openAttendanceCalendar() {
  const student = attProfileStudent;
  const batch = attProfileBatch;
  const ym = document.getElementById("attProfileMonth").value;
  if (!student || !ym) {
    return;
  }
  const until = attProfileOpts ? attProfileOpts.until : null;
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
  const { days, stats, y, m } = attComputeMonth(student, batch, ym, dates, cfg, until);
  const batchLabel = batch ? batch.name : ((attProfileOpts && attProfileOpts.batchName) || "");
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
        <div class="att-cal-sub">${ batchLabel ? escapeHtml(batchLabel) + " · " : "" }${ ATT_MONTHS[m - 1] } ${ y }<br>उपस्थित ${ stats.present } / ${ stats.present + stats.absent } दिन</div>
        <div class="att-cal-grid">
            ${ ATT_WEEKDAYS_SHORT.map(n => `<div class="att-cal-dow">${ n }</div>`).join("") }
            ${ cells.join("") }
        </div>
        <div class="att-cal-legend">
            <span style="color:#2e7d32;">✓ उपस्थित</span>
            <span style="color:#c62828;">✗ अनुपस्थित</span>
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
