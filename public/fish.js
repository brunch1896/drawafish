class FishTank {
    constructor() {
        this.canvas = document.getElementById('fishCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.fishes = [];
        this.zoom = 1.0;
        this.offsetX = 0;
        this.animationId = null;
        this.hoveredFish = null;
        
        this.initializeCanvas();
        this.setupEventListeners();
        this.connectToServer();
        this.startAnimation();
    }

    initializeCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    setupEventListeners() {
        // Mouse events for interaction
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredFish = null;
        });
    }

    connectToServer() {
        // Connect to Socket.io server
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.loadExistingFishes();
        });

        this.socket.on('newFish', (fishData) => {
            this.addFish(fishData);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.enableOfflineMode();
        });
    }

    async loadExistingFishes() {
        try {
            const response = await fetch('/fishes');
            const fishes = await response.json();
            
            fishes.forEach(fishData => {
                this.addFish(fishData);
            });
        } catch (error) {
            console.error('Error loading existing fishes:', error);
            this.enableOfflineMode();
        }
    }

    enableOfflineMode() {
        // Add some demo fishes for offline mode
        const demoFishes = [
            { nickname: '离线鱼1', imageBase64: this.createDemoFishImage(), prob: 0.8 },
            { nickname: '离线鱼2', imageBase64: this.createDemoFishImage(), prob: 0.9 }
        ];
        
        demoFishes.forEach(fishData => {
            this.addFish(fishData);
        });
    }

    createDemoFishImage() {
        // Create a simple fish shape for demo purposes
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Draw a simple fish shape
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.ellipse(32, 32, 20, 12, 0, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw tail
        ctx.beginPath();
        ctx.moveTo(12, 32);
        ctx.lineTo(5, 25);
        ctx.lineTo(5, 39);
        ctx.closePath();
        ctx.fill();
        
        // Draw eye
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(40, 28, 3, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(41, 28, 1, 0, 2 * Math.PI);
        ctx.fill();
        
        return canvas.toDataURL();
    }

    removeBackground(image) {
        // Create a canvas to process the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = image.width;
        canvas.height = image.height;
        
        // Draw the original image
        ctx.drawImage(image, 0, 0);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Process each pixel to remove white/light background
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            // Calculate brightness
            const brightness = (r + g + b) / 3;
            
            // If pixel is white/light, make it transparent
            if (brightness > 240 && a > 0) {
                data[i + 3] = 0; // Make transparent
            }
            // If pixel is near-white, make it semi-transparent
            else if (brightness > 220) {
                data[i + 3] = Math.max(0, a * 0.3);
            }
            // Add slight transparency to light areas for smoother edges
            else if (brightness > 200) {
                data[i + 3] = Math.max(0, a * 0.7);
            }
        }
        
        // Put the processed image data back
        ctx.putImageData(imageData, 0, 0);
        
        return canvas;
    }

    addFish(fishData) {
        const fish = {
            id: fishData.id || Date.now() + Math.random(),
            nickname: fishData.nickname,
            image: new Image(),
            x: Math.random() * this.canvas.width,
            y: Math.random() * (this.canvas.height - 100) + 50,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 0.5,
            angle: 0,
            tailPhase: Math.random() * Math.PI * 2,
            tailSpeed: 0.1 + Math.random() * 0.1,
            size: 1,
            prob: fishData.prob
        };

        fish.image.onload = () => {
            // Process image to remove white background
            fish.processedImage = this.removeBackground(fish.image);
            this.fishes.push(fish);
        };
        fish.image.src = fishData.imageBase64;
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / this.zoom - this.offsetX;
        const mouseY = (e.clientY - rect.top) / this.zoom;

        this.hoveredFish = null;
        
        this.fishes.forEach(fish => {
            const distance = Math.sqrt(
                Math.pow(mouseX - fish.x, 2) + Math.pow(mouseY - fish.y, 2)
            );
            
            if (distance < 30) {
                this.hoveredFish = fish;
                this.canvas.style.cursor = 'pointer';
            }
        });

        if (!this.hoveredFish) {
            this.canvas.style.cursor = 'grab';
        }
    }

    handleWheel(e) {
        e.preventDefault();
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.5, Math.min(2.0, this.zoom * zoomFactor));
        
        if (newZoom !== this.zoom) {
            this.zoom = newZoom;
        }
    }

    updateFish(fish, deltaTime) {
        // Update tail animation
        fish.tailPhase += fish.tailSpeed * deltaTime;
        
        // Update position
        fish.x += fish.vx * deltaTime * 0.06;
        fish.y += fish.vy * deltaTime * 0.06;
        
        // Update angle based on velocity
        if (fish.vx !== 0) {
            fish.angle = Math.atan2(fish.vy, fish.vx);
        }
        
        // Boundary collision with wrapping
        if (fish.x < -50) {
            fish.x = this.canvas.width + 50;
        } else if (fish.x > this.canvas.width + 50) {
            fish.x = -50;
        }
        
        if (fish.y < 30) {
            fish.y = 30;
            fish.vy = Math.abs(fish.vy);
        } else if (fish.y > this.canvas.height - 30) {
            fish.y = this.canvas.height - 30;
            fish.vy = -Math.abs(fish.vy);
        }
        
        // Random direction changes
        if (Math.random() < 0.001) {
            fish.vx += (Math.random() - 0.5) * 0.5;
            fish.vy += (Math.random() - 0.5) * 0.5;
            
            // Limit speed
            const speed = Math.sqrt(fish.vx * fish.vx + fish.vy * fish.vy);
            if (speed > 3) {
                fish.vx = (fish.vx / speed) * 3;
                fish.vy = (fish.vy / speed) * 3;
            }
        }
    }

    drawFish(fish) {
        this.ctx.save();
        
        // Apply zoom and pan
        this.ctx.scale(this.zoom, this.zoom);
        this.ctx.translate(this.offsetX, 0);
        
        // Move to fish position
        this.ctx.translate(fish.x, fish.y);
        this.ctx.rotate(fish.angle);
        
        // Apply hover effect
        const scale = this.hoveredFish === fish ? 1.5 : 1.0;
        this.ctx.scale(scale, scale);
        
        // Use processed image if available, otherwise use original
        const imageToDraw = fish.processedImage || fish.image;
        
        // Draw tail with sine wave animation
        const tailWave = Math.sin(fish.tailPhase) * 0.3;
        this.ctx.save();
        this.ctx.translate(-20, 0);
        this.ctx.rotate(tailWave);
        this.ctx.drawImage(imageToDraw, -imageToDraw.width/2, -imageToDraw.height/2);
        this.ctx.restore();
        
        // Draw main body
        this.ctx.drawImage(imageToDraw, -imageToDraw.width/2, -imageToDraw.height/2);
        
        this.ctx.restore();
        
        // Draw nickname tooltip for hovered fish
        if (this.hoveredFish === fish) {
            this.drawTooltip(fish);
        }
    }

    drawTooltip(fish) {
        this.ctx.save();
        
        const tooltipX = fish.x * this.zoom + this.offsetX * this.zoom;
        const tooltipY = fish.y * this.zoom - 40;
        
        // Draw tooltip background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(tooltipX - 40, tooltipY - 20, 80, 25);
        
        // Draw tooltip text
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(fish.nickname, tooltipX, tooltipY - 5);
        
        // Draw confidence score
        this.ctx.fillStyle = '#4a90e2';
        this.ctx.font = '10px Arial';
        this.ctx.fillText(`${(fish.prob * 100).toFixed(1)}%`, tooltipX, tooltipY + 10);
        
        this.ctx.restore();
    }

    drawBackground() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw water gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#4682B4');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw bubbles
        this.drawBubbles();
    }

    drawBubbles() {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        
        for (let i = 0; i < 10; i++) {
            const x = (Date.now() * 0.01 + i * 100) % (this.canvas.width + 50);
            const y = this.canvas.height - (Date.now() * 0.02 + i * 50) % (this.canvas.height + 50);
            const size = 3 + Math.sin(Date.now() * 0.005 + i) * 2;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, 2 * Math.PI);
            this.ctx.fill();
        }
    }

    animate(currentTime) {
        const deltaTime = currentTime - (this.lastTime || currentTime);
        this.lastTime = currentTime;
        
        // Draw background
        this.drawBackground();
        
        // Update and draw fishes
        this.fishes.forEach(fish => {
            this.updateFish(fish, deltaTime);
            this.drawFish(fish);
        });
        
        this.animationId = requestAnimationFrame((time) => this.animate(time));
    }

    startAnimation() {
        this.animate(0);
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}

// Initialize fish tank when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.fishTank = new FishTank();
});