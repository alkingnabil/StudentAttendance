const configSchema = new mongoose.Schema({
  locations: [String],
  facultyMembers: [String],
  assistants: [String],
  lectureGrade: { "3": { type: Number, default: 2 }, "4": { type: Number, default: 2 } },
  approved: { "3": { type: Boolean, default: false }, "4": { type: Boolean, default: false } },
  evaluationSession: {
    faculty: String,
    month: String,
    date: String,
    max: Number
  }
});
module.exports = mongoose.model("Config", configSchema);