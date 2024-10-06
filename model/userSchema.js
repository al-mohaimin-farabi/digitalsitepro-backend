const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
  name: {
    type: string,
    requred: true,
  },
  email: {
    type: string,
    requred: true,
  },
});
