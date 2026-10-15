// Shared by build.rs and dependency-free local tests.
pub fn check_panel(source: &str, embedded: &str) -> Result<(), &'static str> {
    if source.replace("\r\n", "\n") == embedded.replace("\r\n", "\n") {
        Ok(())
    } else {
        Err("Embedded panel is stale. From the repository root run: node desktop/tools/sync-panel.mjs")
    }
}

#[cfg(test)]
mod tests {
    use super::check_panel;

    #[test]
    fn same_panel_passes() {
        assert!(check_panel("<html>current</html>\n", "<html>current</html>\n").is_ok());
    }

    #[test]
    fn checkout_line_endings_do_not_cause_drift() {
        assert!(check_panel("first\r\nsecond\r\n", "first\nsecond\n").is_ok());
    }

    #[test]
    fn stale_panel_stops_the_build_with_sync_instructions() {
        assert!(check_panel("new panel", "old panel")
            .unwrap_err()
            .contains("sync-panel.mjs"));
    }
}
