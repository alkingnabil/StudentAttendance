const mongoose = require("mongoose");
const monthSchema = new mongoose.Schema({
  faculty: { type: String, required: true },
  month: { type: String, required: true },
  lectures: { type: Number, required: true },
  evaluationDate: { type: String }
});
module.exports = mongoose.model("Month", monthSchema);