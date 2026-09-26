const express = require("express");
const router = express.Router();
const { BatchData } = require("../models/BatchData");
const { isMongoReady } = require("../config/db");
const { getNextCounterValue } = require("../models/Counter");
/* =====================================================
   HEALTH
===================================================== */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    mongodb: isMongoReady(),
    message: "Batch Manager is running"
  });
});
/* =====================================================
   GET BATCH DATA
===================================================== */
router.get("/batches", async (req, res) => {
  if (!isMongoReady()) {
    return res.status(503).json({
      success: false,
      message: "MongoDB is not connected"
    });
  }
  try {
    /*
         "key: main" के दो/ज़्यादा document हो सकते हैं (पुराने किसी
         race की वजह से — जैसे बहुत जल्दी-जल्दी हुई दो Save request
         एक साथ upsert करने की कोशिश करें)। ऐसे हालात में बिना sort
         के findOne() किसी भी एक को उठा सकता है — जो ज़रूरी नहीं कि
         वही हो जिसमें अभी-अभी हुआ बदलाव Save हुआ था। इसीलिए हमेशा
         सबसे हाल में updated document ही लिया जाता है, चाहे और भी
         पुराने duplicate document क्यों न पड़े हों।
      */
    const record = await BatchData.findOne({ key: "main" }).sort({ updatedAt: -1 }).lean();
    if (!record) {
      return res.json({
        batches: null,
        inactiveStudents: [],
        awayStudents: [],
        todos: []
      });
    }
    res.json({
      batches: record.batches || [],
      inactiveStudents: record.inactiveStudents || [],
      awayStudents: record.awayStudents || [],
      todos: record.todos || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Could not load batches"
    });
  }
});
/* =====================================================
   SAVE BATCH DATA
===================================================== */
router.put("/batches", async (req, res) => {
  if (!isMongoReady()) {
    return res.status(503).json({
      success: false,
      message: "MongoDB is not connected"
    });
  }
  try {
    const { batches, inactiveStudents, awayStudents, todos } = req.body;
    if (!Array.isArray(batches)) {
      return res.status(400).json({
        success: false,
        message: "batches must be an array"
      });
    }
    /*
         findOneAndUpdate({key:"main"}) सिर्फ ज़्यादा से ज़्यादा एक ही
         document match/update करता है — अगर "main" key वाले 2+
         document पहले से मौजूद हों (पुराने race से बचे हुए), तो
         हमेशा सबसे हाल में updated वाले को ही update करें (updatedAt
         से sort करके उसकी _id पकड़ें), ताकि हर बार Save और उसके बाद
         का Read हमेशा एक ही असली document पर हों। बाकी बचे किसी भी
         पुराने duplicate "main" document को यहीं permanently हटा भी
         दिया जाता है, ताकि आगे कभी वो दोबारा गलती से न पढ़ा जाए।
      */
    const latestExisting = await BatchData.findOne({ key: "main" }).sort({ updatedAt: -1 }).select("_id").lean();
    const update = {
      $set: {
        key: "main",
        batches,
        inactiveStudents: Array.isArray(inactiveStudents) ? inactiveStudents : [],
        awayStudents: Array.isArray(awayStudents) ? awayStudents : [],
        todos: Array.isArray(todos) ? todos : []
      }
    };
    const saved = latestExisting ?
      await BatchData.findByIdAndUpdate(latestExisting._id, update, { new: true }).lean() :
      await BatchData.findOneAndUpdate({ key: "main" }, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }).lean();
    const deleted = await BatchData.deleteMany({ key: "main", _id: { $ne: saved._id } });
    if (deleted.deletedCount) {
      console.warn(`Removed ${ deleted.deletedCount } stray duplicate "main" BatchData document(s).`);
    }
    res.json({
      success: true,
      batches: saved.batches || [],
      inactiveStudents: saved.inactiveStudents || [],
      awayStudents: saved.awayStudents || [],
      todos: saved.todos || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Could not save batches"
    });
  }
});

/* =====================================================
   NEXT FAMILY CODE
   Auto-incrementing, never reused (F001, F002, ...) — so a
   brand-new family can never accidentally collide with an
   old family code whose members have all left.
===================================================== */
router.post("/family-code/next", async (req, res) => {
  if (!isMongoReady()) {
    return res.status(503).json({
      success: false,
      message: "MongoDB is not connected"
    });
  }
  try {
    const n = await getNextCounterValue("familyCode", 0);
    const code = "F" + String(n).padStart(3, "0");
    res.json({ success: true, code });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Could not generate Family Code"
    });
  }
});

module.exports = router;