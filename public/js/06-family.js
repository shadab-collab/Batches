   FAMILY PROFILE
===================================================== */
function updateFamilyProfile(student) {
  const status = document.getElementById("pageStudentFamilyStatus");
  const codeRow = document.getElementById("familyCodeRow");
  const code = document.getElementById("pageStudentFamilyCode");
  const members = document.getElementById("familyMembers");
  if (!student.familyCode) {
    status.textContent = "Solo";
    codeRow.style.display = "none";
    members.innerHTML = "यह बच्चा Solo है\u0964";
    return;
  }
  status.textContent = "Family";
  codeRow.style.display = "flex";
  code.textContent = student.familyCode;
  const familyMembers = getFamilyMembers(student.familyCode);
  if (familyMembers.length === 1) {
    members.innerHTML = `

            <div class="family-code-display">

                Family Code:

                <strong>
                    ${ escapeHtml(student.familyCode) }
                </strong>

            </div>

            <div class="family-member-list">

                <div class="family-member">

                    <span>
                        ${ escapeHtml(student.name) }
                    </span>

                    <span>
                        Current
                    </span>

                </div>

            </div>

        `;
    return;
  }
  members.innerHTML = `

        <div class="family-code-display">

            Family Code:

            <strong>
                ${ escapeHtml(student.familyCode) }
            </strong>

        </div>


        <div class="family-member-list">

            ${ familyMembers.map(member => `

                        <div
                            class="family-member"
                        >

                            <span>
                                ${ escapeHtml(member.student.name) }
                            </span>

                            <span>
                                ${ escapeHtml(member.batch.name) }
                            </span>

                        </div>

                    `).join("") }

        </div>

    `;
}
/* =====================================================
   GET FAMILY MEMBERS
===================================================== */
function getFamilyMembers(code) {
  if (!code) {
    return [];
  }
  const members = [];
  batches.forEach((batch, batchIndex) => {
    batch.students.forEach((student, studentIndex) => {
      if (student.active !== false && student.familyCode === code) {
        members.push({
          student: student,
          batch: batch,
          batchIndex: batchIndex,
          studentIndex: studentIndex
        });
      }
    });
  });
  /*
       Inactive Family members भी
       Family Code से पहचाने जा सकते हैं।
       लेकिन active family list में
       सिर्फ active बच्चे दिखेंगे।
    */
  return members;
}
/* =====================================================
   ADD TO FAMILY
===================================================== */
function addStudentToFamily() {
  if (profileBatchIndex === null || profileStudentIndex === null) {
    return;
  }
  const student = batches[profileBatchIndex].students[profileStudentIndex];
  if (!student) {
    return;
  }
  const code = prompt("Family Code डालें:\n\nउदाहरण: F001");
  if (code === null) {
    return;
  }
  const familyCode = code.trim().toUpperCase();
  if (!familyCode) {
    alert("Family Code खाली नहीं हो सकता\u0964");
    return;
  }
  student.familyCode = familyCode;
  saveData();
  updateFamilyProfile(student);
  render();
}
/* =====================================================
   REMOVE FROM FAMILY
===================================================== */
function removeStudentFromFamily() {
  if (profileBatchIndex === null || profileStudentIndex === null) {
    return;
  }
  const student = batches[profileBatchIndex].students[profileStudentIndex];
  if (!student) {
    return;
  }
  if (!student.familyCode) {
    alert("यह बच्चा पहले से Solo है\u0964");
    return;
  }
  const ok = confirm(`${ student.name } को Family से remove करना है?`);
  if (!ok) {
    return;
  }
  /*
       सिर्फ Family Code हटेगा।
       बच्चा Active रहेगा।
    */
  student.familyCode = "";
  saveData();
  updateFamilyProfile(student);
  render();
}
/* =====================================================
