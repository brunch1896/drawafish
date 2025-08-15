const express = require('express');
const serverless = require('serverless-http');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors({ origin: '*' }));

// Middleware
app.use(express.json({ limit: '10mb' }));

// In-memory storage for fishes
let fishes = [];
let fishReports = new Map(); // Track reported fishes

// Basic content filtering
function isContentAppropriate(imageBase64) {
    const inappropriateKeywords = ['inappropriate', 'offensive', 'nsfw'];
    const imageData = imageBase64.toLowerCase();
    return !inappropriateKeywords.some(keyword => imageData.includes(keyword));
}

// Generate unique fish ID
function generateFishId() {
    return 'fish_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// REST Endpoints

// Submit a new fish
app.post('/fish', (req, res) => {
    try {
        const { nickname, imageBase64, prob } = req.body;
        if (!nickname || !imageBase64 || typeof prob !== 'number') {
            return res.status(400).json({ error: 'Invalid input data' });
        }
        if (prob < 0.009) {
            return res.status(400).json({ error: `Fish probability too low: ${(prob * 100).toFixed(2)}% (minimum: 1%)` });
        }
        if (!isContentAppropriate(imageBase64)) {
            return res.status(400).json({ error: 'Inappropriate content detected' });
        }
        const fish = {
            id: generateFishId(),
            nickname: nickname.substring(0, 20),
            imageBase64,
            prob,
            timestamp: Date.now(),
            reports: 0
        };
        fishes.push(fish);
        console.log(`New fish added: ${fish.nickname} (${fish.id})`);
        res.json({ success: true, fishId: fish.id });
    } catch (error) {
        console.error('Error adding fish:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all fishes
app.get('/fishes', (req, res) => {
    const sinceId = req.query.since;
    let filteredFishes = [...fishes];
    
    if (sinceId) {
        // 只返回ID大于sinceId的鱼
        filteredFishes = filteredFishes.filter(fish => fish.id > parseInt(sinceId));
    }
    
    // 按照ID降序排序，确保最新的鱼在前面
    filteredFishes.sort((a, b) => b.id - a.id);
    
    // 限制返回的鱼的数量
    const limit = parseInt(req.query.limit) || 50;
    filteredFishes = filteredFishes.slice(0, limit);
    
    res.json(filteredFishes);
});

// Report a fish
app.post('/fish/:fishId/report', (req, res) => {
    try {
        const { fishId } = req.params;
        const fish = fishes.find(f => f.id === fishId);
        if (!fish) {
            return res.status(404).json({ error: 'Fish not found' });
        }
        fish.reports = (fish.reports || 0) + 1;
        if (fish.reports >= 3) {
            fishReports.set(fishId, true);
            console.log(`Fish ${fishId} hidden due to excessive reports`);
        }
        res.json({ success: true, reports: fish.reports });
    } catch (error) {
        console.error('Error reporting fish:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get server stats
app.get('/stats', (req, res) => {
    try {
        const stats = {
            totalFishes: fishes.length,
            activeFishes: fishes.filter(fish => fish.reports < 3).length,
            reportedFishes: fishes.filter(fish => fish.reports >= 3).length,
            uptime: process.uptime()
        };
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: Date.now(),
        memory: process.memoryUsage(),
        uptime: process.uptime()
    });
});

// For Socket.io, we'll need to implement a different approach on Netlify
// For now, we'll just return a message indicating it's not supported in this function
app.get('/socket.io', (req, res) => {
    res.json({ message: 'Socket.io is not directly supported in Netlify functions. Consider using a different approach for real-time features.' });
});

// Clean up old fishes periodically (every hour)
setInterval(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    fishes = fishes.filter(fish => {
        if (fish.reports >= 3) return false;
        if (fish.timestamp < oneHourAgo) return false;
        return true;
    });
    console.log(`Cleaned up old fishes. Remaining: ${fishes.length}`);
}, 60 * 60 * 1000);

// Export the serverless function
module.exports.handler = serverless(app);