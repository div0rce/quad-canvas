// apps/web — ambient CSS-import declaration so `import './globals.css'` typechecks WITHOUT
// depending on Next-generated next-env.d.ts (keeps `tsc --noEmit` self-sufficient; see T8 notes).
declare module '*.css';
