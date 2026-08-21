const express = require("express");
const router = express.Router();

const { Holiday, AttendanceRecord } = require("../models/Attendance");
const { isMongoReady } = require("../config/db");
const FeeUtils = require("../public/js/10-fee-utils.js");

function requireMongo(req, res, next) {
  if (!isMongoReady()) {
    return res.status(503).json({ success: false, message: "MongoDB is not connected" });
  }
  next();
}
router.use(requireMongo);


/* =====================================================
   MARK / UNMARK ABSENT
   POST /api/attendance/mark
   Body: { studentId, date, absent }
   absent:true creates the (only) record that exists for a
   day; absent:false deletes it — reverting to Auto Present.
===================================================== */
router.post("/mark", async (req, res) => {
  const { studentId, date, absent } = req.body;

  if (!studentId || !date) {
    return res.status(400).json({ success: false, message: "studentId और date जरूरी हैं" });
  }

  try {
    if (absent) {
      await AttendanceRecord.findOneAndUpdate(
        { studentId, date },
        { $set: { studentId, date } },
        { upsert: true }
      );
    } else {
      await AttendanceRecord.deleteOne({ studentId, date });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Save नहीं हुआ" });
  }
});


/* =====================================================
   DAILY VIEW (for the marking UI)
   POST /api/attendance/day
   Body: { date, studentIds: [...] }
   Returns which of the given students are marked Absent
   on that date (everyone else is Auto Present by default).
===================================================== */
router.post("/day", async (req, res) => {
  const { date, studentIds } = req.body;

  if (!date || !Array.isArray(studentIds)) {
    return res.status(400).json({ success: false, message: "date और studentIds जरूरी हैं" });
  }

  try {
    const records = await AttendanceRecord.find({ date, studentId: { $in: studentIds } }).lean();
    res.json({ success: true, absentStudentIds: records.map(r => r.studentId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});


/* =====================================================
   FULL-DAY HOLIDAY  (applies to every batch)
===================================================== */
router.post("/holiday", async (req, res) => {
  const { date, note } = req.body;
  if (!date) {
    return res.status(400).json({ success: false, message: "date जरूरी है" });
  }
  try {
    await Holiday.findOneAndUpdate(
      { date },
      { $set: { date, note: note || "" } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Save नहीं हुआ" });
  }
});

router.post("/holiday/remove", async (req, res) => {
  const { date } = req.body;
  if (!date) {
    return res.status(400).json({ success: false, message: "date जरूरी है" });
  }
  try {
    await Holiday.deleteOne({ date });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Remove नहीं हो सका" });
  }
});

router.get("/holidays", async (req, res) => {
  const { month } = req.query;
  try {
    const filter = month ? { date: { $regex: "^" + month } } : {};
    const holidays = await Holiday.find(filter).sort({ date: 1 }).lean();
    res.json({ success: true, holidays });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});


/* Pure day-by-day status calculator — no DB access, easy to
   test in isolation. Exported for reuse/testing. */
function computeMonthCalendar({ year, month, weeklyHolidays, holidayDates, absentDates, joinedTimestamp, todayIso }) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const iso = `${ year }-${ String(month).padStart(2, "0") }-${ String(d).padStart(2, "0") }`;
    const weekday = dateObj.getDay();

    let status;
    if (joinedTimestamp && dateObj.getTime() < joinedTimestamp) {
      status = "before-joining";
    } else if (todayIso && iso > todayIso) {
      status = "future";
    } else if (holidayDates.includes(iso)) {
      status = "holiday";
    } else if (weeklyHolidays.includes(weekday)) {
      status = "weekly-holiday";
    } else if (absentDates.includes(iso)) {
      status = "absent";
    } else {
      status = "present";
    }

    days.push({ date: iso, day: d, weekday, status });
  }

  return days;
}


/* =====================================================
   MONTHLY CALENDAR FOR ONE STUDENT
   GET /api/attendance/calendar/:studentId
     ?month=YYYY-MM&weeklyHolidays=0,3
   weeklyHolidays comes from the student's batch (the app
   already has this locally — no need for the server to
   resolve it separately).
===================================================== */
router.get("/calendar/:studentId", async (req, res) => {
  const { studentId } = req.params;
  const { month, weeklyHolidays } = req.query;

  if (!month) {
    return res.status(400).json({ success: false, message: "month जरूरी है" });
  }

  try {
    const [year, m] = month.split("-").map(Number);

    const holidayDocs = await Holiday.find({ date: { $regex: "^" + month } }).lean();
    const absentDocs = await AttendanceRecord.find({ studentId, date: { $regex: "^" + month } }).lean();

    // the student's own id embeds its creation time ("S-<timestamp>-<rand>") —
    // used as a best-effort "joined around" boundary so days before a student
    // existed in the system don't show as Present
    let joinedTimestamp = null;
    const idParts = studentId.split("-");
    if (idParts.length >= 2 && !Number.isNaN(Number(idParts[1]))) {
      joinedTimestamp = Number(idParts[1]);
    }

    const days = computeMonthCalendar({
      year,
      month: m,
      weeklyHolidays: (weeklyHolidays || "").split(",").filter(x => x !== "").map(Number),
      holidayDates: holidayDocs.map(h => h.date),
      absentDates: absentDocs.map(a => a.date),
      joinedTimestamp,
      todayIso: FeeUtils.todayISO()
    });

    const presentCount = days.filter(d => d.status === "present").length;
    const absentCount = days.filter(d => d.status === "absent").length;
    const totalClassDays = presentCount + absentCount;
    const percentage = totalClassDays > 0 ? Math.round((presentCount / totalClassDays) * 100) : null;

    res.json({
      success: true,
      month,
      days,
      presentCount,
      absentCount,
      totalClassDays,
      percentage
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});


module.exports = router;
