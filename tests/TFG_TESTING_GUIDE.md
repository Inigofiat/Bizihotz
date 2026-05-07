# Bizihotz - Guia final de pruebas para TFG

## 1) Cobertura de tests

### Node.js (gestion, comunicacion, chatbot)
- Se han anadido scripts:
  - `npm test`
  - `npm run coverage` (usa `c8`, genera reporte texto + HTML en `coverage/` y exige `>=80%` lineas)
- En chatbot se excluye `src/services/aiService.js` de cobertura por ser integracion externa (IA) no determinista para pruebas unitarias de TFG.
- Servicios:
  - `microservicioGestion/package.json`
  - `microservicioComunicacion/package.json`
  - `microservicioChatbot/package.json`

Comandos:

```powershell
cd microservicioGestion
npm install
npm test
npm run coverage
```

```powershell
cd microservicioComunicacion
npm install
npm test
npm run coverage
```

```powershell
cd microservicioChatbot
npm install
npm test
npm run coverage
```

Nota: si `mongodb-memory-server` falla en tu entorno, ejecuta Mongo real y define `TEST_MONGO_URI`.

Ejemplo:

```powershell
$env:TEST_MONGO_URI="mongodb://127.0.0.1:27018/comunicacion_test"
npm run coverage
```

### FastAPI/Python (api-gateway, documental, nutricion)
- Se ha anadido `pytest-cov`.
- Se ha anadido `.coveragerc` en:
  - `api-gateway/.coveragerc`
  - `microservicioDocumental/.coveragerc`
  - `microservicioNutricion/.coveragerc`
- Se ha anadido `pythonpath = .` en los `pytest.ini` de estos servicios.

Comandos:

```powershell
cd api-gateway
pip install -r requirements-dev.txt
pytest --cov=app --cov-report=term-missing --cov-report=html --cov-fail-under=80
```

```powershell
cd microservicioDocumental
pip install -r requirements-dev.txt
pytest --cov=app --cov-report=term-missing --cov-report=html --cov-fail-under=80
```

```powershell
cd microservicioNutricion
pip install -r requirements-dev.txt
pytest --cov=app --cov-report=term-missing --cov-report=html --cov-fail-under=80
```

Los reportes HTML se generan en `htmlcov/` de cada servicio.

## 2) Health checks

Estado final:
- gestion: `GET /status` y `GET /health` (con estado de DB y timestamp)
- comunicacion: `GET /health` (status + db + timestamp)
- chatbot: `GET /health` (status + db + timestamp)
- nutricion: `GET /health` (status + db)
- documental: `GET /health` (status + db, devuelve `503` si DB degradada)
- api-gateway: `GET /health` agrega estado de todos los microservicios

## 3) Prueba global con Docker

### Test e2e automatizado (raiz)
- Archivo: `tests/e2e/test_compose_stack.py`
- Verifica:
  - health de todos los servicios
  - proxy del gateway a todos los servicios
  - disponibilidad del frontend

Comandos:

```powershell
$env:RUN_COMPOSE_E2E="1"
pytest -m e2e tests/e2e/test_compose_stack.py -q
```

Para mantener el stack levantado tras el test:

```powershell
$env:RUN_COMPOSE_E2E="1"
$env:KEEP_COMPOSE_UP="1"
pytest -m e2e tests/e2e/test_compose_stack.py -q
docker compose ps
```

## 4) Postman (estructura recomendada)

Coleccion:
- `00_Health`
- `01_Auth_Gestion`
- `02_Gestion_Crud`
- `03_Nutricion`
- `04_Documental`
- `05_Comunicacion`
- `06_Chatbot`
- `07_Gateway_Proxy`
- `08_Errores`

Variables de entorno sugeridas:
- `gateway_url = http://localhost:5000`
- `gestion_url = http://localhost:4002`
- `nutricion_url = http://localhost:5002`
- `documental_url = http://localhost:5100`
- `comunicacion_url = http://localhost:4103`
- `chatbot_url = http://localhost:4701`
- `token`, `pacienteId`, `citaId`, `dietaId`, `documentoId`, `conversationId`, `sessionId`

## 5) Evidencias para memoria/defensa

Capturas recomendadas:
- Resultado `npm run coverage` (tabla de cobertura) en Node.
- `coverage/index.html` (una captura por microservicio Node).
- Resultado `pytest --cov=app` (tabla coverage) en api-gateway, documental y nutricion.
- `htmlcov/index.html` (una captura por servicio Python).
- Postman: login, CRUD principal, health checks y errores (400/401/404/502).
- `docker compose ps` con servicios `healthy`.
- `GET /health` del gateway con detalle agregado.
- Frontend accesible en `http://localhost:8080`.
