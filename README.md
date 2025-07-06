# Getting Started

Follow these steps to get the project up and running on your local machine.

---

## 1. Clone the Repository

```bash
git clone <your-repository-url>
cd <your-project-directory>
```

---

## 2. Server Setup (NestJS)

Navigate to the server directory, install dependencies, and set up the environment.

```bash
cd server
npm install # or yarn install
```

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
# server/.env

CLIENT_BASE_URL="http://localhost:3000"
PORT=3001
DATABASE_URL="postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:<DB_PORT>/<DB_NAME>?schema=public"
BITRIX24_DEFAULT_DOMAIN="<BITRIX24_DOMAIN>"
BITRIX24_CLIENT_ID="<BITRIX24_CLIENT_ID>"
BITRIX24_CLIENT_SECRET="<BITRIX24_CLIENT_SECRET>"
BITRIX24_REDIRECT_URI="<BITRIX24_REDIRECT_URI>"
```

### Database Migration

Run Prisma migrations to initialize the database schema:

```bash
npx prisma migrate dev --name init
```

---

## 3. Client Setup (Next.js)

Navigate to the client directory and install dependencies:

```bash
cd ../client
npm install # or yarn install
```

### Environment Variables

Create a `.env.local` file in the `client/`:

```env
# client/.env.local

NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/bitrix
NEXT_PUBLIC_MEMBER_ID=<BITRIX24_MEMBER_ID>
```

## 4. Running the Application

You can now start both the client and server concurrently.

### Start Server

From the `server/` directory:

```bash
npm run start:dev # or yarn start:dev
```

The server should be running at:  
📍 `http://localhost:3001`

### Start Client

From the `client/` directory:

```bash
npm run dev # or yarn dev
```

The client should be available at:  
🌐 `http://localhost:3000`

---

## 🎉 You're All Set!

Open your browser and visit [http://localhost:3000](http://localhost:3000) to access the application.
