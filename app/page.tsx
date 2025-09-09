import React from 'react';

export default function Home() {
  return (
    <div className='min-h-screen flex flex-col items-center justify-center bg-gray-50'>
      <h1 className='text-3xl font-bold mb-8'>
        Lotiva - Real Estate Management
      </h1>
      <nav className='flex flex-col gap-4 w-full max-w-md'>
        <a
          href='/sales'
          className='block w-full px-6 py-4 rounded-lg bg-blue-600 text-white text-lg font-semibold text-center shadow hover:bg-blue-700 transition-colors'
        >
          Vendas
        </a>
        <a
          href='/clients'
          className='block w-full px-6 py-4 rounded-lg bg-green-600 text-white text-lg font-semibold text-center shadow hover:bg-green-700 transition-colors'
        >
          Clientes
        </a>
        <a
          href='/lots'
          className='block w-full px-6 py-4 rounded-lg bg-yellow-500 text-white text-lg font-semibold text-center shadow hover:bg-yellow-600 transition-colors'
        >
          Lotes
        </a>
      </nav>
      <p className='mt-8 text-gray-500 text-center'>
        Bem-vindo ao sistema Lotiva! Escolha uma opção para começar.
      </p>
    </div>
  );
}
