import mineflayer from 'mineflayer';

const b = mineflayer.createBot({ host: '127.0.0.1', port: 9999, username: 'SlotAudit', auth: 'offline' });
b.once('error', (e: Error) => { console.log('ERR:', e.message); process.exit(1); });
b.once('spawn', async () => {
  await b.waitForTicks(20);
  const names = Object.keys(b.players);
  console.log('PLAYERS(' + names.length + '): ' + names.join(', '));
  for (const n of names) b.chat(`/kick ${n} slot-audit`);
  await b.waitForTicks(20);
  b.chat('/say [audit] ran kick for all');
  await b.waitForTicks(10);
  b.quit();
  setTimeout(() => process.exit(0), 300);
});
setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 60000);
