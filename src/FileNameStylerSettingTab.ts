import { App, PluginSettingTab, Setting } from "obsidian";
import { ProfileModal } from "./ProfileModal";
import {
    DEFAULT_PROFILE_SETTINGS,
    FileNameStylerProfileSettings,
} from "./types";
import { FileNameStylerPlugin } from "./FileNameStylerPlugin";

export class FileNameStylerSettingTab extends PluginSettingTab {
    plugin: FileNameStylerPlugin;
    newProfileName: string = "";

    constructor(app: App, plugin: FileNameStylerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        const profileHeading = containerEl.createDiv(
            "setting-item setting-item-heading"
        );
        const profileInfo = profileHeading.createDiv("setting-item-info");
        profileInfo.createDiv({
            cls: "setting-item-name",
            text: "Filename styling profiles",
        });

        new Setting(containerEl)
            .setName("New Profile")
            .setDesc("Enter a profile name and add it")
            .addText((text) => {
                text.setPlaceholder("e.g. Focus Mode").onChange(
                    (value) => (this.newProfileName = value)
                );
            })
            .addExtraButton((button) => {
                button
                    .setIcon("circle-plus")
                    .setTooltip("Add profile")
                    .onClick(async () => {
                        if (!this.newProfileName) return;
                        this.plugin.settings.profiles[this.newProfileName] =
                            this.getCleanSettings();
                        await this.plugin.saveSettings();
                        this.newProfileName = "";
                        this.display();
                    });
            });

        Object.keys(this.plugin.settings.profiles).forEach((profileName) => {
            const isActive =
                this.plugin.settings.activeProfiles.includes(profileName);

            new Setting(containerEl)
                .setName(profileName)
                .addToggle((toggle) =>
                    toggle.setValue(isActive).onChange(async (value) => {
                        const idx =
                            this.plugin.settings.activeProfiles.indexOf(
                                profileName
                            );
                        if (value && idx === -1) {
                            this.plugin.settings.activeProfiles.push(
                                profileName
                            );
                        } else if (!value && idx > -1) {
                            this.plugin.settings.activeProfiles.splice(idx, 1);
                        }
                        await this.plugin.saveSettings();
                        this.plugin.refreshAll();
                        this.display();
                    })
                )
                .addExtraButton((btn) => {
                    btn.setIcon("settings")
                        .setTooltip("Show profile details")
                        .onClick(() => {
                            new ProfileModal(
                                this.app,
                                profileName,
                                this.plugin.settings.profiles[profileName],
                                this.plugin
                            ).open();
                        });
                })
                .addExtraButton((btn) => {
                    btn.setIcon("x")
                        .setTooltip("Remove profile")
                        .onClick(async () => {
                            delete this.plugin.settings.profiles[profileName];
                            this.plugin.settings.activeProfiles =
                                this.plugin.settings.activeProfiles.filter(
                                    (p) => p !== profileName
                                );
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
