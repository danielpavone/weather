# Painel de clima

Aplicação com frontend React e backend Express para consultar o clima atual de uma cidade. O frontend fala apenas com o backend. O backend consulta a [Geocoding API](https://open-meteo.com/en/docs/geocoding-api) e a [Weather API](https://open-meteo.com/en/docs) da Open-Meteo. Nenhuma chave de API é necessária.

## Pré-requisitos

- Node.js 22+
- npm

## Instalação

```bash
cd backend
npm install

cd ../frontend
npm install
```

## Executar

Em terminais separados:

```bash
# terminal 1
cd backend
npm run dev

# terminal 2
cd frontend
npm run dev
```

- Backend: `http://localhost:3000`
- Painel: `http://localhost:5173`

Abra o painel, digite uma cidade (por exemplo, `São Paulo`) e clique em **Buscar**. O cartão mostra temperatura, sensação térmica, umidade, vento e a descrição do tempo.

O botão de localização pede a posição do navegador e consulta o clima pelas coordenadas. Se a permissão for negada, a busca manual continua disponível. Na primeira visita, o painel tenta sugerir a cidade automaticamente; a recusa da permissão não bloqueia o uso.

Para apontar o frontend a outro endereço de API:

```bash
cd frontend
VITE_API_URL=http://localhost:3001 npm run dev
```

Para mudar a porta do backend:

```bash
cd backend
PORT=3001 npm run dev
```

## Endpoint

`GET /api/weather`

### Por cidade

```bash
curl "http://localhost:3000/api/weather?city=S%C3%A3o%20Paulo"
```

### Por coordenadas

```bash
curl "http://localhost:3000/api/weather?latitude=-23.55&longitude=-46.63"
```

Quando só há coordenadas, o backend busca o clima na Open-Meteo e tenta resolver o nome da cidade com a geocodificação reversa do OpenStreetMap. Se essa etapa falhar, o clima ainda é retornado e `location.name` vem `null`.

### Resposta

```json
{
  "location": {
    "name": "São Paulo",
    "country": "Brasil",
    "admin1": "São Paulo",
    "latitude": -23.55,
    "longitude": -46.63,
    "timezone": "America/Sao_Paulo"
  },
  "current": {
    "time": "2026-10-30T15:00",
    "temperature": 27.2,
    "apparentTemperature": 29.1,
    "humidity": 61,
    "windSpeed": 13.4,
    "weatherCode": 2,
    "description": "Parcialmente nublado",
    "isDay": true
  },
  "units": {
    "temperature": "°C",
    "apparentTemperature": "°C",
    "humidity": "%",
    "windSpeed": "km/h"
  }
}
```

### Erros

| Situação | Status | Mensagem |
| --- | --- | --- |
| Cidade ausente ou em branco, sem coordenadas | 400 | Informe o nome de uma cidade. |
| Cidade com um caractere | 400 | Informe pelo menos 2 caracteres para buscar uma cidade. |
| Latitude ou longitude inválida | 400 | Latitude ou longitude inválida. |
| Cidade não encontrada | 404 | Não encontramos essa cidade. Verifique o nome e tente novamente. |
| Falha da API externa | 502 | Não foi possível consultar o serviço de clima. Tente novamente em instantes. |

O corpo do erro é `{ "message": "..." }`.

O health check continua em `GET /health`.

## Testes e build

```bash
cd backend
npm test
npm run build

cd ../frontend
npm run lint
npm run typecheck
npm run build
```

Os testes do backend usam Vitest e mockam as chamadas à Open-Meteo (sucesso, cidade inexistente, falha externa e entrada inválida) e o fluxo por coordenadas.
