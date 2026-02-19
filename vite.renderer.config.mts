import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import path from 'path';
import { codeInspectorPlugin } from 'code-inspector-plugin';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDev = mode === 'development';

  return {
    plugins: [
      sentryVitePlugin({
        org: process.env.SENTRY_ORG || env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT || env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN || env.SENTRY_AUTH_TOKEN,
        release: {
          name: `${process.env.npm_package_name}@${process.env.npm_package_version}`,
        },
        // Electron loads files from app://, so we need to normalize paths for Source Map matching
        sourcemaps: {
          // Rewrite the source paths to strip the Electron app:// protocol
          rewriteSources: (source) => {
            // Transform: app:///.vite/renderer/main_window/assets/index.js
            // Into:      ~/.vite/renderer/main_window/assets/index.js
            return source.replace(/^app:\/\/\//, '~/');
          },
        },
        disable: isDev, // Disable in development to save memory
      }),
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
      }),
      tailwindcss(),
      react({
        babel: {
          plugins: ['babel-plugin-react-compiler'],
        },
      }),
      codeInspectorPlugin({ bundler: 'vite' }),
    ],
    define: {
      'process.env.SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN || env.SENTRY_DSN),
    },
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@': path.resolve(process.cwd(), './src'),
      },
    },
    build: {
      // Reduce memory usage during build
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Split large dependencies into separate chunks
            if (id.includes('node_modules')) {
              if (id.includes('@radix-ui')) {
                return 'radix-ui';
              }
              if (id.includes('@tanstack')) {
                return 'tanstack';
              }
              if (id.includes('react') || id.includes('react-dom')) {
                return 'react-vendor';
              }
              return 'vendor';
            }
          },
        },
      },
    },
    server: {
      // Optimize dev server for memory
      hmr: {
        overlay: true,
      },
    },
  };
});
