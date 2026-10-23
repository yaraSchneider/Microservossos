// ---------------------------------------------------------------------------
// Setup global dos testes de componente.
//
// Importa os matchers do jest-dom (ex.: toBeInTheDocument, toBeDisabled) e
// limpa o DOM entre os testes para evitar vazamento de estado.
// ---------------------------------------------------------------------------

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
    cleanup();
});
