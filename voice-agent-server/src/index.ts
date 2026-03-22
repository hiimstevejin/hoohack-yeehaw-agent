const port = Number(process.env.PORT ?? 8787);

function main() {
  const startedAt = new Date().toISOString();
  console.log(`[voice-agent-server] listening stub on port ${port} at ${startedAt}`);
}

main();
