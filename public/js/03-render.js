/* =====================================================
   RENDER
===================================================== */
function render() {
  const grid = document.getElementById("batchGrid");
  if (!grid) {
    return;
  }
  grid.innerHTML = "";
  batches.forEach((batch, index) => {
    const box = document.createElement("div");
    box.className = "batch";
    box.onclick = () => openBatch(index);
    let students = batch.students.map((student, i) => `

                            <div
                                class="student"
                            >

                                <span
                                    class="serial"
                                >
                                    ${ i + 1 }.
                                </span>

                                <button
                                    class="student-name"
                                    data-owner-type="${ student.familyCode ? "family" : "student" }"
                                    data-owner-key="${ escapeHtml(student.familyCode || student.id) }"
                                    onclick="
                                        event.stopPropagation();
                                        openStudentProfile(
                                            ${ index },
                                            ${ i }
                                        )
                                    "
                                >
                                    ${ escapeHtml(student.name) }
                                </button>

                            </div>

                        `).join("");
    if (!students) {
      students = `<div class="empty">
                        कोई Student नहीं
                    </div>`;
    }
    box.innerHTML = `

                <div
                    class="batch-head"
                >

                    <div
                        class="batch-name"
                    >
                        ${ escapeHtml(batch.name) }
                    </div>

                    <div
                        class="batch-time"
                    >
                        ${ formatTime(batch.time) }
                    </div>

                </div>


                <div
                    class="students"
                >
                    ${ students }
                </div>

            `;
    grid.appendChild(box);
  });
  updateInactiveButton();
  if (typeof refreshFeeStatusCache === "function") {
    refreshFeeStatusCache();
  }
}
/* =====================================================
   INACTIVE BUTTON
===================================================== */
function updateInactiveButton() {
  const button = document.querySelector(".inactive-home-btn");
  if (!button) {
    return;
  }
  if (inactiveStudents.length) {
    button.textContent = `Inactive Students (${ inactiveStudents.length })`;
  } else {
    button.textContent = "Inactive Students";
  }
}
