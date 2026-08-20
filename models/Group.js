const mongoose = require("mongoose");
const groupSchema = new mongoose.Schema({
  faculty: { type: String, required: true },
  group: { type: String, required: true },
  location: String,
  facultyMember: String,
  assistant: String,
  external: String
});
groupSchema.index({ faculty: 1, group: 1 }, { unique: true });
module.exports = mongoose.model("Group", groupSchema);