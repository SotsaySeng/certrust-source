# Node 22 matches local development (Node 20 reached end-of-life in April
# 2026). Alpine 3.23 is pinned because it is the first to ship
# postgresql18-client, below.
FROM node:22-alpine3.23

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci
# Install PostgreSQL client
RUN npm install pg --save
# pg_dump/pg_restore for scripts/backup.js, backup-offsite.js and
# restore.js (see docs/self-hosting.md). Version 18 to match the production
# database (Neon, Postgres 18): pg_dump refuses to dump a newer server, and
# an 18 client still dumps the postgres:16 in docker-compose.yml.
RUN apk add --no-cache postgresql18-client
# Fonts for rasterising the certificate SVG into link-preview images
# (/credentials/:id/share-image). Alpine ships none, and without them every
# line of text renders blank. Lao and Thai cover recipient names in the
# region; noto-emoji draws the trophy on certificates without a badge image.
RUN apk add --no-cache fontconfig font-dejavu font-noto font-noto-lao font-noto-thai font-noto-emoji

# Copy application files
COPY . .

# Build the application
RUN npm run build

# Expose the port
EXPOSE 1337

# Start the application in production mode
CMD ["npm", "run", "start"] 