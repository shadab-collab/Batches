const express = require("express");
const path = require("path");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const batchSchema = new mongoose.Schema({
    name: { type: String, required: true },
    time: { type: String, default: "" },
    students: { type: [String], default: [] }
}, { _id: false });

const settingsSchema = new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    batches: { type: [batchSchema], default: [] }
}, { timestamps: true });

const BatchData = mongoose.model("BatchData", settingsSchema);

async function connectMongo() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.error("MONGODB_URI is not set.");
        return false;
    }

    try {
        await mongoose.connect(uri);
        console.log("MongoDB connected.");
        return true;
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        return false;
    }
}

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        mongodb: mongoose.connection.readyState === 1,
        message: "Batch Manager is running"
    });
});

app.get("/api/batches", async (req, res) => {
    try {
        const record = await BatchData.findOne({ key: "main" }).lean();

        if (!record) {
            return res.json({ batches: null });
        }

        res.json({ batches: record.batches });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Could not load batches"
        });
    }
});

app.put("/api/batches", async (req, res) => {
    try {
        const { batches } = req.body;

        if (!Array.isArray(batches)) {
            return res.status(400).json({
                success: false,
                message: "batches must be an array"
            });
        }

        const saved = await BatchData.findOneAndUpdate(
            { key: "main" },
            {
                $set: {
                    key: "main",
                    batches
                }
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        ).lean();

        res.json({
            success: true,
            batches: saved.batches
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Could not save batches"
        });
    }
});

connectMongo().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Batch Manager running on port ${PORT}`);
    });
});
