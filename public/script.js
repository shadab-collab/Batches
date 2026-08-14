const defaultBatches = [
    {name:"Batch 1",time:"",students:[]},
    {name:"Batch 2",time:"",students:[]},
    {name:"Batch 3",time:"",students:[]},
    {name:"Batch 4",time:"",students:[]},
    {name:"Batch 5",time:"",students:[]},

    {name:"Batch 6",time:"14:30",students:[
        "Sana","Yusra","Sidra","Sarim","Sariha","Ryaan",
        "Zishan","Arif","Aaquib","Saif","Saad","Aasifa",
        "Affan","Almas"
    ]},

    {name:"Batch 7",time:"15:30",students:[
        "Atif","Kasif","asad","Sajid","Wajid","Ayaan",
        "Ayaan","fatima","Zohra","Eeram","piyush","Zaid"
    ]},

    {name:"Batch 8",time:"16:30",students:[
        "Imran","Sumaiya","Sohail","Arshad","Kasif",
        "Abhiraaz","Arisfa","Misty","Rishiraaz","Arham",
        "Talib","Tausif","GuFran","Neha","Khadija"
    ]},

    {name:"Batch 9",time:"17:30",students:[
        "Surbhi","Minsa","Sadiya","Saif","Mariya","Yusuf",
        "Rehan","Adil","Zikra","Sayra","Samya","Nurfiya",
        "Aamna","Ruhani"
    ]},

    {name:"Batch 10",time:"18:30",students:[
        "Yusuf","Alsaba","Atif","Harish","Arfa","Ayaan",
        "Almas","Salman","Aman","Aadil","Raunak","Raushan",
        "Arshalan","Samreen","Mahreen"
    ]}
];


const DATA_VERSION = "4";


let batches = [];

let inactiveStudents = [];

let currentBatch = null;

let profileBatchIndex = null;

let profileStudentIndex = null;


/* =====================================================
   CREATE STUDENT
===================================================== */

function createStudent(name){

    return {

        id:
            "S-" +
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .slice(2,8),

        name: String(name),

        familyCode: "",

        active: true

    };

}


/* =====================================================
   NORMALIZE STUDENT
===================================================== */

function normalizeStudent(student){

    /*
       पुराने data में student सिर्फ string था।
    */

    if(typeof student === "string"){

        return createStudent(student);

    }


    if(
        !student ||
        typeof student !== "object"
    ){

        return createStudent("");

    }


    if(!student.id){

        student.id =
            "S-" +
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .slice(2,8);

    }


    if(typeof student.name !== "string"){

        student.name = "";

    }


    if(typeof student.familyCode !== "string"){

        student.familyCode = "";

    }


    if(typeof student.active !== "boolean"){

        student.active = true;

    }


    return student;

}


/* =====================================================
   NORMALIZE ALL DATA
===================================================== */

function normalizeAllData(){

    if(!Array.isArray(batches)){

        batches = [];

    }


    if(!Array.isArray(inactiveStudents)){

        inactiveStudents = [];

    }


    batches.forEach(batch => {

        if(!Array.isArray(batch.students)){

            batch.students = [];

        }


        batch.students =
            batch.students
                .map(normalizeStudent)
                .filter(
                    student =>
                        student.name
                );

    });


    inactiveStudents =
        inactiveStudents
            .map(normalizeStudent)
            .filter(
                student =>
                    student.name
            );


    /*
       पुराने inactive students को
       active batch में नहीं रहने देंगे।
    */

    batches.forEach(batch => {

        const activeStudents = [];


        batch.students.forEach(student => {

            if(student.active === false){

                inactiveStudents.push(
                    student
                );

            }else{

                activeStudents.push(
                    student
                );

            }

        });


        batch.students =
            activeStudents;

    });


    /*
       Duplicate inactive records हटाएँ।
    */

    const seen = new Set();


    inactiveStudents =
        inactiveStudents.filter(student => {

            if(seen.has(student.id)){

                return false;

            }


            seen.add(student.id);


            return true;

        });

}


/* =====================================================
   LOAD LOCAL DATA
===================================================== */

const savedVersion =
    localStorage.getItem(
        "batchManagerDataVersion"
    );


if(
    savedVersion !==
    DATA_VERSION
){

    let oldBatches = null;


    const oldRaw =
        localStorage.getItem(
            "batchManagerData"
        );


    if(oldRaw){

        try{

            oldBatches =
                JSON.parse(oldRaw);

        }catch(error){

            oldBatches = null;

        }

    }


    batches =
        Array.isArray(oldBatches)
            ? oldBatches
            : defaultBatches;


    let oldInactive = [];


    const inactiveRaw =
        localStorage.getItem(
            "inactiveStudentsData"
        );


    if(inactiveRaw){

        try{

            const parsed =
                JSON.parse(
                    inactiveRaw
                );


            if(Array.isArray(parsed)){

                oldInactive = parsed;

            }

        }catch(error){

            oldInactive = [];

        }

    }


    inactiveStudents =
        oldInactive;


    normalizeAllData();


    localStorage.setItem(
        "batchManagerDataVersion",
        DATA_VERSION
    );


    localStorage.setItem(
        "batchManagerData",
        JSON.stringify(
            batches
        )
    );


    localStorage.setItem(
        "inactiveStudentsData",
        JSON.stringify(
            inactiveStudents
        )
    );

}else{

    try{

        batches =
            JSON.parse(
                localStorage.getItem(
                    "batchManagerData"
                )
            ) || defaultBatches;

    }catch(error){

        batches =
            defaultBatches;

    }


    try{

        inactiveStudents =
            JSON.parse(
                localStorage.getItem(
                    "inactiveStudentsData"
                )
            ) || [];

    }catch(error){

        inactiveStudents = [];

    }


    normalizeAllData();

}


/* =====================================================
   SAVE DATA
===================================================== */

function saveData(){

    localStorage.setItem(
        "batchManagerData",
        JSON.stringify(
            batches
        )
    );


    localStorage.setItem(
        "inactiveStudentsData",
        JSON.stringify(
            inactiveStudents
        )
    );


    if(
        window.API_MODE &&
        typeof saveBatchesToServer ===
        "function"
    ){

        saveBatchesToServer();

    }

}


/* =====================================================
   FORMAT TIME
===================================================== */

function formatTime(t){

    if(!t){

        return "Time Set";

    }


    const [h,m] =
        t.split(":");


    let hour =
        Number(h);


    const ampm =
        hour >= 12
            ? "PM"
            : "AM";


    hour =
        hour % 12 || 12;


    return `${hour}:${m} ${ampm}`;

}


/* =====================================================
   RENDER
===================================================== */

function render(){

    const grid =
        document.getElementById(
            "batchGrid"
        );


    if(!grid){

        return;

    }


    grid.innerHTML = "";


    batches.forEach(
        (batch,index) => {

            const box =
                document.createElement(
                    "div"
                );


            box.className =
                "batch";


            box.onclick =
                () =>
                    openBatch(index);


            let students =
                batch.students
                    .map(
                        (student,i) => `

                            <div
                                class="student"
                            >

                                <span
                                    class="serial"
                                >
                                    ${i+1}.
                                </span>

                                <button
                                    class="student-name"
                                    onclick="
                                        event.stopPropagation();
                                        openStudentProfile(
                                            ${index},
                                            ${i}
                                        )
                                    "
                                >
                                    ${escapeHtml(
                                        student.name
                                    )}
                                </button>

                            </div>

                        `
                    )
                    .join("");


            if(!students){

                students =
                    `<div class="empty">
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
                        ${escapeHtml(
                            batch.name
                        )}
                    </div>

                    <div
                        class="batch-time"
                    >
                        ${formatTime(
                            batch.time
                        )}
                    </div>

                </div>


                <div
                    class="students"
                >
                    ${students}
                </div>

            `;


            grid.appendChild(
                box
            );

        }
    );


    updateInactiveButton();

}


/* =====================================================
   INACTIVE BUTTON
===================================================== */

function updateInactiveButton(){

    const button =
        document.querySelector(
            ".inactive-home-btn"
        );


    if(!button){

        return;

    }


    if(
        inactiveStudents.length
    ){

        button.textContent =
            `Inactive Students (${inactiveStudents.length})`;

    }else{

        button.textContent =
            "Inactive Students";

    }

}


/* =====================================================
   OPEN BATCH
===================================================== */

function openBatch(index){

    currentBatch =
        index;


    const batch =
        batches[index];


    document.getElementById(
        "modalTitle"
    ).textContent =
        batch.name +
        " Manage";


    document.getElementById(
        "batchName"
    ).value =
        batch.name;


    document.getElementById(
        "batchTime"
    ).value =
        batch.time;


    document.getElementById(
        "newStudent"
    ).value =
        "";


    renderStudents();


    document.getElementById(
        "overlay"
    ).style.display =
        "flex";

}


/* =====================================================
   CLOSE MODAL
===================================================== */

function closeModal(){

    document.getElementById(
        "overlay"
    ).style.display =
        "none";


    currentBatch =
        null;


    render();

}


/* =====================================================
   SAVE BATCH
===================================================== */

function saveBatch(){

    if(
        currentBatch ===
        null
    ){

        return;

    }


    const name =
        document
            .getElementById(
                "batchName"
            )
            .value
            .trim();


    const time =
        document.getElementById(
            "batchTime"
        ).value;


    if(name){

        batches[
            currentBatch
        ].name =
            name;

    }


    batches[
        currentBatch
    ].time =
        time;


    saveData();


    closeModal();

}


/* =====================================================
   ADD STUDENT
===================================================== */

function addStudent(){

    if(
        currentBatch ===
        null
    ){

        return;

    }


    const input =
        document.getElementById(
            "newStudent"
        );


    const name =
        input.value.trim();


    if(!name){

        return;

    }


    batches[
        currentBatch
    ].students.push(
        createStudent(
            name
        )
    );


    input.value = "";


    saveData();


    renderStudents();


    render();

}


/* =====================================================
   SEND TO INACTIVE
===================================================== */

function deleteStudent(index){

    if(
        currentBatch ===
        null
    ){

        return;

    }


    const student =
        batches[
            currentBatch
        ].students[
            index
        ];


    if(!student){

        return;

    }


    const ok =
        confirm(
            `${student.name} को Inactive Students में भेजना है?`
        );


    if(!ok){

        return;

    }


    student.active =
        false;


    inactiveStudents.push(
        student
    );


    batches[
        currentBatch
    ].students.splice(
        index,
        1
    );


    saveData();


    renderStudents();


    render();

}
/* =====================================================
   MOVE STUDENT
===================================================== */

function moveStudent(index){

    if(currentBatch === null) return;


    const student =
        batches[
            currentBatch
        ].students[index];


    if(!student) return;


    const target =
        prompt(

            `Student: ${student.name}\n\n` +

            `किस Batch में Move करना है?\n\n` +

            batches
                .map((batch,i) =>
                    i === currentBatch
                        ? ""
                        : `${i+1}. ${batch.name} — ${formatTime(batch.time)}`
                )
                .filter(Boolean)
                .join("\n") +

            `\n\nBatch number लिखें (1-10):`

        );


    if(target === null) return;


    const targetIndex =
        Number(target) - 1;


    if(
        !Number.isInteger(targetIndex) ||
        targetIndex < 0 ||
        targetIndex >= batches.length ||
        targetIndex === currentBatch
    ){

        alert("सही Batch number चुनें।");

        return;

    }


    batches[targetIndex].students.push(
        student
    );


    batches[currentBatch].students.splice(
        index,
        1
    );


    saveData();


    renderStudents();


    render();

}


/* =====================================================
   RENDER STUDENTS
===================================================== */

function renderStudents(){

    const list =
        document.getElementById(
            "studentList"
        );


    if(
        !list ||
        currentBatch === null
    ){

        return;

    }


    const students =
        batches[
            currentBatch
        ].students;


    if(!students.length){

        list.innerHTML =
            `<div class="empty">
                कोई Student नहीं
            </div>`;

        return;

    }


    list.innerHTML =
        students
            .map((student,i) => `

                <div class="student-row">

                    <div class="serial-manage">
                        ${i+1}.
                    </div>


                    <button
                        class="manage-student-name"
                        onclick="
                            openStudentProfile(
                                ${currentBatch},
                                ${i}
                            )
                        "
                    >
                        ${escapeHtml(
                            student.name
                        )}
                    </button>


                    <button
                        class="small-btn btn-light"
                        onclick="moveUp(${i})"
                        ${i === 0 ? "disabled" : ""}
                    >
                        ↑
                    </button>


                    <button
                        class="small-btn btn-light"
                        onclick="moveDown(${i})"
                        ${i === students.length - 1 ? "disabled" : ""}
                    >
                        ↓
                    </button>


                    <button
                        class="small-btn btn-main"
                        onclick="moveStudent(${i})"
                    >
                        Move
                    </button>


                    <button
                        class="small-btn btn-danger"
                        onclick="deleteStudent(${i})"
                    >
                        Delete
                    </button>

                </div>

            `)
            .join("");

}


/* =====================================================
   MOVE UP
===================================================== */

function moveUp(index){

    if(
        currentBatch === null ||
        index <= 0
    ){

        return;

    }


    const students =
        batches[
            currentBatch
        ].students;


    [
        students[index - 1],
        students[index]
    ] = [
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

function moveDown(index){

    if(
        currentBatch === null
    ){

        return;

    }


    const students =
        batches[
            currentBatch
        ].students;


    if(
        index >=
        students.length - 1
    ){

        return;

    }


    [
        students[index],
        students[index + 1]
    ] = [
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

function openStudentProfile(
    bi,
    si
){

    profileBatchIndex =
        bi;


    profileStudentIndex =
        si;


    const batch =
        batches[bi];


    const student =
        batch.students[si];


    if(!student){

        return;

    }


    document.getElementById(
        "pageStudentName"
    ).textContent =
        student.name;


    document.getElementById(
        "pageStudentBatch"
    ).textContent =
        batch.name;


    document.getElementById(
        "pageStudentTime"
    ).textContent =
        formatTime(
            batch.time
        );


    document.getElementById(
        "pageStudentPosition"
    ).textContent =
        si + 1;


    updateFamilyProfile(
        student
    );


    document.getElementById(
        "overlay"
    ).style.display =
        "none";


    document.getElementById(
        "profileOverlay"
    ).style.display =
        "none";


    document.querySelector(
        ".header"
    ).style.display =
        "none";


    document.getElementById(
        "batchGrid"
    ).style.display =
        "none";


    const inactiveButton =
        document.querySelector(
            ".inactive-home-wrap"
        );


    if(inactiveButton){

        inactiveButton.style.display =
            "none";

    }


    document.getElementById(
        "inactiveStudentsPage"
    ).style.display =
        "none";


    document.getElementById(
        "studentProfilePage"
    ).style.display =
        "block";


    window.scrollTo(
        0,
        0
    );

}


/* =====================================================
   FAMILY PROFILE
===================================================== */

function updateFamilyProfile(
    student
){

    const status =
        document.getElementById(
            "pageStudentFamilyStatus"
        );


    const codeRow =
        document.getElementById(
            "familyCodeRow"
        );


    const code =
        document.getElementById(
            "pageStudentFamilyCode"
        );


    const members =
        document.getElementById(
            "familyMembers"
        );


    if(!student.familyCode){

        status.textContent =
            "Solo";


        codeRow.style.display =
            "none";


        members.innerHTML =
            "यह बच्चा Solo है।";


        return;

    }


    status.textContent =
        "Family";


    codeRow.style.display =
        "flex";


    code.textContent =
        student.familyCode;


    const familyMembers =
        getFamilyMembers(
            student.familyCode
        );


    if(
        familyMembers.length ===
        1
    ){

        members.innerHTML = `

            <div class="family-code-display">

                Family Code:

                <strong>
                    ${escapeHtml(
                        student.familyCode
                    )}
                </strong>

            </div>

            <div class="family-member-list">

                <div class="family-member">

                    <span>
                        ${escapeHtml(
                            student.name
                        )}
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
                ${escapeHtml(
                    student.familyCode
                )}
            </strong>

        </div>


        <div class="family-member-list">

            ${
                familyMembers
                    .map(member => `

                        <div
                            class="family-member"
                        >

                            <span>
                                ${escapeHtml(
                                    member.student.name
                                )}
                            </span>

                            <span>
                                ${escapeHtml(
                                    member.batch.name
                                )}
                            </span>

                        </div>

                    `)
                    .join("")
            }

        </div>

    `;

}


/* =====================================================
   GET FAMILY MEMBERS
===================================================== */

function getFamilyMembers(
    code
){

    if(!code){

        return [];

    }


    const members = [];


    batches.forEach(
        (batch,batchIndex) => {

            batch.students.forEach(
                (student,studentIndex) => {

                    if(
                        student.active !== false &&
                        student.familyCode === code
                    ){

                        members.push({

                            student:
                                student,

                            batch:
                                batch,

                            batchIndex:
                                batchIndex,

                            studentIndex:
                                studentIndex

                        });

                    }

                }
            );

        }
    );


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

function addStudentToFamily(){

    if(
        profileBatchIndex === null ||
        profileStudentIndex === null
    ){

        return;

    }


    const student =
        batches[
            profileBatchIndex
        ].students[
            profileStudentIndex
        ];


    if(!student){

        return;

    }


    const code =
        prompt(
            "Family Code डालें:\n\nउदाहरण: F001"
        );


    if(code === null){

        return;

    }


    const familyCode =
        code
            .trim()
            .toUpperCase();


    if(!familyCode){

        alert(
            "Family Code खाली नहीं हो सकता।"
        );

        return;

    }


    student.familyCode =
        familyCode;


    saveData();


    updateFamilyProfile(
        student
    );


    render();

}


/* =====================================================
   REMOVE FROM FAMILY
===================================================== */

function removeStudentFromFamily(){

    if(
        profileBatchIndex === null ||
        profileStudentIndex === null
    ){

        return;

    }


    const student =
        batches[
            profileBatchIndex
        ].students[
            profileStudentIndex
        ];


    if(!student){

        return;

    }


    if(!student.familyCode){

        alert(
            "यह बच्चा पहले से Solo है।"
        );

        return;

    }


    const ok =
        confirm(
            `${student.name} को Family से remove करना है?`
        );


    if(!ok){

        return;

    }


    /*
       सिर्फ Family Code हटेगा।
       बच्चा Active रहेगा।
    */

    student.familyCode =
        "";


    saveData();


    updateFamilyProfile(
        student
    );


    render();

}


/* =====================================================
   SEND STUDENT TO INACTIVE
===================================================== */

function sendStudentToInactive(){

    if(
        profileBatchIndex === null ||
        profileStudentIndex === null
    ){

        return;

    }


    const student =
        batches[
            profileBatchIndex
        ].students[
            profileStudentIndex
        ];


    if(!student){

        return;

    }


    const ok =
        confirm(
            `${student.name} को Inactive Students में भेजना है?`
        );


    if(!ok){

        return;

    }


    /*
       Family Code को बरकरार रखा जाएगा।
    */

    student.active =
        false;


    inactiveStudents.push(
        student
    );


    batches[
        profileBatchIndex
    ].students.splice(
        profileStudentIndex,
        1
    );


    saveData();


    closeStudentProfilePage();


    render();

}
/* =====================================================
   CLOSE STUDENT PROFILE
===================================================== */

function closeStudentProfilePage(){

    document.getElementById(
        "studentProfilePage"
    ).style.display =
        "none";


    document.querySelector(
        ".header"
    ).style.display =
        "";


    document.getElementById(
        "batchGrid"
    ).style.display =
        "";


    const inactiveWrap =
        document.querySelector(
            ".inactive-home-wrap"
        );


    if(inactiveWrap){

        inactiveWrap.style.display =
            "";

    }


    profileBatchIndex =
        null;


    profileStudentIndex =
        null;


    render();


    window.scrollTo(
        0,
        0
    );

}


/* =====================================================
   CLOSE PROFILE
===================================================== */

function closeStudentProfile(){

    closeStudentProfilePage();

}


/* =====================================================
   SAVE STUDENT PROFILE
===================================================== */

function saveStudentProfile(){

    if(
        profileBatchIndex === null ||
        profileStudentIndex === null
    ){

        return;

    }


    const student =
        batches[
            profileBatchIndex
        ].students[
            profileStudentIndex
        ];


    if(!student){

        return;

    }


    const input =
        document.getElementById(
            "profileStudentName"
        );


    if(!input){

        return;

    }


    const name =
        input.value.trim();


    if(!name){

        alert(
            "Student का नाम खाली नहीं हो सकता।"
        );

        return;

    }


    student.name =
        name;


    saveData();


    document.getElementById(
        "pageStudentName"
    ).textContent =
        name;


    updateFamilyProfile(
        student
    );


    render();

}


/* =====================================================
   INACTIVE PAGE
===================================================== */

function openInactivePage(){

    document.getElementById(
        "studentProfilePage"
    ).style.display =
        "none";


    document.getElementById(
        "overlay"
    ).style.display =
        "none";


    document.getElementById(
        "profileOverlay"
    ).style.display =
        "none";


    document.querySelector(
        ".header"
    ).style.display =
        "none";


    document.getElementById(
        "batchGrid"
    ).style.display =
        "none";


    const inactiveWrap =
        document.querySelector(
            ".inactive-home-wrap"
        );


    if(inactiveWrap){

        inactiveWrap.style.display =
            "none";

    }


    document.getElementById(
        "inactiveStudentsPage"
    ).style.display =
        "block";


    renderInactiveStudents();


    window.scrollTo(
        0,
        0
    );

}


/* =====================================================
   CLOSE INACTIVE PAGE
===================================================== */

function closeInactivePage(){

    document.getElementById(
        "inactiveStudentsPage"
    ).style.display =
        "none";


    document.querySelector(
        ".header"
    ).style.display =
        "";


    document.getElementById(
        "batchGrid"
    ).style.display =
        "";


    const inactiveWrap =
        document.querySelector(
            ".inactive-home-wrap"
        );


    if(inactiveWrap){

        inactiveWrap.style.display =
            "";

    }


    render();


    window.scrollTo(
        0,
        0
    );

}


/* =====================================================
   RENDER INACTIVE STUDENTS
===================================================== */

function renderInactiveStudents(){

    const list =
        document.getElementById(
            "inactiveStudentList"
        );


    if(!list){

        return;

    }


    if(!inactiveStudents.length){

        list.innerHTML = `

            <div class="empty">

                कोई Inactive Student नहीं है।

            </div>

        `;

        return;

    }


    list.innerHTML =
        inactiveStudents
            .map(
                (student,index) => {

                    const familyText =
                        student.familyCode
                            ? `Family: ${escapeHtml(
                                student.familyCode
                            )}`
                            : "Solo";


                    return `

                        <div
                            class="inactive-student-card"
                        >

                            <div
                                class="inactive-student-number"
                            >
                                ${index + 1}.
                            </div>


                            <div
                                class="inactive-student-info"
                            >

                                <strong>
                                    ${escapeHtml(
                                        student.name
                                    )}
                                </strong>

                                <span>
                                    ${familyText}
                                </span>

                            </div>


                            <button
                                class="small-btn btn-green"
                                onclick="
                                    reactivateStudent(
                                        ${index}
                                    )
                                "
                            >
                                Reactive
                            </button>

                        </div>

                    `;

                }
            )
            .join("");

}


/* =====================================================
   REACTIVE STUDENT
===================================================== */

function reactivateStudent(index){

    const student =
        inactiveStudents[index];


    if(!student){

        return;

    }


    const batchList =
        batches
            .map(
                (batch,i) =>
                    `${i + 1}. ${batch.name} — ${formatTime(batch.time)}`
            )
            .join("\n");


    const target =
        prompt(

            `Student: ${student.name}\n\n` +

            `किस Batch में वापस भेजना है?\n\n` +

            batchList +

            `\n\nBatch number लिखें (1-10):`

        );


    if(target === null){

        return;

    }


    const targetIndex =
        Number(target) - 1;


    if(
        !Number.isInteger(
            targetIndex
        ) ||
        targetIndex < 0 ||
        targetIndex >= batches.length
    ){

        alert(
            "सही Batch number चुनें।"
        );

        return;

    }


    /*
       Student को Active करें
    */

    student.active =
        true;


    /*
       चुने हुए Batch में डालें
    */

    batches[
        targetIndex
    ].students.push(
        student
    );


    /*
       Inactive से हटाएँ
    */

    inactiveStudents.splice(
        index,
        1
    );


    saveData();


    renderInactiveStudents();


    render();

}


/* =====================================================
   HTML ESCAPE
===================================================== */

function escapeHtml(text){

    return String(text)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =====================================================
   OVERLAY EVENTS
===================================================== */

const overlay =
    document.getElementById(
        "overlay"
    );


if(overlay){

    overlay.addEventListener(
        "click",
        e => {

            if(
                e.target.id ===
                "overlay"
            ){

                closeModal();

            }

        }
    );

}


const profileOverlay =
    document.getElementById(
        "profileOverlay"
    );


if(profileOverlay){

    profileOverlay.addEventListener(
        "click",
        e => {

            if(
                e.target.id ===
                "profileOverlay"
            ){

                closeStudentProfile();

            }

        }
    );

}


/* =====================================================
   INITIAL RENDER
===================================================== */

normalizeAllData();

render();


/* =====================================================
   MONGODB / API
===================================================== */

window.API_MODE =
    true;


/* =====================================================
   LOAD BATCHES FROM SERVER
===================================================== */

async function loadBatchesFromServer(){

    try{

        const response =
            await fetch(
                "/api/batches"
            );


        if(!response.ok){

            throw new Error(
                "API error"
            );

        }


        const data =
            await response.json();


        /*
           MongoDB में data नहीं है
        */

        if(
            !Array.isArray(
                data.batches
            )
        ){

            normalizeAllData();


            await saveBatchesToServer();


            render();


            return true;

        }


        /*
           MongoDB source of truth
        */

        batches =
            data.batches;


        inactiveStudents =
            Array.isArray(
                data.inactiveStudents
            )
                ? data.inactiveStudents
                : [];


        normalizeAllData();


        localStorage.setItem(
            "batchManagerData",
            JSON.stringify(
                batches
            )
        );


        localStorage.setItem(
            "inactiveStudentsData",
            JSON.stringify(
                inactiveStudents
            )
        );


        render();


        return true;


    }catch(error){

        console.warn(
            "MongoDB API unavailable; using local browser data.",
            error
        );


        normalizeAllData();


        render();


        return false;

    }

}


/* =====================================================
   SAVE BATCHES + INACTIVE TO SERVER
===================================================== */

async function saveBatchesToServer(){

    try{

        const response =
            await fetch(
                "/api/batches",
                {

                    method:
                        "PUT",

                    headers:{
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            batches:
                                batches,

                            inactiveStudents:
                                inactiveStudents

                        })

                }
            );


        if(!response.ok){

            throw new Error(
                "Save failed"
            );

        }


        const data =
            await response.json();


        if(
            Array.isArray(
                data.batches
            )
        ){

            batches =
                data.batches;

        }


        if(
            Array.isArray(
                data.inactiveStudents
            )
        ){

            inactiveStudents =
                data.inactiveStudents;

        }


        localStorage.setItem(
            "batchManagerData",
            JSON.stringify(
                batches
            )
        );


        localStorage.setItem(
            "inactiveStudentsData",
            JSON.stringify(
                inactiveStudents
            )
        );


        return true;


    }catch(error){

        console.warn(
            "Could not save to MongoDB API.",
            error
        );


        localStorage.setItem(
            "batchManagerData",
            JSON.stringify(
                batches
            )
        );


        localStorage.setItem(
            "inactiveStudentsData",
            JSON.stringify(
                inactiveStudents
            )
        );


        return false;

    }

}


/* =====================================================
   LOAD ON PAGE OPEN
===================================================== */

window.addEventListener(
    "load",
    async () => {

        await loadBatchesFromServer();

    }
);