# Deploy na Hostinger VPS

Este guia assume uma VPS Ubuntu/Debian com acesso SSH, Docker, Docker Compose e um dominio apontando para o IP da VPS.

## 1. Preparar DNS

Crie um registro `A` no seu DNS:

```text
app.seudominio.com -> IP_DA_VPS
```

Troque `app.seudominio.com` pelo dominio real em todos os exemplos abaixo.

## 2. Instalar dependencias na VPS

```bash
sudo apt update
sudo apt install -y git nginx certbot python3-certbot-nginx docker.io docker-compose-plugin
sudo systemctl enable --now docker nginx
sudo usermod -aG docker $USER
```

Depois disso, saia e entre novamente no SSH para o grupo `docker` aplicar.

## 3. Baixar o projeto

```bash
sudo mkdir -p /opt/lotiva
sudo chown $USER:$USER /opt/lotiva
git clone git@github.com:diego-oliveira/lotiva.git /opt/lotiva
cd /opt/lotiva
```

Se preferir HTTPS:

```bash
git clone https://github.com/diego-oliveira/lotiva.git /opt/lotiva
```

## 4. Criar variaveis de producao

```bash
cp .env.production.example .env.production
nano .env.production
```

Preencha:

```text
POSTGRES_PASSWORD
NEXTAUTH_URL
NEXTAUTH_SECRET
AUTH_URL
AUTH_SECRET
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
```

Gere segredos fortes:

```bash
openssl rand -base64 32
```

Use a URL final com HTTPS:

```text
NEXTAUTH_URL="https://app.seudominio.com"
AUTH_URL="https://app.seudominio.com"
```

## 5. Subir a aplicacao

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Ver logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
```

Validar localmente na VPS:

```bash
curl http://127.0.0.1:3000
```

## 6. Configurar Nginx

```bash
sudo cp deploy/nginx/lotiva.conf.example /etc/nginx/sites-available/lotiva
sudo nano /etc/nginx/sites-available/lotiva
```

Troque `app.seudominio.com` pelo dominio real.

```bash
sudo ln -s /etc/nginx/sites-available/lotiva /etc/nginx/sites-enabled/lotiva
sudo nginx -t
sudo systemctl reload nginx
```

## 7. Ativar HTTPS

```bash
sudo certbot --nginx -d app.seudominio.com
```

Teste renovacao:

```bash
sudo certbot renew --dry-run
```

## 8. Atualizar deploy

```bash
cd /opt/lotiva
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker image prune -f
```

As migrations Prisma rodam automaticamente quando o container da app sobe.

## 9. Backups

Backup do banco:

```bash
docker exec lotiva_postgres_prod pg_dump -U lotiva_user lotiva > lotiva-backup-$(date +%Y%m%d-%H%M).sql
```

Backup dos uploads:

```bash
docker run --rm -v lotiva_uploads_data:/data -v "$PWD":/backup alpine tar czf /backup/lotiva-uploads-$(date +%Y%m%d-%H%M).tar.gz -C /data .
```

## 10. Pontos importantes

- Nao use o `.env` local em producao.
- `AUTH_PRINT_MAGIC_LINKS` nao deve estar ativo em producao.
- O volume `uploads_data` guarda logos e imagens enviadas pela aplicacao.
- O volume `postgres_data` guarda o banco.
- O SMTP precisa estar configurado para login por link magico funcionar.
