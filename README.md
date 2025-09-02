# Lotiva - Real Estate Lot Management System

A comprehensive web application for managing real estate lots, blocks, customers, reservations, sales, and automated contract generation with email distribution.

## 🏗️ Project Overview

Lotiva is a Next.js-based real estate management system designed specifically for lot sales and management. The system provides a complete workflow from lot creation to contract generation and email distribution, making it ideal for real estate developers and agencies managing subdivision projects.

## ✨ Features

### Core Functionality

- **🏘️ Block Management**: Create and organize property blocks
- **📍 Lot Management**: Detailed lot information with measurements, pricing, and status tracking
- **👥 Customer Management**: Complete customer profiles with personal and contact information
- **📋 Reservation System**: Handle lot reservations with proposal tracking
- **💰 Sales Management**: Process sales with flexible payment terms and installment options
- **📄 Contract Generation**: Automated contract generation with ABNT formatting standards
- **📧 Email Integration**: Automatic contract distribution via email with PDF attachments

### Contract System

- **ABNT Standard Margins**: Contracts follow Brazilian ABNT formatting standards (3cm top/left, 2cm bottom/right margins)
- **PDF Generation**: High-quality PDF contracts using Puppeteer
- **Automated Email Distribution**: Contracts are automatically sent to customers via email
- **Professional Templates**: Pre-formatted legal contract templates

### Business Features

- **Payment Flexibility**: Support for down payments and installment plans
- **Annual Adjustments**: Automatic price adjustments with INCC/IPCA indices
- **Status Tracking**: Real-time lot availability and sale status
- **Search & Filtering**: Advanced filtering and search capabilities
- **Responsive Design**: Mobile-friendly interface using Tailwind CSS

## 🛠️ Technology Stack

### Frontend

- **Next.js 15.3.4**: React framework with App Router
- **React 19**: Latest React version with new features
- **TypeScript 5**: Type-safe development
- **Tailwind CSS 4**: Utility-first CSS framework

### Backend

- **Next.js API Routes**: Serverless API endpoints
- **Prisma ORM**: Database management and migrations
- **PostgreSQL**: Primary database
- **Node.js**: Runtime environment

### Additional Libraries

- **Puppeteer**: PDF generation from HTML
- **Nodemailer**: Email sending functionality
- **Prisma Client**: Type-safe database client

## 📁 Project Structure

```
lotiva/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── blocks/              # Block management endpoints
│   │   ├── clients/             # Customer management endpoints
│   │   ├── contracts/           # Contract generation and management
│   │   ├── lots/                # Lot management endpoints
│   │   ├── reservations/        # Reservation handling
│   │   └── sales/               # Sales processing
│   ├── clients/                 # Customer management pages
│   │   └── components/          # Client-specific components
│   ├── lots/                    # Lot management pages
│   ├── sales/                   # Sales management pages
│   │   └── components/          # Sales-specific components
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Homepage
│   └── globals.css             # Global styles
├── lib/                         # Utility libraries
│   ├── contractGenerator.ts    # Contract HTML/PDF generation
│   ├── emailService.ts         # Email functionality
│   ├── pdfGenerator.ts         # PDF creation utilities
│   └── prisma.ts              # Prisma client configuration
├── prisma/                      # Database configuration
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Database migrations
└── public/                      # Static assets
```

## 🗄️ Database Schema

### Core Entities

#### Block

- Represents property blocks/quadras
- Contains multiple lots
- Identified by unique identifiers

#### Lot

- Individual property lots within blocks
- Detailed measurements (front, back, left side, right side)
- Pricing and availability status
- Total area calculations

#### Customer (Client)

- Complete customer profiles
- Personal information (CPF, RG, address)
- Contact details and professional information
- Marital status and birthplace data

#### Reservation

- Lot reservation system
- Proposal tracking
- Status management
- Links customers to specific lots

#### Sale

- Sales transaction records
- Payment terms and installment details
- Annual adjustment options
- Links customers, lots, and reservations

#### Contract

- Generated contract documents
- Email tracking functionality
- Unique contract numbering system
- Content storage and versioning

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- SMTP email service (Gmail, etc.)

### Quick Setup (Recommended)

1. **Clone the repository**

```bash
git clone https://github.com/diego-oliveira/lotiva.git
cd lotiva
```

2. **Run the setup script**

```bash
./setup.sh
```

This script will:

- Create `.env` file from template
- Start PostgreSQL container with Docker
- Install dependencies
- Generate Prisma client
- Run database migrations

3. **Configure email settings**
   Edit `.env` file with your SMTP credentials:

```env
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="your-email@gmail.com"
```

4. **Start development server**

```bash
npm run dev
```

### Manual Setup

1. **Clone and install**

```bash
git clone https://github.com/diego-oliveira/lotiva.git
cd lotiva
npm install
```

2. **Start PostgreSQL with Docker**

```bash
docker-compose up -d postgres
```

3. **Environment Setup**
   Copy `.env.example` to `.env` and update with your settings:

```bash
cp .env.example .env
```

4. **Database Setup**

```bash
npx prisma generate
npx prisma migrate deploy
```

5. **Start development server**

```bash
npm run dev
```

### Available Commands

Using Make (recommended):

```bash
make setup      # Complete setup
make dev        # Start development
make docker-up  # Start containers
make docker-down # Stop containers
make studio     # Open database viewer
make reset      # Reset database
make help       # Show all commands
```

Using npm scripts:

```bash
npm run dev     # Development server
npm run build   # Build for production
npm start       # Start production server
```

### Database Access

- **Application**: http://localhost:3000
- **Prisma Studio**: `npx prisma studio` or `make studio`
- **pgAdmin**: http://localhost:8080 (admin@lotiva.com / admin123)
- **Direct PostgreSQL**: localhost:5432 (lotiva_user / lotiva_password)

The application will be available at `http://localhost:3000`

### Production Deployment

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 📋 Usage Guide

### Managing Blocks and Lots

1. Navigate to `/lots` to view and manage property lots
2. Create blocks to organize lots by geographical areas
3. Add individual lots with detailed measurements and pricing
4. Set lot status (available, reserved, sold)

### Customer Management

1. Go to `/clients` to manage customer database
2. Add new customers with complete personal information
3. Edit existing customer details as needed
4. Search and filter customers by various criteria

### Processing Sales

1. Visit `/sales` to handle sales transactions
2. Create new sales by selecting customers and lots
3. Configure payment terms (down payment, installments)
4. Set annual adjustment preferences
5. Generate and send contracts automatically

### Contract Generation

- Contracts are automatically generated upon sale completion
- PDF contracts follow ABNT formatting standards
- Contracts include all legal clauses and customer/lot details
- Automatic email distribution with PDF attachments

## 🔧 Configuration

### Email Settings

Configure SMTP settings in environment variables for automatic contract distribution:

- Supports Gmail, Outlook, and custom SMTP servers
- Requires app-specific passwords for secure authentication

### Database Configuration

- Uses PostgreSQL with Prisma ORM
- Automatic migrations and schema management
- Type-safe database operations

### PDF Generation

- Puppeteer-based PDF generation
- ABNT standard margins (3cm top/left, 2cm bottom/right)
- Professional contract formatting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software developed for Terranova Incorporação e Construção Ltda.

## 🏢 Company Information

**Terranova Incorporação e Construção Ltda**

- CNPJ: 59.506.986/0001-19
- Address: Travessa Boa Vista, S/N, Lote 09 Quadra 01 – Loteamento Bosque do Guaraípe
- Location: Barra do Jacuípe (Monte Gordo) – Camaçari – Bahia – CEP: 42.837-398

## 👥 Development Team

- **Diego de Sousa Oliveira** - Partner Administrator
- **Hari Alexandre Brust Filho** - Partner Administrator

## 📞 Support

For technical support or business inquiries, please contact the development team through the company's official channels.

---

**Lotiva** - Streamlining real estate lot management with modern web technology.
