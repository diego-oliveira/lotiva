#!/bin/bash

# Lotiva Development Setup Script
echo "🚀 Setting up Lotiva development environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📋 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please update it with your configuration."
else
    echo "✅ .env file already exists."
fi

# Start Docker containers
echo "🐳 Starting PostgreSQL container..."
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# Check if PostgreSQL is ready
until docker-compose exec postgres pg_isready -U lotiva_user -d lotiva; do
    echo "⏳ PostgreSQL is still starting..."
    sleep 2
done

echo "✅ PostgreSQL is ready!"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed."
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

# Optional: Seed database
echo "🌱 Would you like to seed the database with sample data? (y/n)"
read -r response
if [[ $response =~ ^[Yy]$ ]]; then
    echo "🌱 Seeding database..."
    # npx prisma db seed (uncomment when seed script is available)
    echo "ℹ️ Seed script not implemented yet."
fi

echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update .env file with your email SMTP settings"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Visit http://localhost:3000 to access the application"
echo "4. Visit http://localhost:8080 to access pgAdmin (admin@lotiva.com / admin123)"
echo ""
echo "📚 Useful commands:"
echo "- View database: npx prisma studio"
echo "- Reset database: npx prisma migrate reset"
echo "- Stop containers: docker-compose down"
echo "- View logs: docker-compose logs -f"
