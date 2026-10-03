/** Read the last effective EULA property, ignoring comments and blank lines. */
export function isMinecraftEulaAccepted(content: string): boolean {
  let accepted = false;
  for (const line of content.split(/\r?\n/)) {
    const setting = line.match(/^\s*eula\s*=\s*(.*?)\s*$/);
    if (setting) accepted = setting[1].toLowerCase() === 'true';
  }
  return accepted;
}
