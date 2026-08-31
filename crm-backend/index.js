const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const employeeRoutes = require('./routes/employees');
const profileRoutes = require('./routes/profile');
const clientDatasetRoutes = require('./routes/clientDatasets');
const taskRoutes = require('./routes/tasks');
const notificationRoutes = require('./routes/notifications');
const businessRoutes = require('./routes/business');
const userRoutes = require('./routes/users');
const roleRoutes = require('./routes/roles');
const communityRoutes = require('./routes/communities');
const permissionRoutes = require('./routes/permissions');
const employeeDirectoryRoutes = require('./routes/employeeDirectory');
const meetingRoutes = require('./routes/meetings');
const quotationRoutes = require('./routes/quotations');
const { startMeetingReminderScheduler } = require('./services/meetingReminderService');
const path = require('path');

dotenv.config();

const app = express();
const server = http.createServer(app);

const parseAllowedOrigins = (value) =>
  value
    ? value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://democrm.brainadzlive.in',
        'http://democrm.brainadzlive.in',
        'https://crm.brainadz.com',
      ];

const allowedOrigins = parseAllowedOrigins(process.env.CLIENT_ORIGINS);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    optionsSuccessStatus: 200,
  }),
);

// Body parser middleware
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('MongoDB connected');
    startMeetingReminderScheduler();
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/client-datasets', clientDatasetRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/employee-directory', employeeDirectoryRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/quotations', quotationRoutes);

// Socket.IO Setup
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log('A user connected to Socket.IO');

  // Listen for custom events or messages
  socket.on('disconnect', () => {
    console.log('User disconnected from Socket.IO');
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Error stack:', err.stack);
  console.error('Error message:', err.message);
  if (res.headersSent) return next(err);
  const status = err.status || (err.code === 11000 ? 409 : 500);
  const message =
    err.code === 11000
      ? 'A record with the same unique value already exists'
      : err.message || 'Server error';
  return res.status(status).json({ message });
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
