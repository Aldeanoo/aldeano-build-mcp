import test from 'ava';
import net from 'node:net';
import { checkPortInUse, waitForServer } from '../../scripts/dev-all.js';

test('checkPortInUse returns true when port is actively listening', async (t) => {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as net.AddressInfo;
  const port = address.port;

  const inUse = await checkPortInUse(port, '127.0.0.1', 500);
  t.true(inUse);

  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('checkPortInUse returns false when port is not listening', async (t) => {
  // Port 65530 is unlikely to be listening
  const inUse = await checkPortInUse(65530, '127.0.0.1', 300);
  t.false(inUse);
});

test('waitForServer resolves true when server opens port during wait', async (t) => {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));

  const delayedServer = net.createServer();
  const timer = setTimeout(() => {
    delayedServer.listen(port, '127.0.0.1');
  }, 100);

  const ready = await waitForServer(port, '127.0.0.1', 2000, 50);
  t.true(ready);

  clearTimeout(timer);
  await new Promise<void>((resolve) => delayedServer.close(() => resolve()));
});

test('waitForServer resolves false when timeout expires', async (t) => {
  const ready = await waitForServer(65531, '127.0.0.1', 300, 50);
  t.false(ready);
});
