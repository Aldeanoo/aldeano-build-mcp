import test from 'ava';
import { isMinecraftEulaAccepted } from '../../src/config/minecraft-eula.js';

const cases: Array<[string, string, boolean]> = [
  ['missing', '', false],
  ['comment only', '# eula=true\n', false],
  ['comment with refused consent', '# eula=true\neula=false\n', false],
  ['accepted', 'eula=true\n', true],
  ['property names are case-sensitive', 'EULA=true\n', false],
  ['whitespace and CRLF', '# My consent\r\n eula = true \r\n', true],
  ['revoked', 'eula=true\neula=false\n', false],
  ['last acceptance', 'eula=false\neula=true\n', true],
  ['inline text is not consent', 'eula=true but not really\n', false]
];

for (const [name, content, expected] of cases) {
  test(`Minecraft EULA: ${name}`, t => {
    t.is(isMinecraftEulaAccepted(content), expected);
  });
}
