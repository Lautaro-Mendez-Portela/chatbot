# AI PDF Chat

Aplicacion web para subir documentos PDF y conversar con su contenido usando IA local. El sistema permite registrar usuarios, iniciar sesion, cargar PDFs, dividirlos en fragmentos, generar embeddings, crear multiples chats por documento y mantener historiales separados por conversacion.

## Caracteristicas

- Autenticacion con JWT.
- Subida de documentos PDF protegida por usuario.
- Validacion de archivos: solo PDF y maximo 15 MB.
- Extraccion de texto desde PDF.
- Chunking del contenido del documento.
- Embeddings generados con Ollama.
- Preguntas y respuestas usando contexto relevante del PDF.
- Multiples chats por documento.
- Edicion y eliminacion de chats.
- Eliminacion de documentos en base de datos y archivo fisico.
- Frontend responsive tipo ChatPDF/ChatGPT.

## Stack

### Backend

- NestJS 11
- Prisma ORM
- PostgreSQL con pgvector
- JWT + Passport
- Multer
- pdf-parse
- Ollama para embeddings y generacion de respuestas

### Frontend

- Vue 3
- Composition API
- Vite
- Axios
- CSS scoped

## Estructura del proyecto

```text
chatbot/
  back/                    # API NestJS
    prisma/                # Schema y migraciones
    src/
      auth/                # Registro, login, JWT y roles
      documents/           # Upload, documentos, chats y preguntas
      ai/                  # Integracion con Ollama
      prisma/              # PrismaService
    uploads/               # PDFs subidos localmente

  front/                   # Frontend Vue + Vite
    src/
      api/                 # Instancia Axios
      views/               # Login, documentos y chat
```

## Requisitos

- Node.js 20 o superior recomendado.
- npm.
- Docker y Docker Compose.
- Ollama instalado y corriendo localmente.

Modelos usados por defecto:

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

Ollama debe estar disponible en:

```text
http://localhost:11434
```

## Variables de entorno

Crear el archivo `back/.env`:

```env
JWT_SECRET=your_jwt_secret
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ai_pdf_chat?schema=public"
OPENAI_API_KEY=optional_if_you_add_openai_later
```

Nota: actualmente el servicio de IA usa Ollama local mediante HTTP. `OPENAI_API_KEY` existe en el entorno, pero no es requerida para el flujo actual si se mantiene Ollama.

## Instalacion

Desde la raiz del repo:

```bash
cd chatbot
```

Instalar dependencias del backend:

```bash
cd back
npm install
```

Instalar dependencias del frontend:

```bash
cd ../front
npm install
```

## Base de datos

Levantar PostgreSQL con pgvector:

```bash
cd back
docker compose up -d
```

Aplicar migraciones:

```bash
npx prisma migrate dev
```

Generar cliente Prisma si es necesario:

```bash
npx prisma generate
```

Si Prisma no puede regenerar el cliente en Windows por un archivo bloqueado, detener el backend y ejecutar `npx prisma generate` nuevamente.

## Ejecucion en desarrollo

### Backend

```bash
cd back
npm run start:dev
```

API disponible en:

```text
http://localhost:3000
```

### Frontend

```bash
cd front
npm run dev
```

Frontend disponible normalmente en:

```text
http://localhost:5173
```

## Scripts utiles

Backend:

```bash
npm run start:dev
npm run build
npm run test
npm run lint
```

Frontend:

```bash
npm run dev
npm run build
npm run preview
```

## Endpoints principales

### Auth

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| POST | `/auth/register` | Crear usuario |
| POST | `/auth/login` | Iniciar sesion y obtener JWT |
| GET | `/auth/profile` | Obtener perfil autenticado |

### Documentos

Todas estas rutas requieren:

```http
Authorization: Bearer <token>
```

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| POST | `/documents/upload` | Subir PDF |
| GET | `/documents` | Listar documentos del usuario |
| GET | `/documents/:id` | Obtener un documento |
| DELETE | `/documents/:id` | Eliminar documento y archivo fisico |

### Chats por documento

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| POST | `/documents/:id/chats` | Crear chat para un documento |
| GET | `/documents/:id/chats` | Listar chats del documento |
| PATCH | `/documents/:id/chats/:chatId` | Renombrar chat |
| DELETE | `/documents/:id/chats/:chatId` | Eliminar chat |
| GET | `/documents/:id/chats/:chatId/messages` | Obtener historial de un chat |
| POST | `/documents/:id/chats/:chatId/ask` | Preguntar sobre el PDF dentro de un chat |

Body para preguntar:

```json
{
  "question": "De que trata este documento?",
  "useHistory": true
}
```

## Flujo de uso

1. Registrar un usuario o iniciar sesion.
2. Subir un PDF desde "Mis documentos".
3. Abrir el documento.
4. Crear uno o varios chats dentro del documento.
5. Hacer preguntas sobre el PDF.
6. Renombrar o eliminar chats si hace falta.
7. Eliminar documentos cuando ya no se necesiten.

## Notas de implementacion

- El frontend guarda el token JWT en `localStorage` con la clave `token`.
- Axios agrega automaticamente el header `Authorization` si existe token.
- El backend valida que cada documento y chat pertenezcan al usuario autenticado.
- Al borrar un documento, tambien se elimina el archivo PDF guardado en `back/uploads`.
- Cada chat tiene historial independiente dentro del mismo documento.
- Las respuestas usan fragmentos relevantes del documento y el historial del chat activo.

## Solucion de problemas

### El login falla desde el frontend

Verificar que el backend este corriendo en `http://localhost:3000` y que CORS este habilitado para `http://localhost:5173`.

### No se generan respuestas

Verificar que Ollama este corriendo:

```bash
ollama list
```

Y que existan los modelos:

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

### Error al subir PDF

- Confirmar que el archivo sea `.pdf`.
- Confirmar que pese menos de 15 MB.
- Revisar que exista la carpeta `back/uploads`.

### Error de Prisma en Windows

Si aparece un error `EPERM` al generar Prisma Client, cerrar el proceso del backend y ejecutar:

```bash
npx prisma generate
```

## Estado del proyecto

Proyecto en desarrollo. La base funcional ya incluye autenticacion, subida de PDFs, chat con IA, multiples conversaciones por documento y gestion basica de documentos/chats.
