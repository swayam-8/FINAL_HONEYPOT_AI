require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/apiRoutes');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// DB Connection
connectDB();

// Security Middleware
app.use((req, res, next) => {
    const authKey = req.headers['x-api-key'];
    if (authKey !== process.env.API_SECRET_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
});

// Routes
app.use('/api', apiRoutes);
app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => {
    logger.info(`🚀 Honeypot Active on port ${PORT}`);
});