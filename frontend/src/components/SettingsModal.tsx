import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import './SettingsModal.css';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: any;
    onSave: (newConfig: any) => Promise<void>;
}

const DEFAULT_CONFIG = {
    "github": {
        "transport": "streamable_http",
        "url": "https://api.githubcopilot.com/mcp/",
        "headers": {
            "Authorization": "Bearer <YOUR_GITHUB_TOKEN_HERE>"
        }
    }
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onSave }) => {
    const [jsonString, setJsonString] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (config && Object.keys(config).length > 0) {
            setJsonString(JSON.stringify(config, null, 2));
        } else {
            setJsonString(JSON.stringify(DEFAULT_CONFIG, null, 2));
        }
    }, [config, isOpen]);

    if (!isOpen) return null;

    const handleSave = async () => {
        try {
            setError(null);
            const parsedConfig = JSON.parse(jsonString);
            setIsSaving(true);
            await onSave(parsedConfig);
            onClose();
        } catch (e) {
            if (e instanceof SyntaxError) {
                setError("Invalid JSON format: " + e.message);
            } else {
                setError("Failed to save configuration.");
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="settings-modal-overlay" onClick={onClose}>
            <div className="settings-modal-content" onClick={e => e.stopPropagation()}>
                <div className="settings-modal-header">
                    <h2>MCP Configuration</h2>
                    <button className="close-button" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="settings-modal-body">
                    <p className="settings-description">
                        Configure your MCP servers below. You can add GitHub, Postgres, or other MCP-compatible servers.
                    </p>

                    {error && (
                        <div className="settings-error">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <textarea
                        className="settings-editor"
                        value={jsonString}
                        onChange={(e) => setJsonString(e.target.value)}
                        spellCheck={false}
                        placeholder='{ "github": { ... } }'
                    />
                </div>

                <div className="settings-modal-footer">
                    <button className="cancel-button" onClick={onClose}>Cancel</button>
                    <button className="save-button" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <span className="loader-sm"></span> : <><Save size={16} /> Save Changes</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
