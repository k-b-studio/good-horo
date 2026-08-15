import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
			},
			// Node runtime, not Edge: the ThaiLLM upstream cold-starts at 30-60s and Edge has a
			// hard, non-configurable 25s ceiling. maxDuration 60 bounds a hung upstream call
			// (Hobby allows up to 300s under Fluid Compute).
			adapter: adapter({ runtime: 'nodejs22.x', maxDuration: 60 }),
			// Served under kbstudio.space/good-horoscope via a Vercel rewrite from the
			// kbstudio-pages project. Mirrors the creditgpax arrangement.
			paths: { base: '/good-horoscope' },
			// Content-Security-Policy — hash mode emits per-build SHA-256 hashes for the inline
			// hydration script into a <meta> CSP, so script-src stays 'self'. connect-src 'self'
			// covers the /api/oracle call; the upstream LLM is only ever reached server-side.
			csp: {
				mode: 'hash',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:'],
					'font-src': ['self'],
					'connect-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['self']
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
