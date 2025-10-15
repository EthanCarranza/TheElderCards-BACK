# The Elder Cards - Backend

Backend API para The Elder Cards, construido con Node.js, Express, Socket.IO y MongoDB.

## 🚀 Características

- API RESTful para gestión de usuarios, cartas, facciones y colecciones
- WebSocket en tiempo real con Socket.IO para notificaciones
- Autenticación JWT
- Almacenamiento de imágenes con Cloudinary
- Base de datos MongoDB

## 📋 Requisitos

- Node.js >= 18.0.0
- MongoDB
- Cuenta de Cloudinary (para imágenes)

## 🛠️ Instalación Local

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Editar .env con tus credenciales
# Iniciar en desarrollo
npm run dev

# Iniciar en producción
npm start
```

## 🌐 Despliegue en Render

### Paso 1: Preparar el repositorio
El proyecto ya está configurado con `render.yaml`.

### Paso 2: Crear servicio en Render
1. Ve a [render.com](https://render.com) y crea una cuenta
2. Click en "New +" → "Web Service"
3. Conecta tu repositorio de GitHub
4. Render detectará automáticamente la configuración

### Paso 3: Configurar variables de entorno
Añade las siguientes variables en Render:

- `NODE_ENV`: `production`
- `DB_URL`: Tu URL de MongoDB
- `SECRET_KEY`: Tu clave secreta JWT
- `CLIENT_URL`: URL de tu frontend (ej: https://tu-frontend.vercel.app)
- `CLOUDINARY_CLOUD_NAME`: Nombre de tu cloud de Cloudinary
- `CLOUDINARY_API_KEY`: API Key de Cloudinary
- `CLOUDINARY_API_SECRET`: API Secret de Cloudinary

### Paso 4: Desplegar
Render desplegará automáticamente tu aplicación.

## 📡 Endpoints Principales

- `GET /` - Info de la API
- `GET /api/health` - Health check
- `POST /api/v1/users/register` - Registro de usuario
- `POST /api/v1/users/login` - Login
- `GET /api/v1/cards` - Listar cartas
- `GET /api/v1/factions` - Listar facciones
- `WebSocket` - Notificaciones en tiempo real

## 🔌 Socket.IO

El servidor Socket.IO está configurado para funcionar con:
- WebSocket (preferido)
- Polling (fallback)
- Autenticación por token JWT

## 📝 Variables de Entorno

Ver `.env.example` para la lista completa de variables requeridas.

## 🐛 Troubleshooting

Si Socket.IO no conecta:
- Verifica que `CLIENT_URL` esté correctamente configurado
- Revisa los logs en Render dashboard
- Asegúrate de que el frontend use la URL correcta

## 📄 Licencia

ISC
