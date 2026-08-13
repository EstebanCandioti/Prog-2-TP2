import { Router } from 'express';
import { health } from '../controllers/healthController';
import { asyncHandler } from '../utils/asyncHandler';

export const healthRoutes = Router();

healthRoutes.get('/health', asyncHandler(health));
