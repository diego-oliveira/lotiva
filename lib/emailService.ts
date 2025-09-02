import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configure with environment variables
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"Lotiva" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  async sendContractEmail(
    customerEmail: string,
    customerName: string,
    contractNumber: string,
    pdfBuffer: Buffer,
    customMessage?: string
  ): Promise<boolean> {
    const defaultMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Contrato de Compra e Venda</h2>
        <p>Olá <strong>${customerName}</strong>,</p>
        <p>Segue em anexo o seu contrato de compra e venda <strong>${contractNumber}</strong>.</p>
        <p>Por favor, revise o documento e entre em contato conosco caso tenha alguma dúvida.</p>
        ${
          customMessage
            ? `<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;"><p><strong>Mensagem personalizada:</strong></p><p>${customMessage}</p></div>`
            : ''
        }
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="margin: 0;"><strong>Lotiva Desenvolvimento Imobiliário</strong></p>
          <p style="margin: 5px 0; color: #666;">Telefone: (11) 1234-5678</p>
          <p style="margin: 5px 0; color: #666;">Email: contato@lotiva.com.br</p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: customerEmail,
      subject: `Contrato de Compra e Venda - ${contractNumber}`,
      html: defaultMessage,
      attachments: [
        {
          filename: `Contrato_${contractNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('SMTP connection failed:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
