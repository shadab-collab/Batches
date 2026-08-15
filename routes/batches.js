const express = require("express");
const router = express.Router();
const {BatchData} = require("../models/BatchData");
const {isMongoReady} = require("../config/db");
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
    const record = await BatchData.findOne({ key: "main" }).lean();
    if (!record) {
      return res.json({
        batches: null,
        inactiveStudents: []
      });
    }
    res.json({
      batches: record.batches || [],
      inactiveStudents: record.inactiveStudents || []
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
    const {batches, inactiveStudents} = req.body;
    if (!Array.isArray(batches)) {
      return res.status(400).json({
        success: false,
        message: "batches must be an array"
      });
    }
    const saved = await BatchData.findOneAndUpdate({ key: "main" }, {
      $set: {
        key: "main",
        batches,
        inactiveStudents: Array.isArray(inactiveStudents) ? inactiveStudents : []
      }
    }, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }).lean();
    res.json({
      success: true,
      batches: saved.batches || [],
      inactiveStudents: saved.inactiveStudents || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Could not save batches"
    });
  }
});
module.exports = router;