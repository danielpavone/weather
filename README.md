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

Quando só há coordenadas, o backend busca o clima na Open-Meteo e tenta resolver o nome da cidade no [Nominatim](https://nominatim.org/) (OpenStreetMap). Se essa etapa falhar, o clima ainda é retornado e `location.name` vem `null`.

### Nominatim

A geocodificação reversa usa `https://nominatim.openstreetmap.org/reverse` apenas no fluxo de latitude/longitude. A [política de uso](https://operations.osmfoundation.org/policies/nominatim/) exige no máximo uma requisição por segundo, um User-Agent que identifique a aplicação e atribuição aos dados do OpenStreetMap.

O backend aplica isso assim:

- fila interna com intervalo mínimo de 1 segundo entre chamadas (`NOMINATIM_MIN_INTERVAL_MS`, padrão `1000`);
- teto dessa fila (`NOMINATIM_MAX_QUEUE`, padrão `8`); acima dele a resposta segue sem o nome da cidade, em vez de esperar sem limite;
- User-Agent padrão `weather-dashboard/1.0 (https://github.com/danielpavone/weather)`, substituível por `NOMINATIM_USER_AGENT`;
- cache LRU do nome resolvido por coordenada arredondada (`REVERSE_GEOCODE_CACHE_TTL_MS`, padrão 24 horas; `REVERSE_GEOCODE_CACHE_MAX`, padrão `1000`);
- se o Nominatim falhar, recusar a chamada ou a fila estiver cheia, o clima da Open-Meteo continua sendo respondido.

Atribuição: dados de localização © colaboradores do OpenStreetMap.

### Cache, limite e CORS

Consultas repetidas à Open-Meteo ficam num cache LRU por cidade (sem diferenciar maiúsculas) ou por coordenada. A chave de coordenada arredonda para duas casas decimais (cerca de 1,1 km) só para agrupar pontos próximos; a previsão em si usa a latitude e a longitude exatas. O tempo padrão é 10 minutos (`WEATHER_CACHE_TTL_MS`) e o teto é 1000 entradas (`WEATHER_CACHE_MAX`). Entradas vencidas saem na próxima leitura ou gravação do cache, mesmo que a chave consultada seja outra. Ao passar do teto, sai a entrada usada há mais tempo.

`GET /api/weather` também tem limite por IP: 30 requisições por minuto (`WEATHER_RATE_LIMIT_MAX` e `WEATHER_RATE_LIMIT_WINDOW_MS`). Acima disso a resposta é `429`.

Atrás de um proxy reverso ou PaaS, o IP do cliente chega em `X-Forwarded-For`. Sem configurar o proxy, o limite enxerga só o IP do balanceador. Defina o número de hops confiáveis (o valor `true` é recusado):

```bash
TRUST_PROXY=1
```

O padrão é não confiar em `X-Forwarded-For`.

O CORS não reflete qualquer origem. Sem configuração, aceita só `http://localhost:5173` e `http://127.0.0.1:5173`. Em produção defina origens explícitas, no formato `http(s)://host[:porta]`, sem caminho:

```bash
CORS_ORIGIN=https://clima.example
```

Várias origens podem ser separadas por vírgula. O valor `*` é recusado.

O backend também envia cabeçalhos do Helmet. A política `Cross-Origin-Resource-Policy` fica `cross-origin` para o painel, em outra porta, conseguir ler a API.

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
| Cidade com mais de 100 caracteres | 400 | O nome da cidade pode ter no máximo 100 caracteres. |
| Latitude ou longitude inválida | 400 | Latitude ou longitude inválida. |
| Cidade não encontrada | 404 | Não encontramos essa cidade. Verifique o nome e tente novamente. |
| Falha da API externa | 502 | Não foi possível consultar o serviço de clima. Tente novamente em instantes. |
| Muitas consultas no intervalo | 429 | Muitas consultas em pouco tempo. Tente novamente em instantes. |
| Erro inesperado | 500 | Erro interno do servidor. |

O corpo do erro é `{ "message": "..." }`.

O health check continua em `GET /health`.

## Testes e build

O workflow de CI (`.github/workflows/ci.yml`) roda, no backend e no frontend, lint, typecheck, testes e build.

```bash
cd backend
npm run lint
npm run typecheck
npm test
npm run build

cd ../frontend
npm run lint
npm run typecheck
npm test
npm run build
```

Os testes do backend usam Vitest e mockam a Open-Meteo e o Nominatim: sucesso, cidade inexistente, falha externa, entrada inválida, cache LRU (teto e expiração), fila cheia do Nominatim, limite de consultas por IP com `TRUST_PROXY`, CORS e falha da geocodificação reversa (rede ou HTTP), caso em que o clima ainda é retornado.

Os testes do frontend usam Vitest e Testing Library. Cobrem `getWeather` (query, mensagem do backend, resposta inválida e falha de rede), o hook `useWeather` e o `WeatherPanel` (carregamento, erro, sucesso e geolocalização negada).
