import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.studyalready.com',
  output: 'static',
  build: {
    format: 'directory',
  },
});
