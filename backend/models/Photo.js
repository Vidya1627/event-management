const mongoose = require('mongoose');

const PhotoSchema = new mongoose.Schema({
    url: String,
    filename: String,
    tags: [String],
    size: Number,
    location: {
        latitude: Number,  // Raw GPS latitude
        longitude: Number  // Raw GPS longitude
    },
    clickedAt: Date,
    uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Photo', PhotoSchema);
