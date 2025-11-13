import express, { type Application } from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import compression from 'compression';
import { AppError } from './utils/AppError.js';
import { globalError } from './middlewares/globalError.js';
import { connectDB } from './config/db.js';
import cookieParser from 'cookie-parser';
import { limiter } from './middlewares/rateLimit.js';


//import Routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import instructorRoutes from './routes/instructorRoutes.js';
import courseRoutes from './routes/courseRoutes.js'
import categoryRoutes from './routes/categoryRoutes.js';
import lessonRoutes from './routes/lessonRoutes.js';
import enrollmentRoutes from './routes/enrollmentRoutes.js'
import adminRoutes from './routes/adminRoutes.js';


dotenv.config();

const app: Application = express();
const PORT = Number(process.env['PORT']) || 8000;

// 1. إعدادات CORS آمنة
const allowedOrigins = process.env['CORS_ORIGINS']?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new AppError('Not allowed by CORS', 403));
  },
  credentials: true
}));


// 2. Security & Performance
app.use(cookieParser());
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// 3. Rate Limiting
app.use('/api', limiter);


// 4. Logging (dev/production)
app.use(morgan(process.env['NODE_ENV'] === 'production' ? 'combined' : 'dev'));


// 5. Routes (سيتم إضافتها هنا)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/instructors', instructorRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/dashboard', adminRoutes);




// 6. 404 Handler
app.use((req, _res, next) => {
  next(AppError.notFound(`Route ${req.originalUrl} not found`));
});

// 7. Global Error Handler
app.use(globalError);

//8 Start Server
const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT} (${process.env['NODE_ENV']})`);
    });

    let isShuttingDown = false;

    const shutdown = async (signal: string) => {
      if (isShuttingDown) return; // ✅ تجاهل التكرار
      isShuttingDown = true;

      console.log(`⏳ ${signal} received. Shutting down gracefully...`);

      // 🧹 إغلاق السيرفر
      server.close(async (err) => {
        if (err) {
          console.error('❌ Server close error:', err);
          process.exit(1);
        }

        // 🧹 إغلاق اتصال MongoDB
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed.');
        console.log('✅ Server closed successfully.');

        process.exit(0);
      });
    };

    // استخدم once لتجنب التكرار
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('🚨 Failed to start server:', error);
    process.exit(1);
  }
};

startServer();