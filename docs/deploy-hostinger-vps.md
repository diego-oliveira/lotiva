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
PAYMENT_CREDENTIALS_KEY
PAYMENT_WEBHOOK_BASE_URL
CRON_SECRET
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
```

Gere segredos fortes:

```bash
openssl rand -base64 32
```

Use uma chave separada em `PAYMENT_CREDENTIALS_KEY` para criptografar as
credenciais financeiras. Ela deve permanecer estável: perdê-la impede
descriptografar conexões de pagamento já cadastradas.

Use a URL final com HTTPS:

```text
NEXTAUTH_URL="https://app.seudominio.com"
AUTH_URL="https://app.seudominio.com"
PAYMENT_WEBHOOK_BASE_URL="https://app.seudominio.com"
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

O projeto possui um script que atualiza o codigo, reconstrói a imagem,
substitui os containers e exibe o status:

```bash
cd /opt/lotiva
./deploy.sh
```

Para também remover imagens Docker antigas após o deploy:

```bash
./deploy.sh --prune
```

O script:

1. Confere se `.env.production`, Git, Docker e Docker Compose estão disponíveis.
2. Interrompe caso existam alterações locais ainda não commitadas na VPS.
3. Executa `git pull --ff-only origin main`.
4. Reconstrói e atualiza os containers sem remover os volumes.
5. Exibe o status final dos serviços.

Para acompanhar os logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
```

As migrations Prisma rodam automaticamente quando o container da app sobe.
Não execute `docker compose down -v`: a opção `-v` remove os volumes persistentes.

## 9. Backups

O script `scripts/backup-database.sh` cria um `pg_dump` no formato custom,
valida o arquivo com `pg_restore`, gera um checksum SHA-256 e remove backups
mais antigos que 14 dias.

### Executar manualmente

```bash
cd /opt/lotiva
sudo ./scripts/backup-database.sh
```

Os arquivos são armazenados por padrão em:

```text
/var/backups/lotiva/database
```

Para alterar diretório ou retenção:

```bash
sudo BACKUP_DIR=/mnt/backups/lotiva BACKUP_RETENTION_DAYS=30 \
  ./scripts/backup-database.sh
```

### Agendar diariamente

Edite o cron do usuário root:

```bash
sudo crontab -e
```

Adicione a linha abaixo para executar todos os dias às 03:00:

```cron
0 3 * * * cd /opt/lotiva && ./scripts/backup-database.sh 2>&1 | /usr/bin/logger -t lotiva-backup
```

Verifique a execução:

```bash
sudo journalctl -t lotiva-backup
sudo ls -lh /var/backups/lotiva/database
```

### Agendar cobrancas e conciliacao

O processamento de webhooks deve rodar a cada minuto. A conciliacao e os
alertas de reajuste devem rodar diariamente:

```cron
* * * * * cd /opt/lotiva && ./scripts/run-payment-jobs.sh events 2>&1 | /usr/bin/logger -t lotiva-payments
15 2 * * * cd /opt/lotiva && ./scripts/run-payment-jobs.sh daily 2>&1 | /usr/bin/logger -t lotiva-payments-daily
```

Valide manualmente:

```bash
cd /opt/lotiva
./scripts/run-payment-jobs.sh events
./scripts/run-payment-jobs.sh daily
sudo journalctl -t lotiva-payments
sudo journalctl -t lotiva-payments-daily
```

Depois do deploy, abra a empresa e salve novamente a conexão Asaas para
registrar o webhook usando a URL pública.

### Restaurar

A restauração substitui toda a base e deixa a aplicação indisponível durante
o processo. O script cria automaticamente um backup de segurança do estado
atual antes de iniciar:

```bash
cd /opt/lotiva
sudo ./scripts/restore-database.sh \
  /var/backups/lotiva/database/lotiva-AAAAmmddTHHMMSSZ.dump \
  --yes
```

Faça um teste de restauração antes do lançamento e repita periodicamente.

### Cópia externa

Um backup salvo apenas na mesma VPS não protege contra perda do servidor,
disco ou conta. Antes de produção, configure também uma cópia dos arquivos
de `/var/backups/lotiva/database` para outro provedor, bucket ou máquina.

Os contratos e uploads ficam em volumes separados e não estão incluídos
neste backup do banco. Para uma segunda etapa, faça também backup dos volumes:

```bash
docker run --rm \
  -v lotiva_uploads_data:/uploads:ro \
  -v lotiva_documents_data:/documents:ro \
  -v /var/backups/lotiva:/backup \
  alpine sh -c 'tar czf /backup/files-$(date +%Y%m%dT%H%M%SZ).tar.gz /uploads /documents'
```

## 10. Pontos importantes

- Nao use o `.env` local em producao.
- `AUTH_PRINT_MAGIC_LINKS` nao deve estar ativo em producao.
- O volume `uploads_data` guarda logos e imagens enviadas pela aplicacao.
- O volume `postgres_data` guarda o banco.
- O SMTP precisa estar configurado para login por link magico funcionar.
