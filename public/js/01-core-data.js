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
let currentBatch = null;
let profileBatchIndex = null;
let profileStudentIndex = null;
/* =====================================================
   CREATE STUDENT
===================================================== */
function createStudent(name) {
  return {
    id: "S-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    name: String(name),
    familyCode: "",
    active: true
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
  batches.forEach(batch => {
    if (!Array.isArray(batch.students)) {
      batch.students = [];
    }
    batch.students = batch.students.map(normalizeStudent).filter(student => student.name);
  });
  inactiveStudents = inactiveStudents.map(normalizeStudent).filter(student => student.name);
  /*
       पुराने inactive students को
       active batch में नहीं रहने देंगे।
    */
  batches.forEach(batch => {
    const activeStudents = [];
    batch.students.forEach(student => {
      if (student.active === false) {
        inactiveStudents.push(student);
      } else {
        activeStudents.push(student);
      }
    });
    batch.students = activeStudents;
  });
  /*
       Duplicate inactive records हटाएँ।
    */
  const seen = new Set();
  inactiveStudents = inactiveStudents.filter(student => {
    if (seen.has(student.id)) {
      return false;
    }
    seen.add(student.id);
    return true;
  });
}
