# The Elder Cards - Backend

API REST para The Elder Cards, un juego de cartas tipo TCG.

## 🚀 Deployment

### Variables de Entorno Requeridas

```bash
# Base de datos
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/elderCards

# JWT
JWT_SECRET=tu-clave-secreta-jwt-super-segura

# Cloudinary
CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret

# CORS
FRONTEND_URL=http://localhost:5173
FRONTEND_PROD_URL=https://tu-frontend.vercel.app
```

### Deployment en Vercel

1. Conectar repo en Vercel
2. Configurar variables de entorno
3. Deploy automático desde main

### Deployment en Railway/Render

1. Conectar repo
2. Configurar variables de entorno
3. Command: `npm start`
4. Port: El que asigne la plataforma

## 📡 Endpoints

- **Users**: `/api/v1/users`
- **Cards**: `/api/v1/cards`  
- **Collections**: `/api/v1/collections`
- **Factions**: `/api/v1/factions`
- **Friendships**: `/api/v1/friendships`
- **Messages**: `/api/v1/messages`