import { Hono } from 'hono';

const webhooks = new Hono();

webhooks.post('/stripe', (c) => c.json({ message: 'Stripe webhook handler' }));
webhooks.post('/github', (c) => c.json({ message: 'Github webhook handler' }));

export default webhooks;
