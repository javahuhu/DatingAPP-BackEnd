
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import passport from 'passport';
import registerAPI from './Presentation/Route/registerRoute.js';
import loginAPI from './Presentation/Route/loginRoute.js';
import link from './Presentation/Route/linkRoute.js';
import socialAPI from './Presentation/Route/googleroute.js';
import profileAPI from './Presentation/Route/profileRoute.js';
import existprofile from './Presentation/Route/getexistprofile.js';
import facebookAPI from './Presentation/Route/facebookroute.js';
import discoveryRoute from './Presentation/Route/discoveryRoute.js'
import discoverySentRoute from './Presentation/Route/discoverysentRoute.js'
import messageRoute from './Presentation/Route/messageRoute.js';
import unmatchRoute from './Presentation/Route/unmatchRoute.js';
import matchChek from './Presentation/Route/ismatch_route.js';
dotenv.config();


const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());


app.use(passport.initialize());


const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/datingapp';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => { console.error('MongoDB connection error', err); process.exit(1); });

app.use('/api/auth', registerAPI);
app.use('/api/auth', loginAPI);
app.use('/api/auth', link);
app.use('/api/auth', socialAPI);
app.use('/api/profile', profileAPI);
app.use('/api/profile/megl', existprofile);
app.use('/api/auth/mefb', facebookAPI);
app.use('/api/discovery', discoveryRoute);
app.use('/api/discovery', discoverySentRoute);
app.use('/api/messages', messageRoute); 
app.use('/api/discovery', unmatchRoute); 
app.use('/api/discovery', matchChek);
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
