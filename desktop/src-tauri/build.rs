#[path = "../tools/panel_guard.rs"]
mod panel_guard;

fn main() {
    let manifest = std::path::PathBuf::from(std::env::var_os("CARGO_MANIFEST_DIR").unwrap());
    let source = manifest.join("../../index.html");
    let embedded = manifest.join("../dist/index.html");
    println!("cargo:rerun-if-changed={}", source.display());
    println!("cargo:rerun-if-changed={}", embedded.display());
    let source = std::fs::read_to_string(source).expect("Cannot read source index.html");
    let embedded = std::fs::read_to_string(embedded)
        .expect("Cannot read embedded panel; run node desktop/tools/sync-panel.mjs from the repository root");
    panel_guard::check_panel(&source, &embedded).expect("Panel consistency check failed");
    tauri_build::build()
}
