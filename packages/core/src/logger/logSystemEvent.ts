export function logSystemEvent(event: string, details: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  // Simple structured log format for log parsers
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ timestamp, event, details }));
}
