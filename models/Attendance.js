const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // `${nationalId}|${date}`
  faculty: { type: String, required: true },
  nationalId: { type: String, required: true },
  code: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  time: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Attendance", attendanceSchema);