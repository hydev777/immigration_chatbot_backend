## Immigration Chatbot Backend

This project is a Node.js/Express backend that powers an immigration-focused chatbot. It integrates with LLM providers and a SQL Server database to answer user questions related to immigration.

### Tech Stack

- **Runtime**: Node.js (ES modules)
- **Framework**: Express 5
- **Database**: Microsoft SQL Server (via `mssql`)
- **AI Providers**: `@google/generative-ai`, `openai`
- **Environment Management**: `dotenv`

### Project Structure

- **`src/server.js`**: Entry point that configures and starts the HTTP server.
- **`src/core/config/sql_config.js`**: Database connection configuration for SQL Server.
- **`src/core/storage.js`**: Storage and database interaction helpers.
- **`src/core/globals.js`**: Global configuration and shared constants.
- **`src/features/answer/answer_controller.js`**: HTTP handlers for answer-related routes.
- **`src/features/answer/answer_repository.js`**: Data access layer for answers and related entities.

### Prerequisites

- **Node.js**: v18 or later is recommended.
- **SQL Server**: Running instance with network access from this backend.
- **API Keys**:
  - Google Generative AI API key
  - OpenAI API key (if you use OpenAI-based models)

### Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Create a `.env` file in the project root (alongside `package.json`) with at least:

   ```bash
   PORT=3000
   NODE_ENV=development

   # SQL Server
   SQL_SERVER=localhost
   SQL_DATABASE=your_database
   SQL_USER=your_username
   SQL_PASSWORD=your_password

   # AI providers
   GOOGLE_API_KEY=your_google_generative_ai_key
   OPENAI_API_KEY=your_openai_api_key
   DEEPSEEK_API_KEY=your_deepseek_api_key
   MISTRAL_API_KEY=your_mistral_api_key
   ```

   Adjust variable names to match those used in `src/core/config/sql_config.js` and any environment reads in the codebase.

3. **Run in development**

   ```bash
   npm run dev
   ```

4. **Run in production**

   ```bash
   npm start
   ```

The server entry point is `src/server.js`. By default it listens on the port specified by the `PORT` environment variable.

### Scripts

- **`npm run dev`**: Starts the development server with hot reload (via `nodemon`, if installed globally or added later).
- **`npm start`**: Starts the production server with Node.

### Testing

No automated tests are configured yet. You can add tests later and connect them to the `npm test` script in `package.json`.

### API Overview

The main implemented feature is the **answers** capability for the chatbot:

- **`src/features/answer/answer_controller.js`** exposes Express route handlers.
- **`src/features/answer/answer_repository.js`** encapsulates database operations for answers.

Inspect these files to understand the exact routes, payloads, and response formats.

### Contributing

- Follow existing code style and structure in `src/*`.
- Keep configuration in environment variables and avoid hard-coding secrets.
- Update this `README.md` whenever you add significant new features or change environment/configuration requirements.
