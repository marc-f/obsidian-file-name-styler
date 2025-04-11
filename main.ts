import { App, Plugin, PluginSettingTab, Setting, Modal } from "obsidian";

interface FileNameStylerProfileSettings {
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

interface FileNameStylerGlobalSettings {
    profiles: Record<string, Partial<FileNameStylerProfileSettings>>;
    activeProfiles: string[];
}

const DEFAULT_PROFILE_SETTINGS: FileNameStylerProfileSettings = {
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

export default class FileNameStylerPlugin extends Plugin {
    settings!: FileNameStylerGlobalSettings;
    observer!: MutationObserver;

    async onload() {
        console.log("FileName Styler Plugin loaded");

        await this.loadSettings();
        this.addSettingTab(new FileNameStylerSettingTab(this.app, this));

        this.observer = new MutationObserver((mutations) => {
            if (mutations.some(m => m.target instanceof HTMLElement && m.target.closest(".nav-file-title"))) {
                setTimeout(() => this.refreshAll(), 50);
            }
        });

        this.refreshAll();

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    refreshAll() {
        if (this.observer) this.observer.disconnect();

        this.restoreOriginalFileTitles();
        this.applyStylingToFileNames();

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    onunload() {
        console.log("FileName Styler Plugin unloaded");
        this.observer.disconnect();
        this.restoreOriginalFileTitles();
    }

    async loadSettings() {
        this.settings = Object.assign(
            { profiles: {}, activeProfiles: [] },
            await this.loadData()
        );
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
            const originalText = htmlEl.dataset.originalTitle || htmlEl.textContent || "";

            for (const profileName of this.settings.activeProfiles) {
                const profile = this.settings.profiles[profileName];
                if (!profile) continue;

                if (
                    profile.onlyEnabledFolders &&
                    !(profile.enabledFolders?.some(folder => path.startsWith(folder)))
                ) {
                    continue;
                }

                let regex: RegExp | null = null;
                if (profile.idFormat === "custom" && profile.customIdRegex) {
                    try {
                        regex = new RegExp(profile.customIdRegex);
                    } catch (e) {
                        console.warn(`Invalid custom regex in profile '${profileName}':`, e);
                        continue;
                    }
                } else if (profile.idFormat) {
                    regex = new RegExp(`^(\\d{${profile.idFormat}})([-_ ]?)(.+)`);
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

    applyIdHiding(el: HTMLElement, match: RegExpMatchArray, originalText: string, profile: Partial<FileNameStylerProfileSettings>) {
        if (el.dataset.originalTitle) return;

        el.dataset.originalTitle = originalText;

        const moveToEnd = profile.moveIdToEnd ?? false;

        el.textContent = moveToEnd
            ? `${match[3]} ${match[1]}`
            : match[3];
    }


    applyProfileStyling(el: HTMLElement, profile: Partial<FileNameStylerProfileSettings>) {
        if (profile.showCustomPrefix && profile.customPrefix && !el.textContent?.startsWith(profile.customPrefix)) {
            el.textContent = `${profile.customPrefix}${el.textContent}`;
        }

        if (profile.showCustomSuffix && profile.customSuffix && !el.textContent?.endsWith(profile.customSuffix)) {
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

class FileNameStylerSettingTab extends PluginSettingTab {
    plugin: FileNameStylerPlugin;
    newProfileName: string = "";

    constructor(app: App, plugin: FileNameStylerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        const profileHeading = containerEl.createDiv("setting-item setting-item-heading");
        const profileInfo = profileHeading.createDiv("setting-item-info");
        profileInfo.createDiv({cls: "setting-item-name", text: "Filename styling profiles"});

        new Setting(containerEl)
            .setName("New Profile")
            .setDesc("Enter a profile name and add it")
            .addText(text => {
                text.setPlaceholder("e.g. Focus Mode")
                    .onChange(value => this.newProfileName = value);
            })
            .addExtraButton(button => {
                button.setIcon("circle-plus")
                    .setTooltip("Add profile")
                    .onClick(async () => {
                        if (!this.newProfileName) return;
                        this.plugin.settings.profiles[this.newProfileName] = this.getCleanSettings();
                        await this.plugin.saveSettings();
                        this.newProfileName = "";
                        this.display();
                    });
            });

        Object.keys(this.plugin.settings.profiles).forEach(profileName => {
            const isActive = this.plugin.settings.activeProfiles.includes(profileName);

            new Setting(containerEl)
                .setName(profileName)
                .addToggle(toggle => toggle
                    .setValue(isActive)
                    .onChange(async (value) => {
                        const idx = this.plugin.settings.activeProfiles.indexOf(profileName);
                        if (value && idx === -1) {
                            this.plugin.settings.activeProfiles.push(profileName);
                        } else if (!value && idx > -1) {
                            this.plugin.settings.activeProfiles.splice(idx, 1);
                        }
                        await this.plugin.saveSettings();
                        this.plugin.refreshAll();
                        this.display();
                    }))
                .addExtraButton(btn => {
                    btn.setIcon("settings")
                        .setTooltip("Show profile details")
                        .onClick(() => {
                            new ProfileModal(this.app, profileName, this.plugin.settings.profiles[profileName], this.plugin).open();
                        });
                })
                .addExtraButton(btn => {
                    btn.setIcon("x")
                        .setTooltip("Remove profile")
                        .onClick(async () => {
                            delete this.plugin.settings.profiles[profileName];
                            this.plugin.settings.activeProfiles = this.plugin.settings.activeProfiles.filter(p => p !== profileName);
                            await this.plugin.saveSettings();
                            this.display();
                        });
                });
        });
    }

    private getCleanSettings(): Partial<FileNameStylerProfileSettings> {
        return { ...DEFAULT_PROFILE_SETTINGS };
    }
}

class ProfileModal extends Modal {
    constructor(
        app: App,
        private profileName: string,
        private profileData: Partial<FileNameStylerProfileSettings>,
        private plugin: FileNameStylerPlugin
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        this.modalEl.style.maxWidth = "70vw";
        this.modalEl.style.width = "700px";

        contentEl.createEl("h2", { text: `Profile: ${this.profileName}` });

        const isActive = this.plugin.settings.activeProfiles.includes(this.profileName);

        if (!isActive) {
            contentEl.createEl("p", {
                text: "This profile is currently inactive. Changes will take effect when it's active.",
                cls: "mod-warning"
            });
        }

        this.createSectionHeading(contentEl, "Filename ID format");
        new Setting(contentEl)
            .setName("ID Format")
            .setDesc("Select the ID format used at the beginning of filenames.")
            .addDropdown(drop => {
                drop.addOption("14", "14-digit (yyyyMMddHHmmss)");
                drop.addOption("12", "12-digit (yyMMddHHmmss)");
                drop.addOption("8", "8-digit (yyyyMMdd)");
                drop.addOption("custom", "Custom regex");

                drop.setValue(this.profileData.idFormat ?? "12");

                drop.onChange(async (value) => {
                    this.profileData.idFormat = value;
                    this.plugin.settings.profiles[this.profileName] = this.profileData;
                    await this.plugin.saveSettings();
                    this.plugin.refreshAll();
                    this.onOpen();
                });
            });

        if (this.profileData.idFormat === "custom") {
            new Setting(contentEl)
                .setName("Custom ID Regex")
                .setDesc(
                    "Enter a custom regular expression to extract the ID and filename\n" +
                    "The custom regex must contain exactly three capturing groups:\n" +
                    "  (1) the ID\n" +
                    "  (2) an optional separator (e.g. -, _, space)\n" +
                    "  (3) the remaining file name\n" +
                    "Example: ^(\\d{6})([-_ ]?)(.+)$"
                )
                .addText(text => {
                    text.setPlaceholder("e.g. ^(\\d{6})([-_ ]?)(.+)$")
                        .setValue(this.profileData.customIdRegex ?? "")
                        .onChange(async (value) => {
                            this.profileData.customIdRegex = value;
                            this.plugin.settings.profiles[this.profileName] = this.profileData;
                            await this.plugin.saveSettings();
                            this.plugin.refreshAll();
                        });
                });
        }

        this.createSectionHeading(contentEl, "ID position in filename");
        this.addProfileToggleSetting(
            contentEl,
            "Move ID to end",
            "Moves the ID to the end of the filename",
            "moveIdToEnd"
        );

        this.createSectionHeading(contentEl, "Folder filter");
        this.addProfileToggleSetting(
            contentEl,
            "Restrict to folders",
            "Only apply formatting in specified folders",
            "onlyEnabledFolders"
        );
        const folderList = contentEl.createDiv();
        const renderFolderList = () => {
            folderList.empty();
            const folders = this.profileData.enabledFolders ?? [];

            folders.forEach((folder, index) => {
                new Setting(folderList)
                    .setName(folder)
                    .addExtraButton(button => {
                        button.setIcon("x")
                            .setTooltip("Remove folder")
                            .onClick(async () => {
                                folders.splice(index, 1);
                                this.profileData.enabledFolders = folders;
                                this.plugin.settings.profiles[this.profileName] = this.profileData;
                                await this.plugin.saveSettings();
                                this.plugin.refreshAll();
                                renderFolderList();
                            });
                    });
            });
        };
        renderFolderList();
        let newFolderPath = "";

        new Setting(contentEl)
            .setName("Add folder")
            .setDesc("Add a folder prefix (e.g. 'projects/', 'notes/', or 'inbox'). Files in these folders will be styled.")
            .addText(text => {
                text.setPlaceholder("folder or prefix")
                    .onChange(value => {
                        newFolderPath = value;
                    });
            })
            .addButton(btn => {
                btn.setButtonText("Add")
                    .setCta()
                    .onClick(async () => {
                        if (!newFolderPath) return;

                        const folders = this.profileData.enabledFolders ?? [];
                        if (!folders.includes(newFolderPath)) {
                            folders.push(newFolderPath);
                            this.profileData.enabledFolders = folders;
                            this.plugin.settings.profiles[this.profileName] = this.profileData;
                            await this.plugin.saveSettings();
                            this.plugin.refreshAll();
                            renderFolderList();
                        }
                        newFolderPath = "";
                    });
            });

        this.createSectionHeading(contentEl, "Text color styling");
        this.addProfileToggleSetting(
            contentEl,
            "Enable custom text color",
            "Turn on/off custom color for this profile",
            "enableCustomColor"
        );
        new Setting(contentEl)
            .setName("Custom text color")
            .setDesc("Color used when color is enabled")
            .addColorPicker(picker => {
                picker.setValue(this.profileData.customColor || "#4b0082");
                picker.onChange(async (value) => {
                    this.profileData.customColor = value;
                    this.plugin.settings.profiles[this.profileName] = this.profileData;
                    await this.plugin.saveSettings();
                    this.plugin.refreshAll();
                });
            });

        this.createSectionHeading(contentEl, "Custom file icon options");
        this.addProfileToggleSetting(
            contentEl,
            "Show custom file icon",
            "Apply a custom file icon such as 🧠.",
            "showCustomFileIcon"
        );
        this.addProfileTextSetting(
            contentEl,
            "Custom file icon",
            "Enter an emoji (e.g. 🧠) or Unicode like \\1F4D6 for 📖.",
            "customFileIcon",
        );

        this.createSectionHeading(contentEl, "Prefix styling");
        this.addProfileToggleSetting(
            contentEl,
            "Show prefix styling",
            "Add a prefix like '[Z]' at the start of file names.",
            "showCustomPrefix"
        );
        this.addProfileTextSetting(
            contentEl,
            "Prefix",
            "Text to prepend to file names, e.g. [Z]",
            "customPrefix",
        );

        this.createSectionHeading(contentEl, "Suffix styling");
        this.addProfileToggleSetting(
            contentEl,
            "Show suffix styling",
            "Display a suffix like '(z)' at the end of file names.",
            "showCustomSuffix"
        );
        this.addProfileTextSetting(
            contentEl,
            "Suffix",
            "Text to append to file names, e.g. [Z]",
            "customSuffix",
        );

        const closeBtn = contentEl.createEl("button", { text: "Close" });
        closeBtn.addEventListener("click", () => this.close());
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private createSectionHeading(container: HTMLElement, title: string, description?: string): void {
        const heading = container.createDiv("setting-item setting-item-heading");
        const info = heading.createDiv("setting-item-info");
        info.createDiv({ cls: "setting-item-name", text: title });
        if (description) {
            info.createDiv({ cls: "setting-item-description", text: description });
        }
    }

    private addProfileToggleSetting(
        container: HTMLElement,
        label: string,
        description: string,
        key: keyof FileNameStylerProfileSettings
    ): void {
        new Setting(container)
            .setName(label)
            .setDesc(description)
            .addToggle(toggle => {
                toggle.setValue(this.profileData[key] as boolean ?? false);
                toggle.onChange(async (value) => {
                    this.profileData[key] = value as any;
                    Object.assign(this.plugin.settings.profiles[this.profileName], this.profileData);
                    await this.plugin.saveSettings();
                    this.plugin.refreshAll();
                });
            });
    }

    private addProfileTextSetting(
        container: HTMLElement,
        label: string,
        description: string,
        key: keyof FileNameStylerProfileSettings
    ): void {
        new Setting(container)
            .setName(label)
            .setDesc(description)
            .addText(text => {
                text.setPlaceholder("")
                    .setValue((this.profileData[key] as string) ?? DEFAULT_PROFILE_SETTINGS[key] as string)
                    .onChange(async (value) => {
                        this.profileData[key] = value as any;
                        Object.assign(this.plugin.settings.profiles[this.profileName], this.profileData);
                        await this.plugin.saveSettings();
                        this.plugin.refreshAll();
                    });
            })
            .addExtraButton(button => {
                button.setIcon("reset")
                    .setTooltip("Reset to default")
                    .onClick(async () => {
                        this.profileData[key] = DEFAULT_PROFILE_SETTINGS[key] as any;
                        Object.assign(this.plugin.settings.profiles[this.profileName], this.profileData);
                        await this.plugin.saveSettings();
                        this.plugin.refreshAll();
                        this.onOpen();
                    });
            });
    }
}

