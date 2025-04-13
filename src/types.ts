export interface FileNameStylerProfileSettings {
    idFormat: string;
    customIdRegex?: string;
    moveIdToEnd: boolean;
    showCustomSuffix: boolean;
    customSuffix: string;
    customColor: string;
    enableCustomColor: boolean;
    onlyEnabledFolders: boolean;
    enabledFolders: string[];
    showCustomPrefix: boolean;
    customPrefix: string;
    showCustomFileIcon: boolean;
    customFileIcon: string;
}

export interface FileNameStylerGlobalSettings {
    profiles: Record<string, Partial<FileNameStylerProfileSettings>>;
    activeProfiles: string[];
}

export const DEFAULT_PROFILE_SETTINGS: FileNameStylerProfileSettings = {
    idFormat: "12",
    moveIdToEnd: false,
    showCustomSuffix: false,
    customSuffix: " (z)",
    customColor: "#4b0082",
    enableCustomColor: false,
    onlyEnabledFolders: false,
    enabledFolders: [],
    showCustomPrefix: false,
    customPrefix: "[Z] ",
    showCustomFileIcon: false,
    customFileIcon: "🧠",
};
