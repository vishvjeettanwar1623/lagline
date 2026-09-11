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
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans p-6 select-none">
      <div className="w-full max-w-md bg-[#0f0f12] p-8 rounded-xl border border-[#27272a] shadow-2xl space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center font-bold text-xs font-mono shadow-xs">
              L
            </div>
            <h1 className="text-xl font-mono text-white tracking-tight font-bold">LagLine</h1>
          </div>
          <p className="text-[#71717a] text-xs font-sans">
            High-density desktop Git status and workspace sync matrix
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleStartScanning} className="space-y-5">
          <div className="space-y-2">
            <label className="block text-[#71717a] text-[10px] uppercase tracking-wider font-mono font-bold">
              Where do you keep your projects?
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={rootPath}
                onChange={(e) => setRootPath(e.target.value)}
                placeholder="C:/Users/name/Documents/Dev"
                className="flex-1 bg-[#141418] text-white text-xs font-mono px-3 py-2 rounded-md border border-[#27272a] focus:outline-none focus:border-[#52525b]"
              />
              <button
                type="button"
                onClick={handlePickFolder}
                className="bg-[#141418] hover:bg-[#1c1c21] text-white p-2 rounded-md border border-[#27272a] transition-colors"
                title="Browse folder"
              >
                <Folder className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[#71717a] text-[10px] uppercase tracking-wider font-mono font-bold">
              GitHub Token (optional)
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-[#141418] text-white text-xs font-mono pl-3 pr-10 py-2 rounded-md border border-[#27272a] focus:outline-none focus:border-[#52525b]"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-[#71717a] leading-relaxed">
              Used to check remote state. Read-only repo scope is enough.
            </p>
          </div>

          <button
            type="submit"
            disabled={isScanning}
            className="w-full mt-6 bg-white hover:bg-[#e4e4e7] text-black font-mono text-xs font-bold py-2.5 rounded-md transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs"
          >
            {isScanning ? 'Scanning workspace...' : 'Start scanning workspace'}
            {!isScanning && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupScreen;
