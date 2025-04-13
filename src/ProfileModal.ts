import { App, Modal, Setting } from "obsidian";
import {
    DEFAULT_PROFILE_SETTINGS,
    FileNameStylerProfileSettings,
} from "./types";
import { FileNameStylerPlugin } from "./FileNameStylerPlugin";

export class ProfileModal extends Modal {
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

        const isActive = this.plugin.settings.activeProfiles.includes(
            this.profileName
        );

        if (!isActive) {
            contentEl.createEl("p", {
                text: "This profile is currently inactive. Changes will take effect when it's active.",
                cls: "mod-warning",
            });
        }

        this.createSectionHeading(contentEl, "Filename ID format");
        new Setting(contentEl)
            .setName("ID Format")
            .setDesc("Select the ID format used at the beginning of filenames.")
            .addDropdown((drop) => {
                drop.addOption("14", "14-digit (yyyyMMddHHmmss)");
                drop.addOption("12", "12-digit (yyMMddHHmmss)");
                drop.addOption("8", "8-digit (yyyyMMdd)");
                drop.addOption("custom", "Custom regex");

                drop.setValue(this.profileData.idFormat ?? "12");

                drop.onChange(async (value) => {
                    this.profileData.idFormat = value;
                    this.plugin.settings.profiles[this.profileName] =
                        this.profileData;
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
                .addText((text) => {
                    text.setPlaceholder("e.g. ^(\\d{6})([-_ ]?)(.+)$")
                        .setValue(this.profileData.customIdRegex ?? "")
                        .onChange(async (value) => {
                            this.profileData.customIdRegex = value;
                            this.plugin.settings.profiles[this.profileName] =
                                this.profileData;
                            await this.plugin.saveSettings();
                            this.plugin.refreshAll();
                        });
                });
        }

        this.createSectionHeading(contentEl, "ID display options");
        new Setting(contentEl)
            .setName("ID display")
            .setDesc("Control how the ID is shown in the filename")
            .addDropdown((drop) => {
                drop.addOption("hide", "Hide ID");
                drop.addOption("show", "Show ID at start");
                drop.addOption("end", "Move ID to end");

                drop.setValue(this.profileData.idDisplayMode ?? "hide");

                drop.onChange(async (value) => {
                    this.profileData.idDisplayMode = value as
                        | "hide"
                        | "show"
                        | "end";

                    this.plugin.settings.profiles[this.profileName] =
                        this.profileData;

                    await this.plugin.saveSettings();
                    this.plugin.refreshAll();
                });
            });

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
                    .addExtraButton((button) => {
                        button
                            .setIcon("x")
                            .setTooltip("Remove folder")
                            .onClick(async () => {
                                folders.splice(index, 1);
                                this.profileData.enabledFolders = folders;
                                this.plugin.settings.profiles[
                                    this.profileName
                                ] = this.profileData;
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
            .setDesc(
                "Add a folder prefix (e.g. 'projects/', 'notes/', or 'inbox'). Files in these folders will be styled."
            )
            .addText((text) => {
                text.setPlaceholder("folder or prefix").onChange((value) => {
                    newFolderPath = value;
                });
            })
            .addButton((btn) => {
                btn.setButtonText("Add")
                    .setCta()
                    .onClick(async () => {
                        if (!newFolderPath) return;

                        const folders = this.profileData.enabledFolders ?? [];
                        if (!folders.includes(newFolderPath)) {
                            folders.push(newFolderPath);
                            this.profileData.enabledFolders = folders;
                            this.plugin.settings.profiles[this.profileName] =
                                this.profileData;
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
            .addColorPicker((picker) => {
                picker.setValue(this.profileData.customColor || "#4b0082");
                picker.onChange(async (value) => {
                    this.profileData.customColor = value;
                    this.plugin.settings.profiles[this.profileName] =
                        this.profileData;
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
            "customFileIcon"
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
            "customPrefix"
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
            "customSuffix"
        );

        const closeBtn = contentEl.createEl("button", { text: "Close" });
        closeBtn.addEventListener("click", () => this.close());
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private createSectionHeading(
        container: HTMLElement,
        title: string,
        description?: string
    ): void {
        const heading = container.createDiv(
            "setting-item setting-item-heading"
        );
        const info = heading.createDiv("setting-item-info");
        info.createDiv({ cls: "setting-item-name", text: title });
        if (description) {
            info.createDiv({
                cls: "setting-item-description",
                text: description,
            });
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
            .addToggle((toggle) => {
                toggle.setValue((this.profileData[key] as boolean) ?? false);
                toggle.onChange(async (value) => {
                    this.setProfileDataValue(
                        key as keyof FileNameStylerProfileSettings,
                        value
                    );

                    Object.assign(
                        this.plugin.settings.profiles[this.profileName],
                        this.profileData
                    );

                    await this.plugin.saveSettings();
                    this.plugin.refreshAll();
                });
            });
    }

    private setProfileDataValue<K extends keyof FileNameStylerProfileSettings>(
        key: K,
        value: FileNameStylerProfileSettings[K]
    ) {
        this.profileData[key] = value;
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
            .addText((text) => {
                text.setPlaceholder("")
                    .setValue(
                        (this.profileData[key] as string) ??
                            (DEFAULT_PROFILE_SETTINGS[key] as string)
                    )
                    .onChange(async (value) => {
                        this.setProfileDataValue(
                            key as keyof FileNameStylerProfileSettings,
                            value
                        );

                        Object.assign(
                            this.plugin.settings.profiles[this.profileName],
                            this.profileData
                        );
                        await this.plugin.saveSettings();
                        this.plugin.refreshAll();
                    });
            })
            .addExtraButton((button) => {
                button
                    .setIcon("reset")
                    .setTooltip("Reset to default")
                    .onClick(async () => {
                        const typedKey =
                            key as keyof FileNameStylerProfileSettings;
                        this.setProfileDataValue(
                            typedKey,
                            DEFAULT_PROFILE_SETTINGS[typedKey]
                        );
                        Object.assign(
                            this.plugin.settings.profiles[this.profileName],
                            this.profileData
                        );
                        await this.plugin.saveSettings();
                        this.plugin.refreshAll();
                        this.onOpen();
                    });
            });
    }
}
