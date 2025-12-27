const mongoose = require("mongoose");

const PropertySchema = new mongoose.Schema(
  {
    title: String,
    price: Number,
    negotiable: Boolean,
    location: String,
    bedrooms: Number,
    bathrooms: Number,
    description: String,
    category: String,
    carpetArea: Number,
    builtupArea: Number,
    images: [String],
    videos: [String],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Property", PropertySchema);
