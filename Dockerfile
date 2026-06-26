FROM node:18-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy source code
COPY src/ ./src/
COPY public/ ./public/
COPY SUST_Preli_Sample_Cases.json ./

# Expose the port
EXPOSE 3000

# Set production defaults
ENV NODE_ENV=production
ENV PORT=3000

# Start the server
CMD ["node", "src/server.js"]
