import { getOptionalEnv } from './config.js';

export async function sendDiscordNotification(message: string): Promise<void> {
  const webhookUrl = getOptionalEnv('DISCORD_WEBHOOK_URL');
  if (!webhookUrl) {
    console.log('[discord] webhook not configured, skipping message:', message);
    return;
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message }),
  });

  if (!res.ok) {
    console.error(`[discord] failed to send notification (${res.status})`, await res.text());
  }
}
