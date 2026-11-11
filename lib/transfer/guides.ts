// Connection guides for /transfer (TRF-09). Plain data built from the host and
// the account name, so they are testable and the page only lays them out.

export const SFTP_PORT = 2022;

export type ClientGuide = {
  id: "winscp" | "filezilla" | "cyberduck" | "terminal";
  name: string;
  steps: string[];
  /** The command to copy, for the terminal guide. */
  command?: string;
  /** The same with a key file. */
  keyCommand?: string;
};

/** Quotes a value for a POSIX shell only when it needs it. */
function shellQuote(value: string): string {
  return /^[A-Za-z0-9_.@:/~-]+$/.test(value)
    ? value
    : `'${value.replace(/'/g, "'\\''")}'`;
}

export function buildGuides(input: {
  host: string;
  username: string;
}): ClientGuide[] {
  const { host, username } = input;
  const port = String(SFTP_PORT);
  const target = `${username}@${host}`;
  return [
    {
      id: "winscp",
      name: "WinSCP (Windows)",
      steps: [
        `Choose New Session and set File protocol to SFTP.`,
        `Host name ${host}, port number ${port}, user name ${username}.`,
        `Enter your password, or open Advanced, then SSH, then Authentication, and pick your private key file.`,
        `Save and Login. Accept the server key the first time.`,
      ],
    },
    {
      id: "filezilla",
      name: "FileZilla",
      steps: [
        `Open the Site Manager and choose New site.`,
        `Protocol: SFTP - SSH File Transfer Protocol. Host ${host}, port ${port}.`,
        `Logon type Normal with user ${username} and your password, or Key file and pick your private key.`,
        `Connect. Do not pick an FTP protocol; the server offers SFTP only.`,
      ],
    },
    {
      id: "cyberduck",
      name: "Cyberduck (macOS, Windows)",
      steps: [
        `Choose Open Connection and select SFTP (SSH File Transfer Protocol).`,
        `Server ${host}, port ${port}, user name ${username}.`,
        `Enter your password, or tick Use Public Key Authentication and choose your private key.`,
        `Connect and accept the host key the first time.`,
      ],
    },
    {
      id: "terminal",
      name: "Terminal (macOS, Linux, Windows)",
      command: `sftp -P ${port} ${shellQuote(target)}`,
      keyCommand: `sftp -P ${port} -i ~/.ssh/id_ed25519 ${shellQuote(target)}`,
      steps: [
        `Run sftp -P ${port} ${shellQuote(target)} and enter your password.`,
        `With a key, add -i and the path of your private key. Port ${port} is SFTP; port 22 is the server's own SSH and is not for file transfer.`,
        `Use put and get to upload and download, ls to list, and exit to leave.`,
      ],
    },
  ];
}
