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

const batchDataSchema = new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    batches: { type: [batchSchema], default: [] }
}, { timestamps: true });

const BatchData = mongoose.model("BatchData", batchDataSchema);

let mongoReady = false;

async function connectMongo() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.error("MONGODB_URI is not set.");
        return;
    }

    try {
        await mongoose.connect(uri);
        mongoReady = true;
        console.log("MongoDB connected.");
    } catch (error) {
        mongoReady = false;
        console.error("MongoDB connection failed:", error.message);
    }
}

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        mongodb: mongoReady,
        message: "Batch Manager is running"
    });
});

app.get("/api/batches", async (req, res) => {
    if (!mongoReady) {
        return res.status(503).json({
            success: false,
            message: "MongoDB is not connected"
        });
    }

    try {
        const record = await BatchData
            .findOne({ key: "main" })
            .lean();

        if (!record) {
            return res.json({
                batches: null
            });
        }

        res.json({
            batches: record.batches
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Could not load batches"
        });
    }
});

app.put("/api/batches", async (req, res) => {
    if (!mongoReady) {
        return res.status(503).json({
            success: false,
            message: "MongoDB is not connected"
        });
    }

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
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));


/* =====================================================
   STUDENT
===================================================== */

const studentSchema = new mongoose.Schema({

    id: {
        type: String,
        required: true
    },

    name: {
        type: String,
        required: true
    },

    familyCode: {
        type: String,
        default: ""
    },

    active: {
        type: Boolean,
        default: true
    }

}, { _id: false });


/* =====================================================
   BATCH
===================================================== */

const batchSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },

    time: {
        type: String,
        default: ""
    },

    students: {
        type: [studentSchema],
        default: []
    }

}, { _id: false });


/* =====================================================
   BATCH DATA
===================================================== */

const batchDataSchema = new mongoose.Schema({

    key: {
        type: String,
        unique: true,
        required: true
    },

    batches: {
        type: [batchSchema],
        default: []
    },

    inactiveStudents: {
        type: [studentSchema],
        default: []
    }

}, { timestamps: true });


const BatchData =
    mongoose.model(
        "BatchData",
        batchDataSchema
    );


let mongoReady = false;


/* =====================================================
   MONGODB CONNECTION
===================================================== */

async function connectMongo(){

    const uri =
        process.env.MONGODB_URI;


    if(!uri){

        console.error(
            "MONGODB_URI is not set."
        );

        return;

    }


    try{

        await mongoose.connect(uri);

        mongoReady = true;

        console.log(
            "MongoDB connected."
        );

    }catch(error){

        mongoReady = false;

        console.error(
            "MongoDB connection failed:",
            error.message
        );

    }

}


/* =====================================================
   HOME
===================================================== */

app.get(
    "/",
    (req,res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


/* =====================================================
   HEALTH
===================================================== */

app.get(
    "/api/health",
    (req,res) => {

        res.json({

            success: true,

            mongodb: mongoReady,

            message:
                "Batch Manager is running"

        });

    }
);


/* =====================================================
   GET BATCH DATA
===================================================== */

app.get(
    "/api/batches",
    async (req,res) => {

        if(!mongoReady){

            return res.status(503).json({

                success: false,

                message:
                    "MongoDB is not connected"

            });

        }


        try{

            const record =
                await BatchData
                    .findOne({
                        key: "main"
                    })
                    .lean();


            if(!record){

                return res.json({

                    batches: null,

                    inactiveStudents: []

                });

            }


            res.json({

                batches:
                    record.batches || [],

                inactiveStudents:
                    record.inactiveStudents || []

            });


        }catch(error){

            console.error(error);


            res.status(500).json({

                success: false,

                message:
                    "Could not load batches"

            });

        }

    }
);


/* =====================================================
   SAVE BATCH DATA
===================================================== */

app.put(
    "/api/batches",
    async (req,res) => {

        if(!mongoReady){

            return res.status(503).json({

                success: false,

                message:
                    "MongoDB is not connected"

            });

        }


        try{

            const {
                batches,
                inactiveStudents
            } = req.body;


            if(!Array.isArray(batches)){

                return res.status(400).json({

                    success: false,

                    message:
                        "batches must be an array"

                });

            }


            const saved =
                await BatchData.findOneAndUpdate(

                    {
                        key: "main"
                    },

                    {

                        $set: {

                            key: "main",

                            batches,

                            inactiveStudents:
                                Array.isArray(
                                    inactiveStudents
                                )
                                    ? inactiveStudents
                                    : []

                        }

                    },

                    {

                        upsert: true,

                        new: true,

                        setDefaultsOnInsert:
                            true

                    }

                ).lean();


            res.json({

                success: true,

                batches:
                    saved.batches,

                inactiveStudents:
                    saved.inactiveStudents || []

            });


        }catch(error){

            console.error(error);


            res.status(500).json({

                success: false,

                message:
                    "Could not save batches"

            });

        }

    }
);


/* =====================================================
   START SERVER
===================================================== */

connectMongo().then(() => {

    app.listen(
        PORT,
        "0.0.0.0",
        () => {

            console.log(
                `Batch Manager running on port ${PORT}`
            );

        }
    );

});