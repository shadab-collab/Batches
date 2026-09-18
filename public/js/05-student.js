/* =====================================================
   MOVE UP
===================================================== */
function moveUp(index) {
  if (currentBatch === null || index <= 0) {
    return;
  }
  const students = batches[currentBatch].students;
  [students[index - 1], students[index]] = [
    students[index],
    students[index - 1]
  ];
  saveData();
  renderStudents();
  render();
}
/* =====================================================
   MOVE DOWN
===================================================== */
function moveDown(index) {
  if (currentBatch === null) {
    return;
  }
  const students = batches[currentBatch].students;
  if (index >= students.length - 1) {
    return;
  }
  [students[index], students[index + 1]] = [
    students[index + 1],
    students[index]
  ];
  saveData();
  renderStudents();
  render();
}
/* =====================================================
   OPEN STUDENT PROFILE
===================================================== */
function openStudentProfile(bi, si, fromAway) {
  profileBatchIndex = bi;
  profileStudentIndex = si;
  profileInactiveIndex = null;
  profileCameFromAway = !!fromAway;
  const batch = batches[bi];
  const student = batch.students[si];
  if (!student) {
    return;
  }
  document.getElementById("pageStudentName").textContent = student.name;
  document.getElementById("pageStudentIdentity").textContent = student.identity || "";
  document.getElementById("pageStudentAdmissionDate").value = student.admissionDate || "";
  document.getElementById("pageStudentFeeFree").checked = !!student.feeFree;
  document.getElementById("pageStudentBatch").textContent = batch.name;
  document.getElementById("pageStudentTime").textContent = formatTime(batch.time);
  document.getElementById("pageStudentPosition").textContent = si + 1;
  document.getElementById("pageStudentBatchRow").style.display = "";
  document.getElementById("pageStudentTimeRow").style.display = "";
  document.getElementById("pageStudentPositionRow").style.display = "";
  document.getElementById("familyActions").style.display = "";
  document.getElementById("expelledBanner").style.display = "none";
  document.getElementById("expellActionRow").style.display = "none";
  document.getElementById("awayBanner").style.display = student.away ? "" : "none";
  document.getElementById("awayActionsRow").style.display = student.away ? "" : "none";
  document.getElementById("awayMarkBtn").style.display = student.away ? "none" : "";
  updateFamilyProfile(student);
  loadFeeCard(student);
  loadAssessmentSummary(student);
  loadAttendanceSummary(student);
  document.getElementById("overlay").style.display = "none";
  document.getElementById("profileOverlay").style.display = "none";
  document.querySelector(".header").style.display = "none";
  document.getElementById("batchGrid").style.display = "none";
  const inactiveButton = document.querySelector(".inactive-home-wrap");
  if (inactiveButton) {
    inactiveButton.style.display = "none";
  }
  document.getElementById("inactiveStudentsPage").style.display = "none";
  const awayPageEl = document.getElementById("awayStudentsPage");
  if (awayPageEl) {
    awayPageEl.style.display = "none";
  }
  document.getElementById("studentProfilePage").style.display = "block";
  window.scrollTo(0, 0);
}

/* =====================================================
   GET CURRENT PROFILE STUDENT
   Works whether the currently open profile is an active
   batch student or an inactive-list student.
===================================================== */
function getCurrentProfileStudent() {
  if (profileInactiveIndex !== null) {
    return inactiveStudents[profileInactiveIndex];
  }
  if (profileBatchIndex !== null && profileStudentIndex !== null) {
    return batches[profileBatchIndex].students[profileStudentIndex];
  }
  return null;
}

/* =====================================================
   EDIT STUDENT IDENTITY ("पहचान")
   A short freeform tag to tell same-named students apart —
   e.g. "लंबा", "छोटा भाई", "गली नंबर 2".
===================================================== */
function editStudentIdentity() {
  const student = getCurrentProfileStudent();
  if (!student) {
    return;
  }
  const value = prompt("पहचान डालें (जैसे: लंबा, छोटा भाई, गली नंबर 2):", student.identity || "");
  if (value === null) {
    return;
  }
  student.identity = value.trim();
  saveData();
  document.getElementById("pageStudentIdentity").textContent = student.identity;
}

/* =====================================================
   EDIT LIST CODE NAME
   Their own personal shorthand (e.g. "AA SAMYA", "MITHTHU
   SAISHTA") shown in place of the real name only on the
   Monthly Name List — everywhere else in the app still
   shows the actual name.
===================================================== */
function editListCodeName() {
  const student = getCurrentProfileStudent();
  if (!student) {
    return;
  }
  const value = prompt("Monthly List के लिए Code Name डालें (जैसे: AA SAMYA, MITHTHU SAISHTA):\nखाली छोड़ने पर असली नाम ही दिखेगा।", student.listCodeName || "");
  if (value === null) {
    return;
  }
  student.listCodeName = value.trim();
  saveData();
}
/* =====================================================
   TOGGLE FREE STUDENT
   कोई Fee track नहीं होगा — profile पर सिर्फ एक Badge दिखेगा,
   और यह Solo हो तो Monthly Collection List से भी बाहर रहेगा।
   Fee Profile/Cycle का डेटा कहीं delete नहीं होता, बस दिखाना
   बंद हो जाता है — flag हटाते ही सब वापस पहले जैसा दिखेगा।
===================================================== */
function toggleFeeFree() {
  const student = getCurrentProfileStudent();
  if (!student) {
    return;
  }
  student.feeFree = document.getElementById("pageStudentFeeFree").checked;
  saveData();
  loadFeeCard(student);
}
/* =====================================================
   EDIT ADMISSION DATE
   Shown read/write on every student's profile (active or
   inactive) — a plain date field, saved the moment it's
   changed, same as every other profile edit in this app.
===================================================== */
function saveAdmissionDate() {
  const student = getCurrentProfileStudent();
  if (!student) {
    return;
  }
  const value = document.getElementById("pageStudentAdmissionDate").value;
  student.admissionDate = value || "";
  saveData();
}
