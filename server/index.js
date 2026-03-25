import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import watchlistRouter from './routes/watchlist.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());
app.use('/api/watchlist', watchlistRouter);

app.listen(PORT, () => {
  console.log(`Jony Signal server running on http://localhost:${PORT}`);
});
