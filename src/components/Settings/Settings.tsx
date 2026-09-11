import React, { useState, useEffect } from 'react';
import { useRepoStore } from '../../store/useRepoStore';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { X, Folder, Eye, EyeOff, Trash2, Sliders } from 'lucide-react';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const { config, setConfig, setRepos, setIsScanning, setTotalFolders } = useRepoStore();
  const [rootPath, setRootPath] = useState<string>('');
  const [githubToken, setGithubToken] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [autoRescanInterval, setAutoRescanInterval] = useState<string>('off');
  const [ignoredPaths, setIgnoredPaths] = useState<string[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setRootPath(config.rootPath || '');
      setGithubToken(config.githubToken || '');
      setAutoRescanInterval(config.autoRescanInterval || 'off');
      setIgnoredPaths(config.ignoredPaths || []);
    }
  }, [config, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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

  const handleClearToken = () => {
    setGithubToken('');
  };

  const handleSave = async () => {
    if (!rootPath) {
      setError('Root directory is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const isRootPathChanged = config?.rootPath !== rootPath;

      const newConfig = {
        rootPath,
        githubToken: githubToken || null,
        lastFullScan: config?.lastFullScan || null,
        autoRescanInterval,
        ignoredPaths,
      };

      await invoke('save_config', { config: newConfig });
      setConfig(newConfig);

      if (isRootPathChanged) {
        setIsScanning(true);
        const [scannedRepos, total]: any = await Promise.all([
          invoke('scan_repos', { rootPath }),
          invoke('get_total_folders', { rootPath }),
        ]);
        setRepos(scannedRepos);
        setTotalFolders(total);
        setIsScanning(false);
      }

      onClose();
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans select-none animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Docked Settings Drawer Panel */}
      <div className="relative w-[340px] h-full bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] flex flex-col shadow-2xl z-10 text-[var(--text-primary)] transition-colors">
        {/* Header */}
        <div className="p-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-raised)]">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider">
            <Sliders className="w-4 h-4 text-[var(--text-primary)]" />
            <span>Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs font-sans">
          {error && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded font-mono">
              {error}
            </div>
          )}

          {/* Root Directory */}
          <div className="space-y-1.5">
            <label className="block text-[var(--text-muted)] text-[10px] uppercase tracking-wider font-mono font-bold">
              Root Directory
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={rootPath}
                onChange={(e) => setRootPath(e.target.value)}
                placeholder="C:/Users/name/Dev"
                className="flex-1 bg-[var(--bg-input)] text-[var(--text-primary)] text-xs font-mono px-2.5 py-1.5 rounded-md border border-[var(--border-subtle)] focus:outline-none focus:border-[var(--border-strong)]"
              />
              <button
                type="button"
                onClick={handlePickFolder}
                className="bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] p-1.5 rounded-md border border-[var(--border-subtle)] transition-colors"
              >
                <Folder className="w-4 h-4 text-[var(--text-primary)]" />
              </button>
            </div>
          </div>

          {/* GitHub Token */}
          <div className="space-y-1.5">
            <label className="block text-[var(--text-muted)] text-[10px] uppercase tracking-wider font-mono font-bold">
              GitHub Personal Access Token
            </label>
            <div className="relative flex gap-1.5">
              <div className="relative flex-1">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-[var(--bg-input)] text-[var(--text-primary)] text-xs font-mono pl-2.5 pr-7 py-1.5 rounded-md border border-[var(--border-subtle)] focus:outline-none focus:border-[var(--border-strong)]"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {githubToken && (
                <button
                  type="button"
                  onClick={handleClearToken}
                  className="bg-[var(--bg-raised)] hover:bg-rose-500/20 text-rose-500 p-1.5 rounded-md border border-[var(--border-subtle)] transition-colors"
                  title="Clear token"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Auto Rescan */}
          <div className="space-y-1.5">
            <label className="block text-[var(--text-muted)] text-[10px] uppercase tracking-wider font-mono font-bold">
              Auto-Rescan Interval
            </label>
            <div className="grid grid-cols-4 gap-1 bg-[var(--bg-raised)] p-1 rounded-md border border-[var(--border-subtle)]">
              {['off', '5m', '15m', '30m'].map((interval) => (
                <button
                  key={interval}
                  type="button"
                  onClick={() => setAutoRescanInterval(interval)}
                  className={`text-[11px] py-1 font-mono capitalize rounded transition-colors ${
                    autoRescanInterval === interval
                      ? 'bg-[var(--bg-active)] text-[var(--text-primary)] font-bold border border-[var(--border-strong)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {interval}
                </button>
              ))}
            </div>
          </div>

          {/* Hidden Repositories */}
          <div className="space-y-1.5 select-none">
            <label className="block text-[var(--text-muted)] text-[10px] uppercase tracking-wider font-mono font-bold">
              Hidden Repositories
            </label>
            {ignoredPaths.length === 0 ? (
              <div className="text-xs text-[var(--text-muted)] font-mono bg-[var(--bg-raised)] p-2.5 rounded-md border border-[var(--border-subtle)]">
                No hidden repositories.
              </div>
            ) : (
              <div className="max-h-[140px] overflow-y-auto border border-[var(--border-subtle)] rounded-md divide-y divide-[var(--border-subtle)] bg-[var(--bg-raised)] font-mono text-xs text-[var(--text-primary)]">
                {ignoredPaths.map((path) => {
                  const folderName = path.split(/[/\\]/).pop() || path;
                  return (
                    <div key={path} className="flex items-center justify-between p-2 gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[var(--text-primary)] truncate">{folderName}</div>
                        <div className="text-[10px] text-[var(--text-muted)] truncate">{path}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIgnoredPaths(ignoredPaths.filter((p) => p !== path));
                        }}
                        className="text-[var(--text-primary)] hover:underline font-mono text-[10px]"
                      >
                        Restore
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-raised)]">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[var(--btn-primary-bg)] hover:opacity-90 text-[var(--btn-primary-fg)] font-mono text-xs font-bold py-2 rounded-md transition-colors disabled:opacity-50 shadow-xs"
          >
            {saving ? 'Saving Settings...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
