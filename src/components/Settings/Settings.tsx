import React, { useState, useEffect } from 'react';
import { useRepoStore } from '../../store/useRepoStore';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { X, Folder, Eye, EyeOff, Trash2 } from 'lucide-react';

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

  // Initialize fields when drawer opens or config loads
  useEffect(() => {
    if (config) {
      setRootPath(config.rootPath || '');
      setGithubToken(config.githubToken || '');
      setAutoRescanInterval(config.autoRescanInterval || 'off');
      setIgnoredPaths(config.ignoredPaths || []);
    }
  }, [config, isOpen]);

  // Handle escape key
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

      // Trigger fresh scan if root folder changed
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
    <div className="fixed inset-0 z-40 flex justify-end font-sans select-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-[320px] h-full bg-bg-surface border-l border-border-subtle flex flex-col shadow-2xl z-50">
        {/* Header */}
        <div className="p-4 border-b border-border-subtle flex items-center justify-between">
          <span className="text-sm font-mono text-text-primary uppercase tracking-wider font-semibold">Settings</span>
          <button
            onClick={onClose}
            className="text-text-ghost hover:text-text-primary transition-colors duration-150"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {error && (
            <div className="p-3 bg-red-950/30 border border-status-ahead/30 text-status-ahead text-xs rounded">
              {error}
            </div>
          )}

          {/* Root Directory */}
          <div className="space-y-2">
            <label className="block text-text-secondary text-xs uppercase tracking-wider font-mono">
              Root directory
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={rootPath}
                onChange={(e) => setRootPath(e.target.value)}
                placeholder="C:/Users/name/Dev"
                className="flex-1 bg-bg-wash text-text-primary text-xs px-3 py-2 rounded border border-border-subtle focus:outline-none focus:border-accent-ink"
              />
              <button
                type="button"
                onClick={handlePickFolder}
                className="bg-bg-wash hover:bg-bg-raised text-text-primary p-2 rounded border border-border-subtle transition-colors duration-150"
              >
                <Folder className="w-3.5 h-3.5 text-text-secondary" />
              </button>
            </div>
          </div>

          {/* GitHub Token */}
          <div className="space-y-2">
            <label className="block text-text-secondary text-xs uppercase tracking-wider font-mono">
              GitHub token
            </label>
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-bg-wash text-text-primary text-xs pl-3 pr-8 py-2 rounded border border-border-subtle focus:outline-none focus:border-accent-ink"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-ghost hover:text-text-secondary"
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {githubToken && (
                <button
                  type="button"
                  onClick={handleClearToken}
                  className="bg-bg-wash hover:bg-bg-raised text-status-ahead p-2 rounded border border-border-subtle transition-colors duration-150"
                  title="Clear token"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Auto Rescan */}
          <div className="space-y-2">
            <label className="block text-text-secondary text-xs uppercase tracking-wider font-mono">
              Auto-rescan interval
            </label>
            <div className="grid grid-cols-4 gap-1 bg-bg-wash p-0.5 rounded border border-border-subtle">
              {['off', '5m', '15m', '30m'].map((interval) => (
                <button
                  key={interval}
                  type="button"
                  onClick={() => setAutoRescanInterval(interval)}
                  className={`text-[10px] py-1.5 font-mono capitalize rounded transition-all duration-150 ${
                    autoRescanInterval === interval
                      ? 'bg-bg-raised text-text-primary font-bold shadow-xs'
                      : 'text-text-ghost hover:text-text-secondary'
                  }`}
                >
                  {interval}
                </button>
              ))}
            </div>
          </div>

          {/* Hidden Repositories */}
          <div className="space-y-2 select-none">
            <label className="block text-text-secondary text-xs uppercase tracking-wider font-mono">
              Hidden Repositories
            </label>
            {ignoredPaths.length === 0 ? (
              <div className="text-xs text-text-ghost font-mono bg-bg-wash/30 p-3 rounded border border-border-subtle/50">
                No hidden repositories.
              </div>
            ) : (
              <div className="max-h-[140px] overflow-y-auto border border-border-subtle rounded divide-y divide-border-subtle/50 bg-bg-wash/30 font-mono text-[11px] text-text-secondary">
                {ignoredPaths.map((path) => {
                  const folderName = path.split(/[/\\]/).pop() || path;
                  return (
                    <div key={path} className="flex items-center justify-between p-2 gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-text-primary truncate">{folderName}</div>
                        <div className="text-[10px] text-text-ghost truncate">{path}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIgnoredPaths(ignoredPaths.filter((p) => p !== path));
                        }}
                        className="text-accent-warm hover:underline font-mono text-[10px] transition-colors duration-150"
                      >
                        Restore
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* About */}
          <div className="pt-6 border-t border-border-subtle/40 space-y-1.5 font-mono select-none">
            <div className="text-[10px] text-text-ghost uppercase tracking-wider">About</div>
            <div className="text-[11px] text-text-secondary flex justify-between">
              <span>Version</span>
              <span>0.1.0</span>
            </div>
            <div className="text-[11px] text-text-secondary flex justify-between">
              <span>Platform</span>
              <span>Tauri v2 + React</span>
            </div>
          </div>
        </div>

        {/* Footer / Save Button */}
        <div className="p-4 border-t border-border-subtle bg-bg-surface">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-accent-ink hover:bg-accent-ink/80 text-text-primary font-mono text-xs py-2 rounded transition-all duration-150 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
