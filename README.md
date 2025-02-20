# Wirtualny Asystent

Wirtualny Asystent to projekt oparty na Deno, który integruje się z Discordem, oferując funkcje takie jak obsługa komend, pobieranie filmów z platform społecznościowych oraz interakcje z modelem językowym.

## Spis treści

- [Wymagania wstępne](#wymagania-wstępne)
- [Instalacja](#instalacja)
- [Konfiguracja](#konfiguracja)
- [Uruchomienie](#uruchomienie)
- [Funkcje](#funkcje)
- [Technologie](#technologie)
- [Autor](#autor)

## Wymagania wstępne

Przed rozpoczęciem upewnij się, że masz zainstalowane:

- [Git](https://git-scm.com/)
- [Deno](https://deno.land/)
- [MongoDB](https://www.mongodb.com/try/download/community)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [Ollama](https://ollama.com/)

## Instalacja

1. **Sklonuj repozytorium:**

   ```bash
   git clone https://github.com/MchBr02/wirtualny-asystent.git
   cd wirtualny-asystent
   ```

2. **Zainstaluj zależności:**

   Projekt korzysta z Deno, który zarządza zależnościami automatycznie. Upewnij się, że masz zainstalowane Deno w wersji co najmniej 1.0.0.

## Konfiguracja

1. **Utwórz plik `.env`:**

   W katalogu głównym projektu utwórz plik `.env` i dodaj do niego następujące zmienne środowiskowe:

   ```env
   DISCORD_TOKEN=your_discord_token
   MONGO_URI=mongodb://localhost:27017
   MONGO_DB_NAME=your_database_name
   MONGO_ADMIN_USER=your_mongo_admin_username
   MONGO_ADMIN_PASS=your_mongo_admin_password
   ```

   Upewnij się, że zastąpiłeś wartości odpowiednimi danymi.

## Uruchomienie

Projekt zawiera skrypt `start.sh`, który automatyzuje proces instalacji i uruchomienia. Aby go użyć:

1. **Nadaj uprawnienia do wykonania skryptu:**

   ```bash
   chmod +x start.sh
   ```

2. **Uruchom skrypt:**

   ```bash
   ./start.sh
   ```

   Skrypt ten:

   - Ładuje zmienne środowiskowe z pliku `.env`.
   - Sprawdza i instaluje wymagane zależności, takie jak MongoDB, yt-dlp, Deno i Ollama.
   - Weryfikuje istnienie użytkownika administratora MongoDB i tworzy go, jeśli nie istnieje.
   - Uruchamia aplikację.

   **Uwaga:** Skrypt wymaga uprawnień administratora do instalacji niektórych zależności.

## Funkcje

- **Integracja z Discordem:** Bot nasłuchuje na wiadomości i reaguje na określone komendy.
- **Pobieranie filmów:** Automatyczne pobieranie filmów z linków Instagram i TikTok.
- **Interakcje z modelem językowym:** Obsługa komendy `!ask` umożliwiającej zadawanie pytań modelowi językowemu.

## Technologie

- **Deno:** Środowisko uruchomieniowe dla JavaScript i TypeScript.
- **MongoDB:** Baza danych NoSQL.
- **yt-dlp:** Narzędzie do pobierania filmów z serwisów streamingowych.
- **Ollama:** Platforma modeli językowych.

## Autor

Projekt stworzony przez [MchBr02](https://github.com/MchBr02).

---

*Pamiętaj, aby regularnie aktualizować zależności i przestrzegać najlepszych praktyk bezpieczeństwa podczas pracy z tokenami i danymi uwierzytelniającymi.* 
