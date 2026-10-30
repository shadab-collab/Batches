const express = require("express");
const router = express.Router();

const { Attendance } = require("../models/Attendance");
const { isMongoReady } = require("../config/db");

function requireMongo(req, res, next) {
  if (!isMongoReady()) {
    return res.status(503).send("MongoDB is not connected");
  }
  next();
}
router.use(requireMongo);

/* =====================================================
   MARK PRESENT
   POST /api/attendance/mark
   body: { studentId, batchId, date }
   {studentId, date} पर unique index है, इसलिए दुबारा Mark करने पर भी
   कुछ नहीं बदलता — Count कभी दो बार नहीं बढ़ता।
===================================================== */
router.post("/mark", async (req, res) => {
  const { studentId, batchId, date } = req.body;
  if (!studentId || !date) {
    return res.status(400).json({ success: false, message: "studentId और date ज़रूरी हैं" });
  }
  try {
    await Attendance.findOneAndUpdate(
      { studentId, date },
      { $setOnInsert: { studentId, date, batchId: batchId || "" } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Mark नहीं हो सका" });
  }
});

/* =====================================================
   UNMARK (गलती से लग गई Attendance हटाना)
   POST /api/attendance/unmark
   body: { studentId, date }
===================================================== */
router.post("/unmark", async (req, res) => {
  const { studentId, date } = req.body;
  if (!studentId || !date) {
    return res.status(400).json({ success: false, message: "studentId और date ज़रूरी हैं" });
  }
  try {
    await Attendance.deleteOne({ studentId, date });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "हटाया नहीं जा सका" });
  }
});

/* =====================================================
   TODAY की सभी Attendance (Attendance पेज खोलते वक़्त — किसको आज
   पहले ही Present मार्क किया जा चुका है, वो दिखाने के लिए)
   GET /api/attendance/on/:date
===================================================== */
router.get("/on/:date", async (req, res) => {
  try {
    const rows = await Attendance.find({ date: req.params.date }).lean();
    res.json({ success: true, studentIds: rows.map(r => r.studentId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});

/* =====================================================
   इस महीने हर student की Present-count (Attendance पेज के counter
   badge के लिए — एक ही बार में सबका count)
   GET /api/attendance/month-counts/:yearMonth   (yearMonth जैसे "2026-10")
===================================================== */
router.get("/month-counts/:yearMonth", async (req, res) => {
  try {
    const { yearMonth } = req.params;
    const rows = await Attendance.find({ date: { $regex: `^${ yearMonth }` } }).lean();
    const counts = {};
    rows.forEach(r => {
      counts[r.studentId] = (counts[r.studentId] || 0) + 1;
    });
    res.json({ success: true, counts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});

/* =====================================================
   एक student की एक महीने की पूरी तारीख-दर-तारीख List (Profile वाले
   Summary और आगे Monthly Calendar के लिए)
   GET /api/attendance/student/:studentId/:yearMonth
===================================================== */
router.get("/student/:studentId/:yearMonth", async (req, res) => {
  try {
    const { studentId, yearMonth } = req.params;
    const rows = await Attendance.find({ studentId, date: { $regex: `^${ yearMonth }` } }).lean();
    res.json({ success: true, dates: rows.map(r => r.date).sort() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});

module.exports = router;
