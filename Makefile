.PHONY: setup dev build start stop clean reset logs studio

# Setup development environment
setup:
	@echo "🚀 Setting up Lotiva development environment..."
	@./setup.sh

# Start development server
dev:
	@echo "🔥 Starting development server..."
	@npm run dev

# Build the application
build:
	@echo "🏗️ Building application..."
	@npm run build

# Start production server
start:
	@echo "🚀 Starting production server..."
	@npm start

# Start Docker containers
docker-up:
	@echo "🐳 Starting Docker containers..."
	@docker-compose up -d

# Stop Docker containers
docker-down:
	@echo "🛑 Stopping Docker containers..."
	@docker-compose down

# Stop all services
stop: docker-down
	@echo "✅ All services stopped"

# Clean up containers and volumes
clean:
	@echo "🧹 Cleaning up Docker containers and volumes..."
	@docker-compose down -v
	@docker system prune -f

# Reset database
reset:
	@echo "🔄 Resetting database..."
	@npx prisma migrate reset --force

# View database in Prisma Studio
studio:
	@echo "📊 Opening Prisma Studio..."
	@npx prisma studio

# View Docker logs
logs:
	@echo "📋 Viewing Docker logs..."
	@docker-compose logs -f

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	@npm install

# Generate Prisma client
generate:
	@echo "🔧 Generating Prisma client..."
	@npx prisma generate

# Run database migrations
migrate:
	@echo "🗄️ Running database migrations..."
	@npx prisma migrate deploy

# Help
help:
	@echo "🆘 Available commands:"
	@echo "  make setup     - Setup development environment"
	@echo "  make dev       - Start development server"
	@echo "  make build     - Build application"
	@echo "  make start     - Start production server"
	@echo "  make docker-up - Start Docker containers"
	@echo "  make docker-down - Stop Docker containers"
	@echo "  make stop      - Stop all services"
	@echo "  make clean     - Clean Docker containers and volumes"
	@echo "  make reset     - Reset database"
	@echo "  make studio    - Open Prisma Studio"
	@echo "  make logs      - View Docker logs"
	@echo "  make install   - Install dependencies"
	@echo "  make generate  - Generate Prisma client"
	@echo "  make migrate   - Run database migrations"
