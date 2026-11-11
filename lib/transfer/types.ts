// Shapes shared by the server and the pages for Nexus Transfer. Plain data, no
// secrets: nothing here holds a password, a hash, a home directory or the
// SFTPGo API key.

export type TransferKey = {
  /** OpenSSH style, `SHA256:` followed by the base64 digest. */
  fingerprint: string;
  /** For example `ssh-ed25519`. */
  type: string;
  comment: string;
};

export type TransferAccount = {
  /** The SFTP login name. */
  username: string;
  enabled: boolean;
  /** The Nexus user this account belongs to, or null for an account made outside Nexus. */
  nexusUserId: string | null;
  /** 0 means unlimited. */
  quotaBytes: number;
  usedBytes: number;
  usedFiles: number;
  keys: TransferKey[];
  lastLoginAt: string | null;
  createdAt: string | null;
};
