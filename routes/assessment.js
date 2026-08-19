const express = require("express");
const router = express.Router();

const { Assessment } = require("../models/Assessment");
const { isMongoReady } = require("../config/db");

const SECTIONS = ["improvementEntries", "gapEntries"];

function requireMongo(req, res, next) {
  if (!isMongoReady()) {
    return res.status(503).json({ success: false, message: "MongoDB is not connected" });
  }
  next();
}
router.use(requireMongo);

function sectionField(section) {
  if (section === "improvement") {
    return "improvementEntries";
  }
  if (section === "gap") {
    return "gapEntries";
  }
  return null;
}


/* =====================================================
   GET CARD  GET /api/assessment/:studentId
===================================================== */
router.get("/:studentId", async (req, res) => {
  try {
    const card = await Assessment.findOne({ studentId: req.params.studentId }).lean();
    res.json({
      success: true,
      card: card || {
        studentId: req.params.studentId,
        studentClass: "",
        period: "",
        teacherComment: "",
        improvementEntries: [],
        gapEntries: []
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});


/* =====================================================
   UPDATE META  POST /api/assessment/:studentId/meta
   Body: { studentClass, period, teacherComment }
===================================================== */
router.post("/:studentId/meta", async (req, res) => {
  const { studentClass, period, teacherComment } = req.body;
  try {
    const card = await Assessment.findOneAndUpdate(
      { studentId: req.params.studentId },
      {
        $set: {
          studentId: req.params.studentId,
          studentClass: studentClass || "",
          period: period || "",
          teacherComment: teacherComment || ""
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, card });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Save नहीं हुआ" });
  }
});


/* =====================================================
   ADD ENTRY  POST /api/assessment/:studentId/entry
   Body: { section: "improvement" | "gap", text }
   Always inserted at the front; the 7th entry pushes the
   oldest (6th) one out.
===================================================== */
router.post("/:studentId/entry", async (req, res) => {
  const { section, text } = req.body;
  const field = sectionField(section);

  if (!field || !text || !text.trim()) {
    return res.status(400).json({ success: false, message: "section और text जरूरी हैं" });
  }

  try {
    let card = await Assessment.findOne({ studentId: req.params.studentId });
    if (!card) {
      card = new Assessment({ studentId: req.params.studentId });
    }
    card[field] = [text.trim(), ...card[field]].slice(0, 6);
    await card.save();

    res.json({ success: true, card });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Save नहीं हुआ" });
  }
});


/* =====================================================
   REMOVE ONE ENTRY  POST /api/assessment/:studentId/entry/remove
   Body: { section, index }
===================================================== */
router.post("/:studentId/entry/remove", async (req, res) => {
  const { section, index } = req.body;
  const field = sectionField(section);

  if (!field || typeof index !== "number") {
    return res.status(400).json({ success: false, message: "section और index जरूरी हैं" });
  }

  try {
    const card = await Assessment.findOne({ studentId: req.params.studentId });
    if (!card) {
      return res.json({ success: true });
    }
    card[field].splice(index, 1);
    await card.save();

    res.json({ success: true, card });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Remove नहीं हो सका" });
  }
});


module.exports = router;
