import { createServer } from 'http';
import { env } from './config/env.js';
import cookieParser from 'cookie-parser';
import morganMiddleware from './logger/morgan.logger.js';
import requestIp from 'request-ip';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import limiter from './config/limiter.js';
import { errorHandler } from './middleware/error.middleware.js';
import authRouter from './routes/auth.routes.js';
import groupRouter from './routes/group.routes.js';
import reportRouter from './routes/report.routes.js';
import callRouter from './routes/call.routes.js';
import HomeRouter from './routes/home.routes.js';
import WorkflowRouter from './routes/workflow.routes.js';
import { voiceHandler } from './controllers/voice.controller.js';
import { callStatusHandler, recordingStatusHandler } from './controllers/status.controller.js';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { TwilioStreamManager } from './ws/twilioStreamManager.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = env.API_URL;
const PORT = env.PORT;
const API_PREFIX = env.API_PREFIX;

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bus API',
      version: '1.0.0',
      description: 'API documentation for the Bus Application',
    },
    servers: [
      {
        url: `${BASE_URL}:${PORT}${API_PREFIX}`,
        description: 'API Server',
      },
    ],
  },
  apis: ['./src/routes/**/*.ts'], // Path to the API docs (your route files)
};

// Generate Swagger specification
const swaggerSpec = swaggerJsdoc(swaggerOptions);

const app = express();
const httpServer = createServer(app);

// Setup Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins (for development); restrict in production
    methods: ['GET', 'POST'],
  },
});

const twilioManager = new TwilioStreamManager(httpServer);
logger.log('Twilio Stream Manager initialized');

// Global middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'unsafe-none' },
  }),
);

// Configure CORS based on environment
const corsOptions = {
  origin:
    env.NODE_ENV === 'production'
      ? BASE_URL ? [BASE_URL] : true // In production, only allow requests from BASE_URL if defined
      : true, // In development, allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Twilio-Signature'],
};

app.use(cors(corsOptions));
app.use(requestIp.mw());

// Apply the rate limiting middleware to all requests
app.use(limiter);

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.use(cookieParser());
app.use(morganMiddleware);

// Serve static audio files
app.use('/audio', express.static(path.join(__dirname, '../temp')));
app.set('io', io);

// API Routes
app.use(API_PREFIX + '/user', authRouter);
app.use(API_PREFIX + '/group', groupRouter);
app.use(API_PREFIX + '/call', callRouter);
app.use(API_PREFIX + '/home', HomeRouter);
app.use(API_PREFIX + '/report', reportRouter);
app.use(API_PREFIX + '/workflow', WorkflowRouter);

// Twilio webhook endpoints (these must be accessible without API_PREFIX)
app.post('/call-status', callStatusHandler);
app.post('/voice-update', voiceHandler);
app.post('/recording-status', recordingStatusHandler);

// Health check endpoint for WebSocket
app.get('/ws/health', (req, res) => {
  res.json({
    status: 'ok',
    websocket: 'ready',
    timestamp: new Date().toISOString(),
  });
});

// API Documentation
app.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      docExpansion: 'none',
    },
    customSiteTitle: 'Bus Api docs',
  }),
);

// Error handling middleware (must be last)
app.use(errorHandler);

// Socket.IO connection handler
io.on('connection', (socket) => {
  logger.log('Socket.IO client connected:', socket.id);

  socket.on('disconnect', () => {
    logger.log('Socket.IO client disconnected:', socket.id);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.log('SIGTERM received, shutting down gracefully');
  twilioManager.close(() => {
    logger.log('Twilio WebSocket server closed');
  });
  httpServer.close(() => {
    logger.log('HTTP server closed');
    process.exit(0);
  });
});

export { httpServer };
