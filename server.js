const express = require("express");
const path = require("path");
const { connectMongo } = require("./config/db");
const batchesRouter = require("./routes/batches");
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
/* =====================================================
   HOME
===================================================== */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
/* =====================================================
   API ROUTES
   (add new feature routers here as the project grows —
    e.g. routes/fees.js, routes/attendance.js)
===================================================== */
app.use("/api", batchesRouter);
/* =====================================================
   START SERVER
===================================================== */
connectMongo().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Batch Manager running on port ${ PORT }`);
  });
});