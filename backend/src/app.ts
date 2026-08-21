import express from 'express';
import { agendaRoutes } from './routes/agendaRoutes';
import { authRoutes } from './routes/authRoutes';
import { coberturaRoutes } from './routes/coberturaRoutes';
import { especialidadRoutes } from './routes/especialidadRoutes';
import { healthRoutes } from './routes/healthRoutes';
import { sedeRoutes } from './routes/sedeRoutes';
import { usuarioRoutes } from './routes/usuarioRoutes';
import { errorHandler } from './middlewares/errorHandler';
import { responder } from './utils/respuesta';

export const app = express();

app.use(express.json());

app.use(healthRoutes);
app.use(agendaRoutes);
app.use(coberturaRoutes);
app.use(especialidadRoutes);
app.use(sedeRoutes);
app.use(usuarioRoutes);
app.use('/auth', authRoutes);

app.use((_req, res) => {
  responder(res, 404, 'Ruta no encontrada');
});

app.use(errorHandler);
