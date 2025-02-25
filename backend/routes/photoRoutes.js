const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const Photo = require('../models/Photo');
const ExifParser = require('exif-parser');
const duplicateQueue = require('../config/queue');

const router = express.Router();
// Multer for file handling
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Bulk Upload Route
router.post('/upload', upload.array('images', 100), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No files uploaded!" });
        }

        let uploadedPhotos = [];

        for (const file of req.files) {
            let clickedAt = new Date();
            let location = { latitude: null, longitude: null };

            // Extract EXIF metadata
            try {
                const parser = ExifParser.create(file.buffer);
                const exifData = parser.parse();

                if (exifData.tags.DateTimeOriginal) {
                    clickedAt = new Date(exifData.tags.DateTimeOriginal * 1000);
                }
                if (exifData.tags.GPSLatitude && exifData.tags.GPSLongitude) {
                    location.latitude = exifData.tags.GPSLatitude;
                    location.longitude = exifData.tags.GPSLongitude;
                }
            } catch (err) {
                console.warn("Could not extract EXIF data for", file.originalname);
            }

            // Upload to Cloudinary (Original Image)
            const result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream({ resource_type: "image" }, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }).end(file.buffer);
            });

            // Generate Thumbnail (200px width)
            const thumbnailUrl = cloudinary.url(result.public_id, { width: 200, crop: "scale" });

            // Save metadata to DB
            const newPhoto = new Photo({
                url: result.secure_url,       // Original Image URL
                thumbnailUrl: thumbnailUrl,  // Thumbnail URL
                filename: result.public_id,
                size: file.size,
                location,
                clickedAt,
                uploadedAt: new Date()
            });

            await newPhoto.save();
            uploadedPhotos.push(newPhoto);

            // Add job to queue and log it
            const job = await duplicateQueue.add('checkDuplicate', { photoId: newPhoto._id, url: newPhoto.url });
            console.log(`🟢 Job added to queue: ${job.id}`);
        }

        res.status(201).json(uploadedPhotos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Fetch all photos in the order they were uploaded
router.get('/photos', async (req, res) => {
    try {
        // Default values: page = 1, limit = 10 (shows 10 photos per request)
        let { page = 1, limit = 10 } = req.query;

        // Convert page & limit to numbers
        page = parseInt(page);
        limit = parseInt(limit);

        // Fetch paginated photos **in the order they were uploaded**
        const photos = await Photo.find()
            .skip((page - 1) * limit)
            .limit(limit)
            .select("url thumbnailUrl clickedAt location");

        // Total count for frontend pagination
        const totalPhotos = await Photo.countDocuments();

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
