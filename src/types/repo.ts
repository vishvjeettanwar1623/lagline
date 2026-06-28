export type RepoStatus = 'clean' | 'ahead' | 'behind' | 'dirty' | 'diverged' | 'unlinked' | 'non-git';

export interface ChangedFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
}

export interface AheadCommit {
  hash: string;         // short 7-char hash
  message: string;
  timestamp: string;    // ISO string
}

export interface RepoInfo {
  id: string;           // absolute local path used as unique ID
  name: string;         // folder name
  localPath: string;
  branch: string;
  remoteUrl: string | null;
  status: RepoStatus;
  lastCommitTime: string | null;   // ISO string
  aheadCount: number;              // commits not pushed
  behindCount: number;             // commits not pulled
  changedFiles: ChangedFile[];     // uncommitted local changes
  aheadCommits: AheadCommit[];     // unpushed commits
  behindCommits?: AheadCommit[];   // remote commits not present locally
  lastScanned: string;             // ISO string
  remoteType: 'github' | 'other' | null;
  projectType?: string | null;
}

export interface AppConfig {
  rootPath: string | null;
  githubToken: string | null;
  lastFullScan: string | null;
  autoRescanInterval?: string | null;
  ignoredPaths?: string[];
  pinnedPaths?: string[];
}
