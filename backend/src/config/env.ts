import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'clinica'
  },
  jwt: {
    secret: process.env.JWT_SECRET || ''
  }
};

export const requireJwtSecret = (): string => {
  if (!env.jwt.secret) {
    throw new Error('JWT_SECRET no esta configurado');
  }

  return env.jwt.secret;
};
