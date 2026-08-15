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
  const batch = batches[bi];
  const student = batch.students[si];
  if (!student) {
    return;
  }
  document.getElementById("pageStudentName").textContent = student.name;
  document.getElementById("pageStudentBatch").textContent = batch.name;
  document.getElementById("pageStudentTime").textContent = formatTime(batch.time);
  document.getElementById("pageStudentPosition").textContent = si + 1;
  updateFamilyProfile(student);
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
