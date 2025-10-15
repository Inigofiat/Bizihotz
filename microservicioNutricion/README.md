### Microservicio de Nutricion (M2)

API REST construida con FastAPI y PostgreSQL para gestionar alimentos, recetas y planes de dieta dentro del ecosistema Bizihotz.

#### Endpoints principales

- `GET /health` - estado del servicio y comprobacion de la base de datos.
- `GET/POST/PUT/DELETE /api/alimentos` - CRUD de alimentos (valores por 100 g).
- `GET /api/alimentos/externo/buscar?q=` - consulta a la API externa (Edamam por defecto).
- `GET/POST/PUT/DELETE /api/recetas` - gestion de recetas con ingredientes.
- `GET/POST/PUT/DELETE /api/dietas` - gestion de dietas y asignacion de recetas a pacientes.

#### Puesta en marcha rapida

```bash
cp .env.example .env  # ajusta credenciales/API keys si es necesario
docker-compose up --build
```

La API quedara disponible en `http://localhost:5002`. Las tablas se crean automaticamente al iniciar el servicio gracias a SQLAlchemy; si mas adelante incorporas migraciones puedes ejecutar el comando correspondiente dentro del contenedor.

#### Caracteristicas

- Calculos de calorias y macros segun los alimentos asociados a cada receta o dieta.
- Integracion opcional con proveedores externos de datos nutricionales mediante las variables `EXTERNAL_NUTRITION_*`.
- Arquitectura preparada para convivir con un API Gateway encargado de autenticacion y autorizacion.
