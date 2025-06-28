'use client'

interface DeleteConfirmModalProps {
  isOpen: boolean
  clientName: string
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}

export default function DeleteConfirmModal({
  isOpen,
  clientName,
  onClose,
  onConfirm,
  loading
}: DeleteConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 bg-white dark:bg-gray-800 rounded-md shadow-lg">
        <div className="mt-3 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
            <svg
              className="h-6 w-6 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mt-2">
            Confirmar Exclusão
          </h3>
          <div className="mt-2 px-7 py-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Tem certeza que deseja excluir o cliente{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {clientName}
              </span>
              ? Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="items-center px-4 py-3">
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-200 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}