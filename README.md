# Unique – Eigen Web Menu Server

## Hoe het werkt

De cheat maakt bij opstart verbinding met een server via:
- `POST /api/menu/session` → sessie aanmaken + QR-code URL ophalen
- `POST /api/menu/sync`    → elke 600ms state synchroniseren + commando's ontvangen

Jij beheert nu die server zelf. Zodra iemand de QR-code scant, gaat hij naar
jouw `/menu` pagina. Daar kan hij alle cheat-opties aan/uit zetten en sliders
aanpassen — en de cheat verwerkt dat direct in-game.

---

## 1. Server installeren

```bash
cd WebServer
npm install
node server.js
```

Server draait op http://localhost:3000

---

## 2. Publiek bereikbaar maken (vereist voor QR op telefoon)

Je hebt een domein of tunnel nodig zodat je telefoon de server kan bereiken.

### Optie A – Eigen VPS/domein (aanbevolen)
Upload de `WebServer/` map naar je server en run:
```bash
BASE_URL=https://jouwdomein.nl node server.js
```

### Optie B – Tijdelijk testen via ngrok (gratis)
```bash
npx ngrok http 3000
```
Kopieer de https://xxxx.ngrok.io URL en zet hem als BASE_URL.

---

## 3. SecureRoutes.hpp aanpassen

Open: `Unique-Ext/Network/SecureRoutes.hpp`

Zoek naar:
```cpp
std::string narrow = XorString("uniquefivem.xyz");
```
Verander dit naar jouw domein:
```cpp
std::string narrow = XorString("jouwdomein.nl");
```

Doe hetzelfde voor BaseUrl():
```cpp
std::string narrow = XorString("https://jouwdomein.nl");
```

Bouw daarna de cheat opnieuw (Visual Studio → Build).

---

## 4. Routes (optioneel aanpassen)

De cheat gebruikt nu `/api/menu/session` en `/api/menu/sync` als legacy routes.
Als je de obfuscated routes wil gebruiken, pas je ook `Path()` aan in SecureRoutes.hpp.

De server accepteert beide paths:
- Legacy: `/api/menu/session` en `/api/menu/sync`
- Obfuscated: configureer zelf in server.js als extra route

---

## API overzicht

| Method | Pad | Beschrijving |
|--------|-----|-------------|
| POST | /api/menu/session | Cheat maakt sessie aan |
| POST | /api/menu/sync | Cheat synchroniseert state |
| GET  | /api/menu/state?session=X&code=Y | Website leest state |
| POST | /api/menu/set?session=X&code=Y | Website stuurt commando |
| POST | /api/menu/batch?session=X&code=Y | Website stuurt meerdere commando's |
| GET  | /menu?session=X&code=Y | Web menu pagina (telefoon) |
