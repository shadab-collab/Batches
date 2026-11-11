/* =====================================================
   OPEN BATCH
===================================================== */
function openBatch(index) {
  currentBatch = index;
  const batch = batches[index];
  document.getElementById("modalTitle").textContent = batch.name + " Manage";
  document.getElementById("batchName").value = batch.name;
  document.getElementById("batchTime").value = batch.time;
  document.getElementById("newStudent").value = "";
  renderStudents();
  document.getElementById("overlay").style.display = "flex";
}

/* =====================================================
   CLOSE MODAL
===================================================== */
function closeModal() {
  document.getElementById("overlay").style.display = "none";
  currentBatch = null;
  render();
}
/* =====================================================
   SAVE BATCH
===================================================== */
function saveBatch() {
  if (currentBatch === null) {
    return;
  }
  const name = document.getElementById("batchName").value.trim();
  const time = document.getElementById("batchTime").value;
  if (name) {
    batches[currentBatch].name = name;
  }
  batches[currentBatch].time = time;
  saveData();
  closeModal();
}
/* =====================================================
   ADD STUDENT
===================================================== */
function addStudent() {
  if (currentBatch === null) {
    return;
  }
  const input = document.getElementById("newStudent");
  const name = input.value.trim();
  if (!name) {
    return;
  }
  const student = createStudent(name);
  student.batchId = batches[currentBatch].id;
  batches[currentBatch].students.push(student);
  input.value = "";
  saveData();
  renderStudents();
  render();
}
/* =====================================================
   SEND TO INACTIVE
===================================================== */
function deleteStudent(index) {
  if (currentBatch === null) {
    return;
  }
  const student = batches[currentBatch].students[index];
  if (!student) {
    return;
  }
  const ok = confirm(`${ student.name } को Inactive Students में भेजना है?`);
  if (!ok) {
    return;
  }
  student.active = false;
  student.inactiveSince = FeeUtils.todayISO();
  inactiveStudents.push(student);
  batches[currentBatch].students.splice(index, 1);
  saveData();
  renderStudents();
  render();
}
/* =====================================================
   MOVE STUDENT
===================================================== */
function moveStudent(index) {
  if (currentBatch === null)
    return;
  const student = batches[currentBatch].students[index];
  if (!student)
    return;
  const target = prompt(`Student: ${ student.name }\n\n` + `किस Batch में Move करना है?\n\n` + batches.map((batch, i) => i === currentBatch ? "" : `${ i + 1 }. ${ batch.name } — ${ formatTime(batch.time) }`).filter(Boolean).join("\n") + `\n\nBatch number लिखें (1-10):`);
  if (target === null)
    return;
  const targetIndex = Number(target) - 1;
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= batches.length || targetIndex === currentBatch) {
    alert("सही Batch number चुनें\u0964");
    return;
  }
  batches[targetIndex].students.push(student);
  student.batchId = batches[targetIndex].id;
  batches[currentBatch].students.splice(index, 1);
  saveData();
  renderStudents();
  render();
}
/* =====================================================
   MOVE STUDENT TO A POSITION
   बच्चे के नंबर को दबाकर सीधे किसी भी नंबर पर भेजें — बार-बार
   ↑ ↓ नहीं दबाने पड़ते। बीच के बाकी बच्चे अपने आप आगे-पीछे हो जाते हैं।
===================================================== */
function moveStudentToPosition(index) {
  if (currentBatch === null) {
    return;
  }
  const students = batches[currentBatch].students;
  const student = students[index];
  if (!student || students.length < 2) {
    return;
  }
  const total = students.length;
  const answer = prompt(
    `${ student.name }\n\nअभी नंबर ${ index + 1 } पर है।\nकिस नंबर पर भेजना है? (1 से ${ total })`,
    String(index + 1)
  );
  if (answer === null) {
    return;
  }
  // हिंदी अंक (१२३) लिखे हों तब भी चले
  const typed = answer.trim().replace(/[०-९]/g, d => String("०१२३४५६७८९".indexOf(d)));
  const target = Number(typed);
  if (typed === "" || !Number.isInteger(target) || target < 1 || target > total) {
    alert(`1 से ${ total } के बीच सही नंबर लिखें\u0964`);
    return;
  }
  if (target - 1 === index) {
    return;
  }
  students.splice(index, 1);
  students.splice(target - 1, 0, student);
  saveData();
  renderStudents();
  render();

  // नई जगह पर पहुंचा बच्चा कुछ देर पीला दिखे, ताकि पता चले कहां गया
  const row = document.querySelectorAll("#studentList .student-row")[target - 1];
  if (row) {
    row.style.background = "#fff3b0";
    if (row.scrollIntoView) {
      row.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    setTimeout(() => { row.style.background = ""; }, 1500);
  }
}
/* =====================================================
   RENDER STUDENTS
===================================================== */
function renderStudents() {
  const list = document.getElementById("studentList");
  if (!list || currentBatch === null) {
    return;
  }
  const students = batches[currentBatch].students;
  if (!students.length) {
    list.innerHTML = `<div class="empty">
                कोई Student नहीं
            </div>`;
    return;
  }
  const jumpHint = students.length > 1
    ? `<div style="font-size:12px;color:#777;padding:0 0 8px;">नंबर दबाकर बच्चे को सीधे किसी भी नंबर पर भेजें</div>`
    : "";
  list.innerHTML = jumpHint + students.map((student, i) => `

                <div class="student-row">

                    ${ students.length > 1
    ? `<button
                        class="serial-manage"
                        title="सीधे किसी नंबर पर भेजें"
                        style="width:34px;height:32px;padding:0;border:1px solid #b8c4d0;border-radius:8px;background:#f2f6fa;color:#1769aa;font-size:14px;font-weight:700;cursor:pointer;"
                        onclick="moveStudentToPosition(${ i })"
                    >${ i + 1 }</button>`
    : `<div class="serial-manage">${ i + 1 }.</div>` }


                    <button
                        class="manage-student-name"
                        data-owner-type="${ student.familyCode ? "family" : "student" }"
                        data-owner-key="${ escapeHtml(student.familyCode || student.id) }"
                        data-fee-free="${ !!student.feeFree }"
                        onclick="
                            openStudentProfile(
                                ${ currentBatch },
                                ${ i }
                            )
                        "
                    >
                        ${ escapeHtml(student.name) }
                        ${ student.identity ? `<span class="student-identity">(${ escapeHtml(student.identity) })</span>` : "" }
                    </button>


                    <button
                        class="small-btn btn-light"
                        onclick="moveUp(${ i })"
                        ${ i === 0 ? "disabled" : "" }
                    >
                        ↑
                    </button>


                    <button
                        class="small-btn btn-light"
                        onclick="moveDown(${ i })"
                        ${ i === students.length - 1 ? "disabled" : "" }
                    >
                        ↓
                    </button>


                    <button
                        class="small-btn btn-main"
                        onclick="moveStudent(${ i })"
                    >
                        Move
                    </button>


                    <button
                        class="small-btn btn-danger"
                        onclick="deleteStudent(${ i })"
                    >
                        Delete
                    </button>

                </div>

            `).join("");
  if (typeof refreshFeeStatusCache === "function") {
    refreshFeeStatusCache();
  }
}
