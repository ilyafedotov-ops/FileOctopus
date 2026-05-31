use app_ipc::{NativeMenuCommandEventDto, NATIVE_MENU_COMMAND_EVENT};
use tauri::{
    menu::{Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    AppHandle, Manager, Runtime,
};

const DIRECT_COMMAND_IDS: &[&str] = &[
    "create.folder",
    "create.file",
    "op.open",
    "op.view",
    "op.edit",
    "op.openDefault",
    "op.reveal",
    "op.rename",
    "op.copyTo",
    "op.moveTo",
    "op.trash",
    "op.compress",
    "op.extract",
    "op.deletePermanent",
    "op.properties",
    "op.cut",
    "op.copy",
    "op.paste",
    "clipboard.clear",
    "selection.selectAll",
    "selection.clear",
    "selection.invert",
    "clipboard.copyPath",
    "clipboard.copyName",
    "clipboard.copyParent",
    "clipboard.copyUri",
    "view.details",
    "view.list",
    "view.compact",
    "view.icons",
    "view.columns",
    "view.toggleSidebar",
    "view.toggleToolbar",
    "app.customizeToolbar",
    "view.toggleStatusBar",
    "view.toggleDualPane",
    "view.toggleHidden",
    "nav.refresh",
    "nav.back",
    "nav.forward",
    "nav.up",
    "nav.home",
    "nav.goToLocation",
    "nav.volumePicker",
    "nav.addFavorite",
    "nav.manageFavorites",
    "nav.recentLocations",
    "nav.clearRecentLocations",
    "filter",
    "recursive-search",
    "op.openTerminal",
    "op.openTerminalExternal",
    "view.toggleTerminal",
    "op.checksum",
    "op.calculateSize",
    "view.toggleActivity",
    "app.operationHistory",
    "app.diagnostics",
    "layout.switchPane",
    "layout.swapPanes",
    "layout.equalizePanes",
    "app.shortcuts",
    "app.about",
    "app.settings",
];

const SORT_MENU_IDS: &[(&str, &str)] = &[
    ("view.sort.name", "name"),
    ("view.sort.type", "type"),
    ("view.sort.size", "size"),
    ("view.sort.modified", "modified"),
    ("view.sort.created", "created"),
    ("view.sort.extension", "extension"),
    ("view.sort.permissions", "permissions"),
    ("view.sort.owner", "owner"),
];

const PREFERENCE_MENU_IDS: &[(&str, &str, &str)] = &[
    ("preferences.theme.system", "preferences.theme", "system"),
    ("preferences.theme.light", "preferences.theme", "light"),
    ("preferences.theme.dark", "preferences.theme", "dark"),
    (
        "preferences.density.compact",
        "preferences.density",
        "compact",
    ),
    (
        "preferences.density.comfortable",
        "preferences.density",
        "comfortable",
    ),
    (
        "preferences.density.spacious",
        "preferences.density",
        "spacious",
    ),
];

fn command_item<R: Runtime, M: Manager<R>>(
    manager: &M,
    id: &str,
    label: &str,
    accelerator: Option<&str>,
) -> tauri::Result<tauri::menu::MenuItem<R>> {
    let mut builder = MenuItemBuilder::with_id(id, label);
    if let Some(accelerator) = accelerator {
        builder = builder.accelerator(accelerator);
    }
    builder.build(manager)
}

pub(crate) fn native_menu_command(id: &str) -> Option<NativeMenuCommandEventDto> {
    if DIRECT_COMMAND_IDS.contains(&id) {
        return Some(NativeMenuCommandEventDto {
            command_id: id.to_string(),
            sort_field: None,
            preference_value: None,
        });
    }

    if id == "view.sort.asc" || id == "view.sort.desc" {
        return Some(NativeMenuCommandEventDto {
            command_id: if id == "view.sort.asc" {
                "view.sortAscending"
            } else {
                "view.sortDescending"
            }
            .to_string(),
            sort_field: None,
            preference_value: None,
        });
    }

    if let Some((_, field)) = SORT_MENU_IDS.iter().find(|(menu_id, _)| *menu_id == id) {
        return Some(NativeMenuCommandEventDto {
            command_id: "view.sort".to_string(),
            sort_field: Some((*field).to_string()),
            preference_value: None,
        });
    }

    if let Some((_, command_id, value)) = PREFERENCE_MENU_IDS
        .iter()
        .find(|(menu_id, _, _)| *menu_id == id)
    {
        return Some(NativeMenuCommandEventDto {
            command_id: (*command_id).to_string(),
            sort_field: None,
            preference_value: Some((*value).to_string()),
        });
    }

    None
}

pub(crate) fn handle_native_menu_event(app: &AppHandle, id: &str) {
    if let Some(command) = native_menu_command(id) {
        crate::emit::emit_event(app, NATIVE_MENU_COMMAND_EVENT, command);
    }
}

pub(crate) fn build_native_menu<R: Runtime, M: Manager<R>>(manager: &M) -> tauri::Result<Menu<R>> {
    let sort_menu = SubmenuBuilder::with_id(manager, "view.sort.menu", "Sort By")
        .item(&command_item(manager, "view.sort.name", "Name", None)?)
        .item(&command_item(manager, "view.sort.type", "Type", None)?)
        .item(&command_item(manager, "view.sort.size", "Size", None)?)
        .item(&command_item(
            manager,
            "view.sort.modified",
            "Date Modified",
            None,
        )?)
        .item(&command_item(
            manager,
            "view.sort.created",
            "Date Created",
            None,
        )?)
        .item(&command_item(
            manager,
            "view.sort.extension",
            "Extension",
            None,
        )?)
        .item(&command_item(
            manager,
            "view.sort.permissions",
            "Permissions",
            None,
        )?)
        .item(&command_item(manager, "view.sort.owner", "Owner", None)?)
        .separator()
        .item(&command_item(manager, "view.sort.asc", "Ascending", None)?)
        .item(&command_item(
            manager,
            "view.sort.desc",
            "Descending",
            None,
        )?)
        .build()?;

    let file = SubmenuBuilder::with_id(manager, "menu.file", "&File")
        .item(&command_item(
            manager,
            "create.folder",
            "New Folder...",
            Some("CmdOrCtrl+Shift+N"),
        )?)
        .item(&command_item(
            manager,
            "create.file",
            "Empty File...",
            None,
        )?)
        .separator()
        .item(&command_item(
            manager,
            "op.open",
            "Open Selected",
            Some("Enter"),
        )?)
        .item(&command_item(manager, "op.view", "View", Some("Space"))?)
        .item(&command_item(manager, "op.edit", "Edit", None)?)
        .item(&command_item(
            manager,
            "op.openDefault",
            "Open With Default App",
            None,
        )?)
        .item(&command_item(
            manager,
            "op.reveal",
            "Reveal in System File Manager",
            None,
        )?)
        .separator()
        .item(&command_item(
            manager,
            "op.rename",
            "Rename...",
            Some("F2"),
        )?)
        .item(&command_item(manager, "op.copyTo", "Copy To...", None)?)
        .item(&command_item(manager, "op.moveTo", "Move To...", None)?)
        .item(&command_item(
            manager,
            "op.trash",
            "Move to Trash...",
            None,
        )?)
        .item(&command_item(manager, "op.compress", "Pack...", None)?)
        .item(&command_item(manager, "op.extract", "Unpack...", None)?)
        .item(&command_item(
            manager,
            "op.deletePermanent",
            "Delete Permanently...",
            Some("Shift+Delete"),
        )?)
        .item(&command_item(
            manager,
            "op.properties",
            "Properties...",
            Some("Alt+Enter"),
        )?)
        .separator()
        .item(&command_item(
            manager,
            "app.settings",
            "Settings...",
            Some("CmdOrCtrl+,"),
        )?)
        .item(&PredefinedMenuItem::quit(manager, Some("Exit"))?)
        .build()?;

    let edit = SubmenuBuilder::with_id(manager, "menu.edit", "&Edit")
        .item(&command_item(
            manager,
            "op.cut",
            "Cut",
            Some("CmdOrCtrl+X"),
        )?)
        .item(&command_item(
            manager,
            "op.copy",
            "Copy",
            Some("CmdOrCtrl+C"),
        )?)
        .item(&command_item(
            manager,
            "op.paste",
            "Paste",
            Some("CmdOrCtrl+V"),
        )?)
        .item(&command_item(
            manager,
            "clipboard.clear",
            "Clear File Clipboard",
            None,
        )?)
        .separator()
        .item(&command_item(
            manager,
            "selection.selectAll",
            "Select All",
            Some("CmdOrCtrl+A"),
        )?)
        .item(&command_item(
            manager,
            "selection.clear",
            "Clear Selection",
            None,
        )?)
        .item(&command_item(
            manager,
            "selection.invert",
            "Invert Selection",
            None,
        )?)
        .separator()
        .item(&command_item(
            manager,
            "clipboard.copyPath",
            "Copy Full Path",
            None,
        )?)
        .item(&command_item(
            manager,
            "clipboard.copyName",
            "Copy File Name",
            None,
        )?)
        .item(&command_item(
            manager,
            "clipboard.copyParent",
            "Copy Parent Folder Path",
            None,
        )?)
        .item(&command_item(
            manager,
            "clipboard.copyUri",
            "Copy Resource URI",
            None,
        )?)
        .build()?;

    let view = SubmenuBuilder::with_id(manager, "menu.view", "&View")
        .item(&command_item(
            manager,
            "view.details",
            "Details View",
            None,
        )?)
        .item(&command_item(manager, "view.list", "List View", None)?)
        .item(&command_item(
            manager,
            "view.compact",
            "Compact View",
            None,
        )?)
        .item(&command_item(manager, "view.icons", "Icons View", None)?)
        .item(&command_item(
            manager,
            "view.columns",
            "Columns View",
            None,
        )?)
        .separator()
        .item(&sort_menu)
        .separator()
        .item(&command_item(
            manager,
            "preferences.theme.system",
            "Theme: System",
            None,
        )?)
        .item(&command_item(
            manager,
            "preferences.theme.light",
            "Theme: Light",
            None,
        )?)
        .item(&command_item(
            manager,
            "preferences.theme.dark",
            "Theme: Dark",
            None,
        )?)
        .separator()
        .item(&command_item(
            manager,
            "preferences.density.compact",
            "Density: Compact",
            None,
        )?)
        .item(&command_item(
            manager,
            "preferences.density.comfortable",
            "Density: Comfortable",
            None,
        )?)
        .item(&command_item(
            manager,
            "preferences.density.spacious",
            "Density: Spacious",
            None,
        )?)
        .separator()
        .item(&command_item(
            manager,
            "view.toggleSidebar",
            "Show Sidebar",
            None,
        )?)
        .item(&command_item(
            manager,
            "view.toggleToolbar",
            "Show Toolbar",
            None,
        )?)
        .item(&command_item(
            manager,
            "app.customizeToolbar",
            "Customize Button Bar...",
            None,
        )?)
        .item(&command_item(
            manager,
            "view.toggleStatusBar",
            "Show Status Bar",
            None,
        )?)
        .item(&command_item(
            manager,
            "view.toggleDualPane",
            "Dual Pane",
            None,
        )?)
        .separator()
        .item(&command_item(
            manager,
            "view.toggleHidden",
            "Show Hidden Files",
            Some("CmdOrCtrl+."),
        )?)
        .item(&command_item(
            manager,
            "nav.refresh",
            "Refresh",
            Some("CmdOrCtrl+R"),
        )?)
        .build()?;

    let go = SubmenuBuilder::with_id(manager, "menu.go", "&Go")
        .item(&command_item(
            manager,
            "nav.back",
            "Back",
            Some("Alt+Left"),
        )?)
        .item(&command_item(
            manager,
            "nav.forward",
            "Forward",
            Some("Alt+Right"),
        )?)
        .item(&command_item(manager, "nav.up", "Up to Parent", None)?)
        .item(&command_item(
            manager,
            "nav.home",
            "Home",
            Some("Alt+Home"),
        )?)
        .separator()
        .item(&command_item(
            manager,
            "nav.goToLocation",
            "Location...",
            Some("CmdOrCtrl+L"),
        )?)
        .item(&command_item(
            manager,
            "nav.volumePicker",
            "Volumes...",
            None,
        )?)
        .separator()
        .item(&command_item(
            manager,
            "nav.addFavorite",
            "Add Current Folder",
            None,
        )?)
        .item(&command_item(
            manager,
            "nav.manageFavorites",
            "Manage Favorites...",
            None,
        )?)
        .item(&command_item(
            manager,
            "nav.recentLocations",
            "Recent Locations...",
            None,
        )?)
        .item(&command_item(
            manager,
            "nav.clearRecentLocations",
            "Clear Recent Locations...",
            None,
        )?)
        .build()?;

    let tools = SubmenuBuilder::with_id(manager, "menu.tools", "&Tools")
        .item(&command_item(
            manager,
            "filter",
            "Filter Current Folder",
            Some("CmdOrCtrl+F"),
        )?)
        .item(&command_item(
            manager,
            "recursive-search",
            "Search Recursively...",
            None,
        )?)
        .separator()
        .item(&command_item(
            manager,
            "op.openTerminal",
            "Open Terminal",
            None,
        )?)
        .item(&command_item(
            manager,
            "op.openTerminalExternal",
            "Open External Terminal",
            None,
        )?)
        .item(&command_item(
            manager,
            "view.toggleTerminal",
            "Toggle Terminal Panel",
            None,
        )?)
        .item(&command_item(manager, "op.checksum", "Checksum...", None)?)
        .item(&command_item(
            manager,
            "op.calculateSize",
            "Calculate Size",
            None,
        )?)
        .item(&command_item(
            manager,
            "view.toggleActivity",
            "Job Activity...",
            None,
        )?)
        .item(&command_item(
            manager,
            "app.operationHistory",
            "Operation History...",
            None,
        )?)
        .separator()
        .item(&command_item(
            manager,
            "app.diagnostics",
            "Diagnostics...",
            None,
        )?)
        .build()?;

    let window = SubmenuBuilder::with_id(manager, "menu.window", "&Window")
        .item(&command_item(
            manager,
            "layout.switchPane",
            "Switch Active Pane",
            None,
        )?)
        .separator()
        .item(&command_item(
            manager,
            "layout.swapPanes",
            "Swap Panes",
            Some("CmdOrCtrl+U"),
        )?)
        .item(&command_item(
            manager,
            "layout.equalizePanes",
            "Equalize Pane Widths",
            None,
        )?)
        .build()?;

    let help = SubmenuBuilder::with_id(manager, "menu.help", "&Help")
        .item(&command_item(
            manager,
            "app.shortcuts",
            "Keyboard Shortcuts...",
            Some("CmdOrCtrl+/"),
        )?)
        .separator()
        .item(&command_item(
            manager,
            "app.diagnostics",
            "Diagnostics...",
            None,
        )?)
        .separator()
        .item(&command_item(
            manager,
            "app.about",
            "About FileOctopus...",
            None,
        )?)
        .build()?;

    let menu = Menu::new(manager)?;
    menu.append(&file)?;
    menu.append(&edit)?;
    menu.append(&view)?;
    menu.append(&go)?;
    menu.append(&tools)?;
    menu.append(&window)?;
    menu.append(&help)?;
    Ok(menu)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_sort_menu_ids_to_command_payloads() {
        let payload = native_menu_command("view.sort.permissions").unwrap();

        assert_eq!(payload.command_id, "view.sort");
        assert_eq!(payload.sort_field.as_deref(), Some("permissions"));
        assert_eq!(payload.preference_value, None);
    }

    #[test]
    fn maps_preference_menu_ids_to_command_payloads() {
        let payload = native_menu_command("preferences.density.spacious").unwrap();

        assert_eq!(payload.command_id, "preferences.density");
        assert_eq!(payload.sort_field, None);
        assert_eq!(payload.preference_value.as_deref(), Some("spacious"));
    }

    #[test]
    fn maps_direct_menu_ids_to_command_payloads() {
        let payload = native_menu_command("op.rename").unwrap();

        assert_eq!(payload.command_id, "op.rename");
        assert_eq!(payload.sort_field, None);
        assert_eq!(payload.preference_value, None);
    }
}
