'use client';

import { useState, useEffect } from 'react';

interface ContractViewerProps {
  saleId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ContractViewer({
  saleId,
  isOpen,
  onClose
}: ContractViewerProps) {
  const [contractHTML, setContractHTML] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  useEffect(() => {
    if (isOpen && saleId) {
      fetchContract();
    }
  }, [isOpen, saleId]);

  const fetchContract = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/contracts/${saleId}`);

      if (!response.ok) {
        if (response.status === 404) {
          // Contract doesn't exist, try to generate it
          await generateContract();
          return;
        }
        throw new Error('Failed to fetch contract');
      }

      const html = await response.text();
      setContractHTML(html);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contract');
    } finally {
      setLoading(false);
    }
  };

  const generateContract = async () => {
    try {
      const generateResponse = await fetch('/api/contracts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ saleId })
      });

      if (!generateResponse.ok) {
        throw new Error('Failed to generate contract');
      }

      // After generating, fetch the contract HTML
      await fetchContract();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate contract'
      );
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setError('');
      const response = await fetch(`/api/contracts/${saleId}/pdf`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || 'Failed to generate PDF'
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
      console.error('PDF download error:', err);
      setError(err instanceof Error ? err.message : 'Failed to download PDF');
    }
  };

  const handleSendEmail = async () => {
    setEmailSending(true);

    try {
      const response = await fetch(`/api/contracts/${saleId}/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ customMessage })
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      setEmailSent(true);
      setShowEmailDialog(false);
      setCustomMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
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
    <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50'>
      <div className='relative top-4 mx-auto p-5 border w-full max-w-7xl bg-white dark:bg-gray-800 rounded-md shadow-lg min-h-[90vh]'>
        <div className='flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Visualizar Contrato
          </h3>

          <div className='flex items-center space-x-3'>
            {contractHTML && (
              <>
                <button
                  onClick={handlePrint}
                  className='inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                  title='Imprimir contrato'
                >
                  <svg
                    className='w-4 h-4 mr-2'
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
                  className='inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700'
                  title='Baixar PDF'
                >
                  <svg
                    className='w-4 h-4 mr-2'
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
                  Baixar PDF
                </button>

                <button
                  onClick={() => setShowEmailDialog(true)}
                  className='inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700'
                  title='Enviar por email'
                >
                  <svg
                    className='w-4 h-4 mr-2'
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
                  Enviar Email
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
            >
              <svg
                className='w-6 h-6'
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

        {error && (
          <div className='mb-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-md p-4'>
            <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
            <button
              onClick={() => setError(null)}
              className='mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline'
            >
              Fechar
            </button>
          </div>
        )}

        {emailSent && (
          <div className='mb-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-800 rounded-md p-4'>
            <p className='text-sm text-green-600 dark:text-green-400'>
              Contrato enviado por email com sucesso!
            </p>
            <button
              onClick={() => setEmailSent(false)}
              className='mt-2 text-sm text-green-600 dark:text-green-400 underline hover:no-underline'
            >
              Fechar
            </button>
          </div>
        )}

        <div className='mt-4 h-[80vh] overflow-auto border border-gray-200 dark:border-gray-700 rounded-md'>
          {loading ? (
            <div className='flex items-center justify-center h-full'>
              <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600'></div>
            </div>
          ) : contractHTML ? (
            <iframe
              srcDoc={contractHTML}
              className='w-full h-full border-none'
              title='Contract Preview'
            />
          ) : (
            <div className='flex items-center justify-center h-full'>
              <p className='text-gray-500 dark:text-gray-400'>
                Nenhum contrato disponível
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Email Dialog */}
      {showEmailDialog && (
        <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60'>
          <div className='relative top-20 mx-auto p-5 border w-full max-w-md bg-white dark:bg-gray-800 rounded-md shadow-lg'>
            <div className='flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700'>
              <h4 className='text-lg font-medium text-gray-900 dark:text-white'>
                Enviar Contrato por Email
              </h4>
              <button
                onClick={() => setShowEmailDialog(false)}
                className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              >
                <svg
                  className='w-5 h-5'
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
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                Mensagem Personalizada (Opcional)
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={4}
                placeholder='Digite uma mensagem personalizada para incluir no email...'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white'
              />
            </div>

            <div className='flex items-center justify-end space-x-3 mt-6'>
              <button
                onClick={() => setShowEmailDialog(false)}
                className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md'
                disabled={emailSending}
              >
                Cancelar
              </button>
              <button
                onClick={handleSendEmail}
                disabled={emailSending}
                className='px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {emailSending ? 'Enviando...' : 'Enviar Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
