import { Router } from 'express';
import { listarCoberturas } from '../controllers/coberturaController';
import { asyncHandler } from '../utils/asyncHandler';

export const coberturaRoutes = Router();

coberturaRoutes.get('/coberturas', asyncHandler(listarCoberturas));
