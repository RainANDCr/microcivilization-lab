import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';
export default ts.config({ ignores: ['dist/**','dist-offline/**','node_modules/**','playwright-report/**','test-results/**','artifacts/**','.browser-cache/**','.browser-temp/**'] }, js.configs.recommended, ...ts.configs.recommended, { languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.worker } }, rules: { '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern:'^_'}] } });
