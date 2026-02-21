// Copyright (c) 2025 fhamyla
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const papersRoutes = require('./routes/papers');
const paperRequestsRoutes = require('./routes/paperRequests');

const app = express();
const port = process.env.PORT || 3000;

const corsOptions = {
  origin: [
    'https://ccs-research-repo.vercel.app',
    'http://localhost:5173', // For local development
    'http://localhost:3000'  // For local development
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'user-role']
};

app.use(cors(corsOptions));
app.use(express.json());

console.log('MONGODB_URI:', process.env.MONGODB_URI);
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/papers', papersRoutes);
app.use('/api/paper-requests', paperRequestsRoutes);


app.get('/', (req, res) => {
  res.send('Backend API is running!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Visit http://localhost:${port} to see the app`);
});