import { Plugin } from "obsidian";
import {
    FileNameStylerGlobalSettings,
    FileNameStylerProfileSettings,
} from "./types";
import { FileNameStylerSettingTab } from "./FileNameStylerSettingTab";
import { SettingsMigrator } from "./SettingsMigrator";

export class FileNameStylerPlugin extends Plugin {
    settings!: FileNameStylerGlobalSettings;
    observer!: MutationObserver;

    async onload() {
        console.log("FileName Styler Plugin loaded");

        await this.loadSettings();
        this.addSettingTab(new FileNameStylerSettingTab(this.app, this));

        this.observer = new MutationObserver((mutations) => {
            if (
                mutations.some(
                    (m) =>
                        m.target instanceof HTMLElement &&
                        m.target.closest(".nav-file-title")
                )
            ) {
                setTimeout(() => this.refreshAll(), 50);
            }
        });

        this.refreshAll();

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    refreshAll() {
        if (this.observer) this.observer.disconnect();

        this.restoreOriginalFileTitles();
        this.applyStylingToFileNames();

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    onunload() {
        console.log("FileName Styler Plugin unloaded");
        this.observer.disconnect();
        this.restoreOriginalFileTitles();
    }

    async loadSettings() {
        const data = await this.loadData();
        const migrator = new SettingsMigrator();

        const { migrated, changed } = migrator.migrate({
            profiles: {},
            activeProfiles: [],
            ...data,
        });

        this.settings = migrated;

        if (changed) {
            await this.saveSettings();
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    applyStylingToFileNames() {
        const fileTitles = document.querySelectorAll(".nav-file-title-content");

        fileTitles.forEach((el: Element) => {
            const htmlEl = el as HTMLElement;
            const parent = el.closest(".tree-item-self");
            const path = parent?.getAttribute("data-path") || "";
            const originalText =
                htmlEl.dataset.originalTitle || htmlEl.textContent || "";

            for (const profileName of this.settings.activeProfiles) {
                const profile = this.settings.profiles[profileName];
                if (!profile) continue;

                if (
                    profile.onlyEnabledFolders &&
                    !profile.enabledFolders?.some((folder) =>
                        path.startsWith(folder)
                    )
                ) {
                    continue;
                }

                let regex: RegExp | null = null;
                if (profile.idFormat === "custom" && profile.customIdRegex) {
                    try {
                        regex = new RegExp(profile.customIdRegex);
                    } catch (e) {
                        console.warn(
                            `Invalid custom regex in profile '${profileName}':`,
                            e
                        );
                        continue;
                    }
                } else if (profile.idFormat) {
                    regex = new RegExp(
                        `^(\\d{${profile.idFormat}})([-_ ]?)(.+)`
                    );
                }

                if (!regex) continue;

                const match = originalText.match(regex);
                if (!match) continue;

                this.applyIdHiding(htmlEl, match, originalText, profile);
                this.applyProfileStyling(htmlEl, profile);
                break;
            }
        });
    }

    applyIdHiding(
        el: HTMLElement,
        match: RegExpMatchArray,
        originalText: string,
        profile: Partial<FileNameStylerProfileSettings>
    ) {
        if (el.dataset.originalTitle) return;

        el.dataset.originalTitle = originalText;

        const mode = profile.idDisplayMode ?? "hide";

        if (mode === "hide") {
            el.textContent = match[3];
        } else if (mode === "show") {
            el.textContent = `${match[1]}${match[2]}${match[3]}`;
        } else if (mode === "end") {
            el.textContent = `${match[3]} ${match[1]}`;
        }
    }

    applyProfileStyling(
        el: HTMLElement,
        profile: Partial<FileNameStylerProfileSettings>
    ) {
        if (
            profile.showCustomPrefix &&
            profile.customPrefix &&
            !el.textContent?.startsWith(profile.customPrefix)
        ) {
            el.textContent = `${profile.customPrefix}${el.textContent}`;
        }

        if (
            profile.showCustomSuffix &&
            profile.customSuffix &&
            !el.textContent?.endsWith(profile.customSuffix)
        ) {
            el.textContent = `${el.textContent}${profile.customSuffix}`;
        }

        if (profile.enableCustomColor && profile.customColor) {
            el.style.color = profile.customColor;
        }

        if (profile.showCustomFileIcon && profile.customFileIcon) {
            el.style.setProperty("--file-icon", `"${profile.customFileIcon}"`);
        }
    }

    restoreOriginalFileTitles() {
        const fileTitles = document.querySelectorAll(".nav-file-title-content");

        fileTitles.forEach((el: Element) => {
            const htmlEl = el as HTMLElement;

            if (htmlEl.dataset.originalTitle) {
                htmlEl.textContent = htmlEl.dataset.originalTitle;
                delete htmlEl.dataset.originalTitle;
            }

            htmlEl.style.color = "";
            htmlEl.style.removeProperty("--file-icon");
        });
    }
}
