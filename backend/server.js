const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const photoRoutes = require('./routes/photoRoutes');

require('dotenv').config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/v1', photoRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
