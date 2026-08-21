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
function openStudentProfile(bi, si) {
  profileBatchIndex = bi;
  profileStudentIndex = si;
  profileInactiveIndex = null;
  const batch = batches[bi];
  const student = batch.students[si];
  if (!student) {
    return;
  }
  document.getElementById("pageStudentName").textContent = student.name;
  document.getElementById("pageStudentIdentity").textContent = student.identity || "";
  document.getElementById("pageStudentBatch").textContent = batch.name;
  document.getElementById("pageStudentTime").textContent = formatTime(batch.time);
  document.getElementById("pageStudentPosition").textContent = si + 1;
  document.getElementById("pageStudentBatchRow").style.display = "";
  document.getElementById("pageStudentTimeRow").style.display = "";
  document.getElementById("pageStudentPositionRow").style.display = "";
  document.getElementById("familyActions").style.display = "";
  document.getElementById("expelledBanner").style.display = "none";
  document.getElementById("expellActionRow").style.display = "none";
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
