'use client';

import { useState, useEffect } from 'react';

interface ContractViewerProps {
  saleId: string;
  isOpen: boolean;
  onClose: () => void;
}

type ContractMeta = {
  contractNumber: string
  status: string
  version: number
  emailSent: boolean
  emailSentAt?: string | null
  createdAt: string
  updatedAt: string
  missingFields: string[]
  currentDocumentTemplate?: {
    id: string
    name: string
    version: number
  } | null
  documentTemplate?: {
    id: string
    name: string
    version: number
    currentPublishedVersion?: number | null
  } | null
  sale: {
    totalValue: number
    downPayment: number
    installmentCount: number
    installmentValue: number
    user: { name: string; email: string }
    lot: { identifier: string; block: { identifier: string; development: { name: string } } }
  }
  events: Array<{ id: string; title: string; description?: string | null; createdAt: string }>
}

export default function ContractViewer({
  saleId,
  isOpen,
  onClose
}: ContractViewerProps) {
  const [contractHTML, setContractHTML] = useState<string>('');
  const [contractMeta, setContractMeta] = useState<ContractMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [regenerationReason, setRegenerationReason] = useState('');
  const [useOriginalTemplate, setUseOriginalTemplate] = useState(false);

  useEffect(() => {
    if (isOpen && saleId) {
      fetchContract();
    }
  }, [isOpen, saleId]);

  const fetchContract = async () => {
    setLoading(true);
    setError(null);

    try {
      const metaResponse = await fetch(`/api/contracts/${saleId}?meta=1`, { cache: 'no-store' });
      if (metaResponse.ok) {
        const meta = await metaResponse.json() as ContractMeta;
        setContractMeta(meta);
      }

      const response = await fetch(`/api/contracts/${saleId}`);

      if (!response.ok) {
        if (response.status === 404) {
          // Gera o contrato quando ele ainda nao existe.
          await generateContract();
          return;
        }
        throw new Error('Nao foi possivel carregar o contrato');
      }

      const html = await response.text();
      setContractHTML(html);
      if (!metaResponse.ok) await fetchContractMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel carregar o contrato');
    } finally {
      setLoading(false);
    }
  };

  const fetchContractMeta = async () => {
    const response = await fetch(`/api/contracts/${saleId}?meta=1`);
    if (!response.ok) return;
    setContractMeta(await response.json());
  };

  const generateContract = async (force = false, reason = '', keepOriginalTemplate = false) => {
    try {
      setLoading(true);
      const generateResponse = await fetch('/api/contracts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ saleId, force, reason, useOriginalTemplate: keepOriginalTemplate })
      });

      if (!generateResponse.ok) {
        const payload = await generateResponse.json().catch(() => ({}));
        if (payload.missingFields) {
          throw new Error(`Pendencias para gerar contrato: ${payload.missingFields.join(', ')}`);
        }
        throw new Error(payload.error || 'Nao foi possivel gerar o contrato');
      }

      setShowRegenerateDialog(false);
      setRegenerationReason('');
      setUseOriginalTemplate(false);
      await fetchContract();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Nao foi possivel gerar o contrato'
      );
      setLoading(false);
    }
  };

  const getStatusLabel = (status?: string) => {
    const labels: Record<string, string> = {
      generated: 'Gerado',
      sent: 'Enviado',
      signed: 'Assinado',
      cancelled: 'Cancelado',
      draft: 'Rascunho',
    };
    return labels[status || ''] || 'Pendente';
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString('pt-BR') : 'Nao informado';

  const handleDownloadPDF = async () => {
    try {
      setPdfDownloading(true);
      setError(null);
      const response = await fetch(`/api/contracts/${saleId}/pdf`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || 'Nao foi possivel gerar o PDF'
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Contrato_${saleId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao baixar PDF:', err);
      setError(err instanceof Error ? err.message : 'Nao foi possivel baixar o PDF');
    } finally {
      setPdfDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    setEmailSending(true);
    setError(null);
    setEmailSent(false);

    try {
      const response = await fetch(`/api/contracts/${saleId}/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ customMessage })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.details || payload.error || 'Nao foi possivel enviar o email');
      }

      setEmailSent(true);
      setShowEmailDialog(false);
      setCustomMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel enviar o email');
    } finally {
      setEmailSending(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(contractHTML);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 bg-slate-950/40 px-4 py-4 backdrop-blur-[1px]'>
      <div className='mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl'>
        <div className='border-b border-border px-6 py-5'>
          <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Contrato</p>
              <h3 className='mt-2 text-2xl font-bold text-foreground'>{contractMeta?.contractNumber ?? 'Contrato da venda'}</h3>
              <p className='mt-1 text-sm text-muted'>Revise pendencias, gere, regenere, baixe ou envie o documento.</p>
              {contractMeta?.documentTemplate && (
                <p className='mt-2 text-xs font-semibold text-primary'>
                  {contractMeta.documentTemplate.name} · versao {contractMeta.documentTemplate.version}
                </p>
              )}
            </div>

          <div className='flex flex-wrap items-center gap-3'>
            {contractHTML && (
              <>
                <button
                  onClick={() => setShowRegenerateDialog(true)}
                  className='inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100'
                  title='Regenerar contrato'
                >
                  Regenerar
                </button>

                <button
                  onClick={handlePrint}
                  className='inline-flex items-center rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'
                  title='Imprimir contrato'
                >
                  <svg
                    className='mr-2 h-4 w-4'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z'
                    />
                  </svg>
                  Imprimir
                </button>

                <button
                  onClick={handleDownloadPDF}
                  disabled={pdfDownloading}
                  className='inline-flex items-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60'
                  title='Baixar PDF'
                >
                  <svg
                    className='mr-2 h-4 w-4'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z'
                    />
                  </svg>
                  {pdfDownloading ? 'Gerando PDF...' : 'Baixar PDF'}
                </button>

                <button
                  onClick={() => setShowEmailDialog(true)}
                  className='inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100'
                  title='Enviar por email'
                >
                  <svg
                    className='mr-2 h-4 w-4'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
                    />
                  </svg>
                  Enviar email
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className='rounded-xl border border-border bg-surface-secondary p-3 text-muted transition hover:bg-background hover:text-foreground'
              aria-label='Fechar'
            >
              <svg
                className='h-5 w-5'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M6 18L18 6M6 6l12 12'
                ></path>
              </svg>
            </button>
          </div>
          </div>
        </div>

        {error && (
          <div className='mx-6 mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3'>
            <p className='text-sm font-medium text-red-700'>{error}</p>
            <button
              onClick={() => setError(null)}
              className='mt-2 text-sm font-semibold text-red-700 underline hover:no-underline'
            >
              Fechar
            </button>
          </div>
        )}

        {emailSent && (
          <div className='mx-6 mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3'>
            <p className='text-sm font-medium text-emerald-800'>
              Contrato enviado por email com sucesso!
            </p>
            <button
              onClick={() => setEmailSent(false)}
              className='mt-2 text-sm font-semibold text-emerald-800 underline hover:no-underline'
            >
              Fechar
            </button>
          </div>
        )}

        <div className='grid min-h-0 flex-1 gap-6 p-6 lg:grid-cols-[320px_minmax(0,1fr)]'>
          <aside className='space-y-4 overflow-y-auto'>
            <div className='rounded-2xl border border-border bg-surface-secondary p-4'>
              <p className='text-xs font-semibold uppercase text-muted'>Status</p>
              <p className='mt-2 text-xl font-bold text-foreground'>{getStatusLabel(contractMeta?.status)}</p>
              <p className='mt-1 text-sm text-muted'>Versao {contractMeta?.version ?? 1}</p>
              {contractMeta?.emailSentAt && <p className='mt-2 text-xs text-muted'>Enviado em {formatDate(contractMeta.emailSentAt)}</p>}
            </div>

            {contractMeta?.sale && (
              <div className='rounded-2xl border border-border bg-surface-secondary p-4'>
                <p className='text-sm font-semibold text-foreground'>Resumo</p>
                <div className='mt-3 space-y-2 text-sm text-muted'>
                  <p><span className='font-semibold text-foreground'>Cliente:</span> {contractMeta.sale.user.name}</p>
                  <p><span className='font-semibold text-foreground'>Lote:</span> Quadra {contractMeta.sale.lot.block.identifier}, Lote {contractMeta.sale.lot.identifier}</p>
                  <p><span className='font-semibold text-foreground'>Empreendimento:</span> {contractMeta.sale.lot.block.development.name}</p>
                  <p><span className='font-semibold text-foreground'>Valor:</span> {formatCurrency(contractMeta.sale.totalValue)}</p>
                  <p><span className='font-semibold text-foreground'>Entrada:</span> {formatCurrency(contractMeta.sale.downPayment)}</p>
                  <p><span className='font-semibold text-foreground'>Parcelas:</span> {contractMeta.sale.installmentCount}x de {formatCurrency(contractMeta.sale.installmentValue)}</p>
                </div>
              </div>
            )}

            {contractMeta?.missingFields && contractMeta.missingFields.length > 0 && (
              <div className='rounded-2xl border border-amber-200 bg-amber-50 p-4'>
                <p className='text-sm font-semibold text-amber-900'>Pendencias</p>
                <ul className='mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800'>
                  {contractMeta.missingFields.map((field) => <li key={field}>{field}</li>)}
                </ul>
              </div>
            )}

            {contractMeta?.events && contractMeta.events.length > 0 && (
              <div className='rounded-2xl border border-border bg-surface-secondary p-4'>
                <p className='text-sm font-semibold text-foreground'>Historico</p>
                <div className='mt-3 space-y-3'>
                  {contractMeta.events.slice(0, 6).map((event) => (
                    <div key={event.id} className='border-l-2 border-primary/30 pl-3'>
                      <p className='text-sm font-semibold text-foreground'>{event.title}</p>
                      <p className='text-xs text-muted'>{formatDate(event.createdAt)}</p>
                      {event.description && <p className='mt-1 text-xs text-muted'>{event.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div className='min-h-0 overflow-hidden rounded-2xl border border-border bg-surface-secondary'>
          {loading ? (
            <div className='flex h-full items-center justify-center'>
              <div className='h-12 w-12 animate-spin rounded-full border-b-2 border-primary'></div>
            </div>
          ) : contractHTML ? (
            <iframe
              srcDoc={contractHTML}
              className='h-full w-full border-none bg-white'
              title='Visualizacao do contrato'
            />
          ) : (
            <div className='flex h-full items-center justify-center'>
              <p className='text-sm text-muted'>
                Nenhum contrato disponivel
              </p>
            </div>
          )}
          </div>
        </div>
      </div>

      {showEmailDialog && (
        <div className='fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4'>
          <div className='w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl'>
            <div className='flex items-center justify-between gap-4 border-b border-border pb-4'>
              <h4 className='text-lg font-semibold text-foreground'>
                Enviar contrato por email
              </h4>
              <button
                onClick={() => setShowEmailDialog(false)}
                className='rounded-xl border border-border bg-surface-secondary p-2 text-muted transition hover:bg-background hover:text-foreground'
              >
                <svg
                  className='h-5 w-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M6 18L18 6M6 6l12 12'
                  ></path>
                </svg>
              </button>
            </div>

            <div className='mt-4'>
              <label className='mb-2 block text-sm font-semibold text-foreground'>
                Mensagem personalizada (opcional)
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={4}
                placeholder='Digite uma mensagem personalizada para incluir no email...'
                className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
              />
            </div>

            <div className='mt-6 flex items-center justify-end gap-3'>
              <button
                onClick={() => setShowEmailDialog(false)}
                className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'
                disabled={emailSending}
              >
                Cancelar
              </button>
              <button
                onClick={handleSendEmail}
                disabled={emailSending}
                className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50'
              >
                {emailSending ? 'Enviando...' : 'Enviar email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRegenerateDialog && (
        <div className='fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4'>
          <div className='w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl'>
            <h4 className='text-lg font-semibold text-foreground'>Regenerar contrato</h4>
            <p className='mt-2 text-sm leading-6 text-muted'>
              O contrato sera recriado com os dados atuais da venda, cliente e configuracao do empreendimento.
            </p>
            <label className='mt-5 block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Motivo</span>
              <textarea
                value={regenerationReason}
                onChange={(event) => setRegenerationReason(event.target.value)}
                rows={4}
                className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                placeholder='Ex.: cliente atualizou dados para contrato'
              />
            </label>
            {contractMeta?.documentTemplate && (
              <label className='mt-4 flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-3'>
                <input
                  type='checkbox'
                  checked={useOriginalTemplate}
                  onChange={(event) => setUseOriginalTemplate(event.target.checked)}
                  className='mt-1'
                />
                <span>
                  <span className='block text-sm font-semibold text-foreground'>Manter a versao original do modelo</span>
                  <span className='mt-1 block text-xs text-muted'>
                    Versao usada: {contractMeta.documentTemplate.version}. Desmarcado, sera usada a versao publicada atual
                    {contractMeta.documentTemplate.currentPublishedVersion ? ` (${contractMeta.documentTemplate.currentPublishedVersion})` : ''}.
                  </span>
                </span>
              </label>
            )}
            <div className='mt-6 flex justify-end gap-3'>
              <button onClick={() => setShowRegenerateDialog(false)} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
                Cancelar
              </button>
              <button onClick={() => generateContract(true, regenerationReason, useOriginalTemplate)} disabled={!regenerationReason.trim()} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'>
                Regenerar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
