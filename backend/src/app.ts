import express from 'express';
import { authRoutes } from './routes/authRoutes';
import { coberturaRoutes } from './routes/coberturaRoutes';
import { healthRoutes } from './routes/healthRoutes';
import { errorHandler } from './middlewares/errorHandler';
import { responder } from './utils/respuesta';

export const app = express();

app.use(express.json());

app.use(healthRoutes);
app.use(coberturaRoutes);
app.use('/auth', authRoutes);

app.use((_req, res) => {
  responder(res, 404, 'Ruta no encontrada');
});

app.use(errorHandler);
