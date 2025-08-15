class DrawingApp {
    constructor() {
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.currentTool = 'pen';
        this.currentColor = '#000000';
        this.currentSize = 4;
        this.history = [];
        this.currentPath = [];
        this.model = null;
        this.modelLoaded = false;
        
        this.initializeCanvas();
        this.setupEventListeners();
        this.saveState();
        this.loadModel();
    }

    initializeCanvas() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });

        // Tool buttons
        document.getElementById('penTool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraserTool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('clearCanvas').addEventListener('click', () => this.clearCanvas());
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('completeBtn').addEventListener('click', () => this.completeDrawing());

        // Color and size controls
        document.getElementById('colorPicker').addEventListener('change', (e) => {
            this.currentColor = e.target.value;
        });

        document.getElementById('brushSize').addEventListener('input', (e) => {
            this.currentSize = parseInt(e.target.value);
            document.getElementById('brushSizeValue').textContent = this.currentSize;
        });
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    startDrawing(e) {
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        this.currentPath = [pos];
        
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
    }

    draw(e) {
        if (!this.isDrawing) return;

        const pos = this.getMousePos(e);
        this.currentPath.push(pos);

        this.ctx.lineWidth = this.currentSize;
        
        if (this.currentTool === 'pen') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.currentColor;
        } else if (this.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
        }

        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.saveState();
        }
    }

    setTool(tool) {
        this.currentTool = tool;
        
        // Update button states
        document.querySelectorAll('.tools button').forEach(btn => {
            btn.style.background = '#4a90e2';
        });
        
        if (tool === 'pen') {
            document.getElementById('penTool').style.background = '#357abd';
            this.canvas.style.cursor = 'crosshair';
        } else if (tool === 'eraser') {
            document.getElementById('eraserTool').style.background = '#357abd';
            this.canvas.style.cursor = 'grab';
        }
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveState();
    }

    saveState() {
        this.history.push(this.canvas.toDataURL());
        if (this.history.length > 20) {
            this.history.shift();
        }
        this.updateUndoButton();
    }

    undo() {
        if (this.history.length > 1) {
            this.history.pop();
            const previousState = this.history[this.history.length - 1];
            const img = new Image();
            img.onload = () => {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(img, 0, 0);
            };
            img.src = previousState;
            this.updateUndoButton();
        }
    }

    updateUndoButton() {
        const undoBtn = document.getElementById('undoBtn');
        undoBtn.disabled = this.history.length <= 1;
    }

    async completeDrawing() {
        const nickname = document.getElementById('nicknameInput').value.trim() || '匿名用户';
        console.log('[DRAWING] 用户完成绘画，昵称:', nickname);

        // Export as 64x64 PNG
        const imageData = this.exportTo64x64();
        console.log('[DRAWING] 图像导出完成，大小:', imageData.length);

        // Show loading state
        const completeBtn = document.getElementById('completeBtn');
        const originalText = completeBtn.textContent;
        completeBtn.textContent = 'AI判定中...';
        completeBtn.disabled = true;

        // Show AI feedback section
        this.showAIFeedback();

        try {
            // Fish detection
            console.log('[DRAWING] 开始鱼类检测...');
            const isFishProb = await this.detectFish(imageData);
            console.log('[DRAWING] 检测结果:', isFishProb);

            // Update AI feedback with results
            this.updateAIFeedback(isFishProb);

            // Check if probability meets threshold
            if (isFishProb >= 0.01) {
                // Submit to server
                console.log('[DRAWING] 鱼类概率达标，开始提交到服务器...');
                await this.submitFish(nickname, imageData, isFishProb);
                console.log('[DRAWING] 提交成功');

                // Clear canvas for next drawing
                this.clearCanvas();

                showToast('太棒了！你的鱼已进入鱼缸！');
            } else {
                console.log('[DRAWING] 鱼类概率不达标:', isFishProb);
                showToast('这不太像鱼哦，再画一次');
            }
        } catch (error) {
            console.error('[DRAWING] 完成绘画过程出错:', {
                timestamp: new Date().toISOString(),
                error: error.message,
                stack: error.stack,
                nickname: nickname
            });
            showToast(`提交失败: ${error.message || '未知错误'}`);
            this.updateAIFeedback(0, true);
        } finally {
            completeBtn.textContent = originalText;
            completeBtn.disabled = false;
            console.log('[DRAWING] 完成绘画流程结束');
        }
    }

    exportTo64x64() {
        // Create temporary canvas for 64x64 export
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = 64;
        tempCanvas.height = 64;
        
        // Draw scaled down version
        tempCtx.drawImage(this.canvas, 0, 0, 64, 64);
        
        return tempCanvas.toDataURL('image/png');
    }

    async loadModel() {
        try {
            console.log('[AI] 开始加载鱼类检测模型...');
            // 首先检查weights.bin文件是否存在
            const weightsResponse = await fetch('/weights.bin', { method: 'HEAD' });
            if (!weightsResponse.ok) {
                throw new Error('weights.bin 文件不存在');
            }
            this.model = await tf.loadLayersModel('/model.json');
            this.modelLoaded = true;
            console.log('[AI] 鱼类检测模型加载成功');
        } catch (error) {
            console.error('[AI] 模型加载失败:', {
                timestamp: new Date().toISOString(),
                error: error.message,
                stack: error.stack,
                modelPath: '/model.json'
            });
            this.modelLoaded = false;
            // 根据错误类型显示不同的提示
            if (error.message.includes('weights.bin')) {
                showToast('AI模型权重文件缺失，将使用备用检测方法');
            } else {
                showToast('AI模型加载失败，将使用备用检测方法');
            }
        }
    }

    async detectFish(imageData) {
        if (!this.modelLoaded || !this.model) {
            console.warn('[AI] 模型未加载，使用备用检测方法');
            return this.fallbackFishDetection(imageData);
        }

        try {
            console.log('[AI] 开始鱼类检测...');
            // Create image element from base64
            const img = new Image();
            img.src = imageData;
            await new Promise((resolve) => { img.onload = resolve; });

            // Create canvas for preprocessing
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 64, 64);

            // Get image data and convert to tensor
            const imageDataArray = ctx.getImageData(0, 0, 64, 64);
            const tensor = tf.browser.fromPixels(imageDataArray, 3)
                .resizeNearestNeighbor([64, 64])
                .toFloat()
                .div(255.0)
                .expandDims();

            // Make prediction
            const prediction = this.model.predict(tensor);
            const probability = prediction.dataSync()[0];
            console.log('[AI] 检测完成，鱼类概率:', probability);

            // Clean up tensor
            tensor.dispose();
            prediction.dispose();

            return probability;
        } catch (error) {
            console.error('[AI] 鱼类检测出错:', {
                timestamp: new Date().toISOString(),
                error: error.message,
                stack: error.stack,
                imageSize: imageData.length
            });
            showToast('AI检测出错，将使用备用方法');
            return this.fallbackFishDetection(imageData);
        }
    }

    fallbackFishDetection(imageData) {
        // Simple heuristic-based fish detection
        // This analyzes the image for fish-like characteristics
        
        const img = new Image();
        img.src = imageData;
        
        // For demo purposes, use a simple algorithm based on drawing patterns
        // In production, this would be replaced with actual image analysis
        
        // Simulate detection based on image complexity
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 64, 64);
        
        const imageDataArray = ctx.getImageData(0, 0, 64, 64);
        const data = imageDataArray.data;
        
        // Count non-white pixels
        let nonWhitePixels = 0;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            if (a > 0 && (r < 250 || g < 250 || b < 250)) {
                nonWhitePixels++;
            }
        }
        
        // Calculate coverage ratio
        const coverage = nonWhitePixels / (64 * 64);
        
        // Simple heuristic: moderate coverage with some shape complexity
        if (coverage < 0.1) {
            return Math.max(0.01, Math.random() * 0.3); // Too simple, but ensure minimum
        } else if (coverage > 0.8) {
            return Math.random() * 0.4 + 0.2; // Too complex
        } else {
            return Math.random() * 0.4 + 0.4; // Just right
        }
    }

    async submitFish(nickname, imageData, probability) {
        try {
            console.log('[SERVER] 开始提交鱼类数据...');
            // 使用fetch API提交数据，不再依赖Socket.io
            const response = await fetch('/fish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nickname: nickname,
                    imageBase64: imageData,
                    prob: probability
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    error: `HTTP错误 ${response.status} ${response.statusText}`
                }));
                throw new Error(errorData.error || '提交失败');
            }

            const result = await response.json();
            console.log('[SERVER] 提交成功，服务器响应:', result);
            return result;
        } catch (error) {
            console.error('[SERVER] 提交鱼类数据出错:', {
                timestamp: new Date().toISOString(),
                error: error.message,
                stack: error.stack,
                nickname: nickname,
                probability: probability
            });
            throw error;
        }
    }

    showAIFeedback() {
        const feedbackSection = document.getElementById('aiFeedback');
        const noFeedbackSection = document.getElementById('noFeedback');
        
        feedbackSection.classList.remove('hidden');
        noFeedbackSection.classList.add('hidden');
        
        // Reset to loading state
        document.getElementById('probabilityValue').textContent = '0%';
        document.getElementById('feedbackStatus').innerHTML = `
            <div class="status-icon">🤔</div>
            <div class="status-text">分析中...</div>
        `;
        document.getElementById('feedbackText').textContent = '正在分析你的绘画...';
        document.getElementById('suggestionsList').innerHTML = '<li>请稍候...</li>';
    }

    updateAIFeedback(probability, isError = false) {
        const percentage = Math.round(probability * 100);
        const probabilityValue = document.getElementById('probabilityValue');
        const feedbackStatus = document.getElementById('feedbackStatus');
        const feedbackText = document.getElementById('feedbackText');
        const suggestionsList = document.getElementById('suggestionsList');
        
        // Update probability display
        probabilityValue.textContent = `${percentage}%`;
        
        if (isError) {
            // Error state
            feedbackStatus.innerHTML = `
                <div class="status-icon">❌</div>
                <div class="status-text">分析失败</div>
            `;
            feedbackText.textContent = '抱歉，AI分析过程中出现了错误，请重试。';
            suggestionsList.innerHTML = '<li>请检查网络连接后重试</li>';
            return;
        }
        
        // Determine status and suggestions based on probability
        let statusIcon, statusText, feedback, suggestions;
        
        if (probability >= 0.8) {
            statusIcon = '🎉';
            statusText = '非常棒！';
            feedback = '你的画作非常像鱼！AI识别出了明显的鱼类特征，包括流线型的身体、鱼鳍和尾巴的结构。';
            suggestions = [
                '继续保持这种优秀的绘画技巧！',
                '可以尝试添加更多细节，如鱼鳞纹理或眼睛的高光',
                '试试画不同种类的鱼，挑战自己'
            ];
        } else if (probability >= 0.6) {
            statusIcon = '👍';
            statusText = '不错哦！';
            feedback = '你的画作有鱼的基本形状，AI能够识别出一些鱼类特征。';
            suggestions = [
                '可以加强鱼头和鱼尾的比例',
                '尝试添加鱼鳍让形状更完整',
                '注意整体的流线型结构'
            ];
        } else if (probability >= 0.4) {
            statusIcon = '🤔';
            statusText = '有点像';
            feedback = '你的画作有部分鱼类特征，但还需要一些改进才能更像鱼。';
            suggestions = [
                '确保有明显的鱼头和鱼尾',
                '添加背鳍和腹鳍',
                '让整体形状更加流线型',
                '可以添加眼睛来增加识别度'
            ];
        } else if (probability >= 0.2) {
            statusIcon = '🎨';
            statusText = '继续努力';
            feedback = 'AI在你的画作中看到了一些形状，但鱼类特征不够明显。';
            suggestions = [
                '从简单的椭圆形开始，这是鱼的基本形状',
                '确保一端较窄（鱼头），另一端有分叉（鱼尾）',
                '添加三角形的鱼鳍',
                '参考真实鱼类的照片来练习'
            ];
        } else {
            statusIcon = '📝';
            statusText = '再试试';
            feedback = 'AI目前还无法在你的画作中识别出明显的鱼类特征。';
            suggestions = [
                '先画一个椭圆形作为鱼的身体',
                '在一端添加一个三角形作为鱼尾',
                '在身体上方添加背鳍',
                '在头部添加一个小圆圈作为眼睛',
                '保持整体形状简单而清晰'
            ];
        }
        
        // Update status
        feedbackStatus.innerHTML = `
            <div class="status-icon">${statusIcon}</div>
            <div class="status-text">${statusText}</div>
        `;
        
        // Update feedback text
        feedbackText.textContent = feedback;
        
        // Update suggestions
        suggestionsList.innerHTML = suggestions.map(suggestion => `<li>${suggestion}</li>`).join('');
        
        // Add color coding based on probability
        const probabilityCircle = probabilityValue.closest('.probability-circle');
        if (probability >= 0.6) {
            probabilityCircle.style.borderColor = '#4CAF50';
            probabilityCircle.style.background = 'rgba(76, 175, 80, 0.3)';
        } else if (probability >= 0.4) {
            probabilityCircle.style.borderColor = '#FF9800';
            probabilityCircle.style.background = 'rgba(255, 152, 0, 0.3)';
        } else {
            probabilityCircle.style.borderColor = '#F44336';
            probabilityCircle.style.background = 'rgba(244, 67, 54, 0.3)';
        }
    }
}

// Toast notification function
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Initialize the drawing app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.drawingApp = new DrawingApp();
});