const defaultBatches = [
  {
    name: "Batch 1",
    time: "",
    students: []
  },
  {
    name: "Batch 2",
    time: "",
    students: []
  },
  {
    name: "Batch 3",
    time: "",
    students: []
  },
  {
    name: "Batch 4",
    time: "",
    students: []
  },
  {
    name: "Batch 5",
    time: "",
    students: []
  },
  {
    name: "Batch 6",
    time: "14:30",
    students: [
      "Sana",
      "Yusra",
      "Sidra",
      "Sarim",
      "Sariha",
      "Ryaan",
      "Zishan",
      "Arif",
      "Aaquib",
      "Saif",
      "Saad",
      "Aasifa",
      "Affan",
      "Almas"
    ]
  },
  {
    name: "Batch 7",
    time: "15:30",
    students: [
      "Atif",
      "Kasif",
      "asad",
      "Sajid",
      "Wajid",
      "Ayaan",
      "Ayaan",
      "fatima",
      "Zohra",
      "Eeram",
      "piyush",
      "Zaid"
    ]
  },
  {
    name: "Batch 8",
    time: "16:30",
    students: [
      "Imran",
      "Sumaiya",
      "Sohail",
      "Arshad",
      "Kasif",
      "Abhiraaz",
      "Arisfa",
      "Misty",
      "Rishiraaz",
      "Arham",
      "Talib",
      "Tausif",
      "GuFran",
      "Neha",
      "Khadija"
    ]
  },
  {
    name: "Batch 9",
    time: "17:30",
    students: [
      "Surbhi",
      "Minsa",
      "Sadiya",
      "Saif",
      "Mariya",
      "Yusuf",
      "Rehan",
      "Adil",
      "Zikra",
      "Sayra",
      "Samya",
      "Nurfiya",
      "Aamna",
      "Ruhani"
    ]
  },
  {
    name: "Batch 10",
    time: "18:30",
    students: [
      "Yusuf",
      "Alsaba",
      "Atif",
      "Harish",
      "Arfa",
      "Ayaan",
      "Almas",
      "Salman",
      "Aman",
      "Aadil",
      "Raunak",
      "Raushan",
      "Arshalan",
      "Samreen",
      "Mahreen"
    ]
  }
];
const DATA_VERSION = "4";
let batches = [];
let inactiveStudents = [];
let awayStudents = [];
let todos = [];
let currentBatch = null;
let profileBatchIndex = null;
let profileStudentIndex = null;
let profileInactiveIndex = null;
let profileAwayIndex = null;
/* =====================================================
   CREATE STUDENT
===================================================== */
function createStudent(name) {
  return {
    id: "S-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    name: String(name),
    familyCode: "",
    active: true,
    admissionDate: (typeof FeeUtils !== "undefined" ? FeeUtils.todayISO() : ""),
    feeHistoryKeys: [],
    awaySince: "",
    awayBatchId: "",
    awayBatchName: "",
    feeFree: false
  };
}
/* =====================================================
   NORMALIZE STUDENT
===================================================== */
function normalizeStudent(student) {
  /*
       पुराने data में student सिर्फ string था।
    */
  if (typeof student === "string") {
    return createStudent(student);
  }
  if (!student || typeof student !== "object") {
    return createStudent("");
  }
  if (!student.id) {
    student.id = "S-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  }
  if (typeof student.name !== "string") {
    student.name = "";
  }
  if (typeof student.familyCode !== "string") {
    student.familyCode = "";
  }
  if (typeof student.active !== "boolean") {
    student.active = true;
  }
  if (typeof student.inactiveSince !== "string") {
    student.inactiveSince = "";
  }
  if (typeof student.expelled !== "boolean") {
    student.expelled = false;
  }
  if (typeof student.identity !== "string") {
    student.identity = "";
  }
  if (typeof student.listCodeName !== "string") {
    student.listCodeName = "";
  }
  if (typeof student.batchId !== "string") {
    student.batchId = "";
  }
  if (typeof student.admissionDate !== "string") {
    student.admissionDate = "";
  }
  if (!Array.isArray(student.feeHistoryKeys)) {
    student.feeHistoryKeys = [];
  }
  if (typeof student.awaySince !== "string") {
    student.awaySince = "";
  }
  if (typeof student.awayBatchId !== "string") {
    student.awayBatchId = "";
  }
  if (typeof student.awayBatchName !== "string") {
    student.awayBatchName = "";
  }
  if (typeof student.feeFree !== "boolean") {
    student.feeFree = false;
  }
  return student;
}
/* =====================================================
   NORMALIZE ALL DATA
===================================================== */
function normalizeAllData() {
  if (!Array.isArray(batches)) {
    batches = [];
  }
  if (!Array.isArray(inactiveStudents)) {
    inactiveStudents = [];
  }
  if (!Array.isArray(awayStudents)) {
    awayStudents = [];
  }
  if (!Array.isArray(todos)) {
    todos = [];
  }
  todos = todos.filter(t => t && typeof t.text === "string" && t.text.trim());
  todos.forEach(t => {
    if (!t.id) {
      t.id = "T-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    }
    if (typeof t.done !== "boolean") {
      t.done = false;
    }
    if (t.targetType !== "student") {
      t.targetType = "all";
      t.targetStudentId = "";
      t.targetStudentName = "";
    }
  });
  batches.forEach(batch => {
    if (!Array.isArray(batch.students)) {
      batch.students = [];
    }
    if (!batch.id) {
      batch.id = "B-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    }
    if (!Array.isArray(batch.weeklyHolidays)) {
      batch.weeklyHolidays = [];
    }
    batch.students = batch.students.map(normalizeStudent).filter(student => student.name);
    /*
         हर active student का batchId हमेशा
         उसके असली current batch से sync रहे —
         attendance को batch से जोड़ने के लिए ज़रूरी।
      */
    batch.students.forEach(student => {
      student.batchId = batch.id;
    });
  });
  inactiveStudents = inactiveStudents.map(normalizeStudent).filter(student => student.name);
  awayStudents = awayStudents.map(normalizeStudent).filter(student => student.name);
  /*
       पुराने inactive students को
       active batch में नहीं रहने देंगे।
       (साथ ही, किसी पुराने/अधूरे save से बच गया कोई
       "away:true" flag वाला student अगर अब भी किसी
       batch के अंदर मिले, उसे यहीं awayStudents में
       transfer कर दिया जाता है — एक बार की सफाई।)
    */
  batches.forEach(batch => {
    const activeStudents = [];
    batch.students.forEach(student => {
      if (student.active === false) {
        inactiveStudents.push(student);
      } else if (student.away === true) {
        student.awayBatchId = student.awayBatchId || batch.id;
        student.awayBatchName = student.awayBatchName || batch.name;
        delete student.away;
        awayStudents.push(student);
      } else {
        activeStudents.push(student);
      }
    });
    batch.students = activeStudents;
  });
  /*
       Duplicate inactive/away records हटाएँ।
    */
  const seen = new Set();
  inactiveStudents = inactiveStudents.filter(student => {
    if (seen.has(student.id)) {
      return false;
    }
    seen.add(student.id);
    return true;
  });
  const seenAway = new Set();
  awayStudents = awayStudents.filter(student => {
    if (seenAway.has(student.id)) {
      return false;
    }
    seenAway.add(student.id);
    return true;
  });
}
