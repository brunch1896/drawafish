# DrawAFish 🐟

全球网友一起在线"画鱼摸鱼"——AI判定≥63%像鱼即可进入公共鱼缸实时共游。

## 功能特点

- 🎨 **在线绘画**: 640×480 HTML5 Canvas 画板，支持画笔、橡皮、撤销等工具
- 🤖 **AI判定**: 使用 TensorFlow.js 进行鱼类识别，≥63%相似度才能进入鱼缸
- 🌊 **实时鱼缸**: 无限横向循环的2D水族箱，支持实时同步
- 🎯 **交互体验**: 鼠标悬停放大、滚轮缩放、昵称显示
- 🛡️ **内容安全**: 基础内容过滤和举报机制
- 📱 **响应式设计**: 支持桌面和移动设备

## 技术栈

### 前端
- HTML5 Canvas
- TensorFlow.js (AI模型)
- Socket.io (实时通信)
- 原生JavaScript

### 后端
- Node.js
- Express.js
- Socket.io

### 部署
- Docker
- NPM

## 快速开始

### 本地开发

1. 克隆项目
```bash
git clone <repository-url>
cd fishGame
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm run dev
```

4. 打开浏览器访问 `http://localhost:3000`

### Docker部署

1. 构建镜像
```bash
docker build -t drawafish .
```

2. 运行容器
```bash
docker run -p 3000:3000 drawafish
```

## 项目结构

```
drawafish/
├─ public/                 # 静态文件
│  ├─ index.html          # 主页面
│  ├─ sketch.js           # 绘画功能
│  ├─ fish.js             # 鱼缸动画
│  └─ model.json          # AI模型配置
├─ server.js              # 后端服务器
├─ package.json           # 项目配置
└─ Dockerfile             # Docker配置
```

## API接口

### POST /fish
提交新的鱼类作品

**请求体:**
```json
{
  "nickname": "用户昵称",
  "imageBase64": "base64编码的图片",
  "prob": 0.85
}
```

### GET /fishes
获取所有鱼类作品

### GET /stats
获取服务器统计信息

### POST /fish/:fishId/report
举报不当内容

## 性能指标

- 前端首包 ≤100 kB
- 支持并发用户 1k+
- 内存占用 <50 MB
- 响应时间 <100ms

## 开发计划

- V1.0: 基础功能实现 ✅
- V1.1: 点赞和举报功能，Redis缓存
- V1.2: 更精确的AI模型
- V1.3: 用户系统和历史记录

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！