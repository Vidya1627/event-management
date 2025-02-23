const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const Photo = require('../models/Photo');
const ExifParser = require('exif-parser');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Bulk Upload Route
router.post('/upload', upload.array('images', 100), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No files uploaded!" });
        }

        let uploadedPhotos = [];

        // Process each image
        for (const file of req.files) {
            let clickedAt = new Date();
            let location = { latitude: null, longitude: null };

            // Extract EXIF metadata
            try {
                const parser = ExifParser.create(file.buffer);
                const exifData = parser.parse();

                // Get clickedAt (Date taken)
                if (exifData.tags.DateTimeOriginal) {
                    clickedAt = new Date(exifData.tags.DateTimeOriginal * 1000);
                }

                // Get location (GPS coordinates)
                if (exifData.tags.GPSLatitude && exifData.tags.GPSLongitude) {
                    location.latitude = exifData.tags.GPSLatitude;
                    location.longitude = exifData.tags.GPSLongitude;
                }
            } catch (err) {
                console.warn("Could not extract EXIF data for", file.originalname);
            }

            // Upload to Cloudinary
            const result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream({ resource_type: "image" }, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }).end(file.buffer);
            });

            // Save metadata to DB
            const newPhoto = new Photo({
                url: result.secure_url,
                filename: result.public_id,
                size: file.size,
                location,
                clickedAt,
                uploadedAt: new Date()
            });

            await newPhoto.save();
            uploadedPhotos.push(newPhoto);
        }

        res.status(201).json(uploadedPhotos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fetches all photos and sort
// Sort by clickedAt (newest first):
// GET /api/photos?sortBy=clickedAt&order=desc
// Sort by location (latitude ascending):
// GET /api/photos?sortBy=location&order=asc
router.get('/photos', async (req, res) => {
    try {
        let { page = 1, limit = 10, startDate, endDate, lat, lng, radius } = req.query;

        // Convert page & limit to numbers
        page = parseInt(page);
        limit = parseInt(limit);

        let query = {};

        // Filter by date range (clickedAt)
        if (startDate || endDate) {
            query.clickedAt = {};
            if (startDate) query.clickedAt.$gte = new Date(startDate);
            if (endDate) query.clickedAt.$lte = new Date(endDate);
        }

        // Filter by location (basic radius search)
        if (lat && lng && radius) {
            const maxDistance = parseFloat(radius) / 111; // Convert km to degrees
            query.location = {
                latitude: { $gte: parseFloat(lat) - maxDistance, $lte: parseFloat(lat) + maxDistance },
                longitude: { $gte: parseFloat(lng) - maxDistance, $lte: parseFloat(lng) + maxDistance }
            };
        }

        // Fetch paginated data **in the order they were uploaded**
        const photos = await Photo.find(query)
            .skip((page - 1) * limit)
            .limit(limit);

        // Total count for frontend pagination
        const totalPhotos = await Photo.countDocuments(query);

        res.status(200).json({
            page,
            limit,
            totalPages: Math.ceil(totalPhotos / limit),
            totalPhotos,
            data: photos
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// delete photo by id
router.delete('/photos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const photo = await Photo.findById(id);

        if (!photo) {
            return res.status(404).json({ message: "Photo not found!" });
        }

        // Delete from Cloudinary
        await cloudinary.uploader.destroy(photo.filename);

        // Delete from Database
        await Photo.findByIdAndDelete(id);

        res.status(200).json({ message: "Photo deleted successfully!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
