FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy only the NestJS app folder
COPY ./birthday-app/package.json ./
COPY ./birthday-app/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Copy the rest of the source code
COPY birthday-app/ ./

# Expose NestJS port
EXPOSE 3000

# Start the app
CMD ["pnpm", "run", "start:dev"]