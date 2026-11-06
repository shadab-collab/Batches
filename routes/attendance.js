const express = require("express");
const router = express.Router();

const { Attendance } = require("../models/Attendance");
const { AttendanceConfig } = require("../models/AttendanceConfig");
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

/* =====================================================
   किसी Batch के सभी बच्चों को एक साथ Present (फिर जो नहीं आए उन्हें
   अलग से हटाया जाता है) — पहले से Present वालों पर कुछ असर नहीं
   POST /api/attendance/mark-many
   body: { date, items: [{ studentId, batchId }] }
===================================================== */
router.post("/mark-many", async (req, res) => {
  const { date, items } = req.body;
  if (!date || !Array.isArray(items)) {
    return res.status(400).json({ success: false, message: "date और items ज़रूरी हैं" });
  }
  try {
    const ops = items
      .filter(item => item && item.studentId)
      .map(item => ({
        updateOne: {
          filter: { studentId: item.studentId, date },
          update: { $setOnInsert: { studentId: item.studentId, date, batchId: item.batchId || "" } },
          upsert: true
        }
      }));
    if (ops.length) {
      await Attendance.bulkWrite(ops, { ordered: false });
    }
    res.json({ success: true, count: ops.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Mark नहीं हो सका" });
  }
});

/* =====================================================
   छुट्टियों की सेटिंग
   GET  /api/attendance/config
   POST /api/attendance/config/weekly-holiday   { batchId, day | null }
   POST /api/attendance/config/festival         { date, label, batchIds }  (batchIds खाली = सभी Batch)
   POST /api/attendance/config/festival/remove  { date }
===================================================== */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/config", async (req, res) => {
  try {
    const cfg = await AttendanceConfig.findOne({ key: "main" }).lean();
    res.json({
      success: true,
      weekly: (cfg && cfg.weekly) || [],
      holidays: (cfg && cfg.holidays) || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});

router.post("/config/weekly-holiday", async (req, res) => {
  const { batchId } = req.body;
  const rawDay = req.body.day;
  if (!batchId) {
    return res.status(400).json({ success: false, message: "batchId ज़रूरी है" });
  }
  const day = (rawDay === null || rawDay === undefined || rawDay === "") ? null : Number(rawDay);
  if (day !== null && !(Number.isInteger(day) && day >= 0 && day <= 6)) {
    return res.status(400).json({ success: false, message: "day 0 से 6 के बीच होना चाहिए" });
  }
  try {
    await AttendanceConfig.updateOne({ key: "main" }, { $pull: { weekly: { batchId } } }, { upsert: true });
    if (day !== null) {
      await AttendanceConfig.updateOne({ key: "main" }, { $push: { weekly: { batchId, day } } });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Save नहीं हो सका" });
  }
});

router.post("/config/festival", async (req, res) => {
  const { date } = req.body;
  const label = String(req.body.label || "").trim().slice(0, 60);
  // batchIds खाली = सभी Batch; वरना सिर्फ वही Batch जिनकी list आई है
  const batchIds = Array.isArray(req.body.batchIds)
    ? Array.from(new Set(req.body.batchIds.map(id => String(id)).filter(Boolean))).sort()
    : [];
  if (!ISO_DATE.test(String(date || ""))) {
    return res.status(400).json({ success: false, message: "सही तारीख चुनें" });
  }
  try {
    // एक तारीख की एक ही entry रहती है — दुबारा जोड़ने पर वो नई सेटिंग से बदल जाती है
    await AttendanceConfig.updateOne({ key: "main" }, { $pull: { holidays: { date } } }, { upsert: true });
    await AttendanceConfig.updateOne({ key: "main" }, { $push: { holidays: { date, label, batchIds } } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Save नहीं हो सका" });
  }
});

router.post("/config/festival/remove", async (req, res) => {
  const { date } = req.body;
  if (!date) {
    return res.status(400).json({ success: false, message: "date ज़रूरी है" });
  }
  try {
    await AttendanceConfig.updateOne({ key: "main" }, { $pull: { holidays: { date } } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "हटाया नहीं जा सका" });
  }
});

module.exports = router;
