import type { Express } from 'express';
import { createApp } from './createApp.mjs';

// Entrypoint for Vercel's Express runtime, which does not take a configurable
// entrypoint: it looks for `app`/`index`/`server` at the service root and then
// under `src/`, and only accepts a candidate whose source mentions `express` —
// which the type import above satisfies. The default export is what gets served,
// so the app is built once here, at import time, and never listens on a port.
const app: Express = createApp();

export default app;
