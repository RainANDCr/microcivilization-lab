import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({ base:'./', server:{watch:{ignored:['**/.browser-cache/**','**/.browser-temp/**','**/test-results/**']}}, plugins: [react()], test: { include: ['tests/storage.test.ts'] }, build: { target: 'es2022' } });
