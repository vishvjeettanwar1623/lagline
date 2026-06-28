import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useRepoStore } from '../../store/useRepoStore';
import { Folder, ArrowRight, Eye, EyeOff } from 'lucide-react';

export const SetupScreen: React.FC = () => {
  const [rootPath, setRootPath] = useState<string>('');
  const [githubToken, setGithubToken] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const { setRepos, setConfig, setIsScanning, isScanning, setTotalFolders } = useRepoStore();

  const handlePickFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Projects Root Directory',
      });
      if (typeof selected === 'string') {
        setRootPath(selected);
      }
    } catch (err: any) {
      setError(err.toString());
    }
  };

  const handleStartScanning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootPath) {
      setError('Please select a root directory.');
      return;
    }
    
    setIsScanning(true);
    setError(null);
    try {
      const configObj = {
        rootPath,
        githubToken: githubToken || null,
        lastFullScan: new Date().toISOString(),
        autoRescanInterval: 'off',
      };
      await invoke('save_config', { config: configObj });
      setConfig(configObj);

      const [scannedRepos, total]: any = await Promise.all([
        invoke('scan_repos', { rootPath }),
        invoke('get_total_folders', { rootPath }),
      ]);
      setRepos(scannedRepos);
      setTotalFolders(total);
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-base text-text-primary font-sans p-6">
      <div className="w-full max-w-md bg-bg-surface p-8 rounded-lg border border-border-subtle shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <img src="/logo.svg" alt="LagLine Logo" className="w-8 h-8 object-contain" />
          <h1 className="text-2xl font-mono text-text-primary tracking-tight font-bold">LagLine</h1>
        </div>
        <p className="text-text-secondary text-sm mb-6 border-b border-border-subtle pb-4">
          A local Git repository sync dashboard.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-950/30 border border-status-ahead/30 text-status-ahead text-xs rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleStartScanning} className="space-y-5">
          <div>
            <label className="block text-text-secondary text-xs uppercase tracking-wider mb-2 font-mono">
              Where do you keep your projects?
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={rootPath}
                onChange={(e) => setRootPath(e.target.value)}
                placeholder="C:/Users/name/Documents/Dev"
                className="flex-1 bg-bg-wash text-text-primary text-sm px-3 py-2 rounded border border-border-subtle focus:outline-none focus:border-accent-ink"
              />
              <button
                type="button"
                onClick={handlePickFolder}
                className="bg-bg-wash hover:bg-bg-raised text-text-primary p-2 rounded border border-border-subtle transition-colors duration-150"
                title="Browse folder"
              >
                <Folder className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-text-secondary text-xs uppercase tracking-wider mb-2 font-mono">
              GitHub Token (optional)
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-bg-wash text-text-primary text-sm pl-3 pr-10 py-2 rounded border border-border-subtle focus:outline-none focus:border-accent-ink"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-ghost hover:text-text-secondary"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-text-ghost mt-1.5 leading-relaxed">
              Used to check remote state. Read-only repo scope is enough.
            </p>
          </div>

          <button
            type="submit"
            disabled={isScanning}
            className="w-full mt-6 bg-accent-ink hover:bg-accent-ink/80 text-text-primary font-mono text-sm py-2.5 rounded transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isScanning ? 'Scanning...' : 'Start scanning'}
            {!isScanning && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupScreen;
