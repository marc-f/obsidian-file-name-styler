import {
    FileNameStylerGlobalSettings,
    FileNameStylerProfileSettings,
} from "./types";

export class SettingsMigrator {
    migrate(settings: FileNameStylerGlobalSettings): {
        migrated: FileNameStylerGlobalSettings;
        changed: boolean;
    } {
        const migratedSettings = { ...settings };
        let changed = false;

        for (const profileName in migratedSettings.profiles) {
            const profile = migratedSettings.profiles[profileName];

            const { profile: migratedProfile, changed: profileChanged } =
                this.migrateMoveIdToEnd(profile);

            if (profileChanged) {
                console.info(
                    `[FileNameStyler] Migrated profile: ${profileName}`
                );
                migratedSettings.profiles[profileName] = migratedProfile;
                changed = true;
            }
        }

        return { migrated: migratedSettings, changed };
    }

    private migrateMoveIdToEnd(
        profile: Partial<FileNameStylerProfileSettings>
    ): {
        profile: Partial<FileNameStylerProfileSettings>;
        changed: boolean;
    } {
        let changed = false;

        if (profile.idDisplayMode === undefined) {
            const idDisplayMode: "hide" | "end" =
                profile.moveIdToEnd === true ? "end" : "hide";

            profile = {
                ...profile,
                idDisplayMode,
            };
            changed = true;
        }

        if ("moveIdToEnd" in profile) {
            delete profile.moveIdToEnd;
            changed = true;
        }

        return { profile, changed };
    }
}
