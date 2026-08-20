const mongoose = require("mongoose");

const evaluationSchema = new mongoose.Schema({
  faculty: { type: String, required: true },
  nationalId: { type: String, required: true },
  code: { type: String, required: true },
  month: { type: String, required: true },
  date: { type: String, required: true },
  score: { type: Number, required: true },
  max: { type: Number, required: true }
}, { timestamps: true });

evaluationSchema.index({ faculty: 1, code: 1, month: 1 }, { unique: true });
module.exports = mongoose.model("Evaluation", evaluationSchema);