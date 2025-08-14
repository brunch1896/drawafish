const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// In-memory storage for fishes
let fishes = [];
let fishReports = new Map(); // Track reported fishes

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Basic content filtering
function isContentAppropriate(imageBase64) {
    // Basic filtering - check for obviously inappropriate content patterns
    // This is a simple implementation - in production, use more sophisticated filtering
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
        
        // Validate input
        if (!nickname || !imageBase64 || typeof prob !== 'number') {
            return res.status(400).json({ error: 'Invalid input data' });
        }
        
        // Check probability threshold - use a small epsilon for floating point comparison
        if (prob < 0.009) {  // Slightly below 1% to account for floating point precision
            return res.status(400).json({ error: `Fish probability too low: ${(prob * 100).toFixed(2)}% (minimum: 1%)` });
        }
        
        // Basic content filtering
        if (!isContentAppropriate(imageBase64)) {
            return res.status(400).json({ error: 'Inappropriate content detected' });
        }
        
        // Create fish object
        const fish = {
            id: generateFishId(),
            nickname: nickname.substring(0, 20), // Limit nickname length
            imageBase64,
            prob,
            timestamp: Date.now(),
            reports: 0
        };
        
        // Add to storage
        fishes.push(fish);
        
        // Broadcast to all connected clients
        io.emit('newFish', fish);
        
        // Log for debugging
        console.log(`New fish added: ${fish.nickname} (${fish.id})`);
        
        res.json({ success: true, fishId: fish.id });
        
    } catch (error) {
        console.error('Error adding fish:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all fishes
app.get('/fishes', (req, res) => {
    try {
        // Filter out fishes with too many reports (more than 3)
        const filteredFishes = fishes.filter(fish => 
            fish.reports < 3 && !fishReports.has(fish.id)
        );
        
        res.json(filteredFishes);
        
    } catch (error) {
        console.error('Error getting fishes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Report a fish
app.post('/fish/:fishId/report', (req, res) => {
    try {
        const { fishId } = req.params;
        
        const fish = fishes.find(f => f.id === fishId);
        if (!fish) {
            return res.status(404).json({ error: 'Fish not found' });
        }
        
        // Increment report count
        fish.reports = (fish.reports || 0) + 1;
        
        // If more than 3 reports, hide the fish
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
            connectedClients: io.engine.clientsCount,
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

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    // Send existing fishes to new client
    const activeFishes = fishes.filter(fish => fish.reports < 3);
    socket.emit('initialFishes', activeFishes);
    
    // Handle client disconnection
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
    
    // Handle fish reporting via socket
    socket.on('reportFish', (fishId) => {
        const fish = fishes.find(f => f.id === fishId);
        if (fish) {
            fish.reports = (fish.reports || 0) + 1;
            
            if (fish.reports >= 3) {
                fishReports.set(fishId, true);
                // Notify all clients that fish was removed
                io.emit('fishRemoved', fishId);
            }
            
            socket.emit('reportResult', { 
                fishId, 
                reports: fish.reports,
                success: true 
            });
        }
    });
});

// Clean up old fishes periodically (every hour)
setInterval(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const initialCount = fishes.length;
    
    // Remove fishes older than 1 hour, except those with reports
    fishes = fishes.filter(fish => {
        if (fish.reports >= 3) return false; // Already hidden
        return fish.timestamp > oneHourAgo;
    });
    
    if (fishes.length < initialCount) {
        console.log(`Cleaned up ${initialCount - fishes.length} old fishes`);
    }
    
    // Clear old report records
    for (const [fishId, reported] of fishReports.entries()) {
        const fish = fishes.find(f => f.id === fishId);
        if (!fish) {
            fishReports.delete(fishId);
        }
    }
    
}, 60 * 60 * 1000); // Run every hour

// Start server
const PORT = process.env.PORT || 3000;

// Check if running in Vercel serverless environment
if (process.env.VERCEL) {
    // Export the Express app for Vercel
    module.exports = app;
} else {
    // Start the server normally
    server.listen(PORT, () => {
        console.log(`DrawAFish server running on port ${PORT}`);
        console.log(`Open http://localhost:${PORT} to view the application`);
    });
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

// Export for testing
module.exports = { app, server, io };