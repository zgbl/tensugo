mod common;

#[cfg(any(target_os = "ios", target_os = "android"))]
mod mobile;

#[cfg(target_os = "macos")]
mod macos;

#[cfg(target_os = "windows")]
mod windows;

#[cfg(not(any(
    target_os = "macos",
    target_os = "windows",
    target_os = "ios",
    target_os = "android"
)))]
mod desktop_other;

pub use common::{engine_runtime_dir, platform_paths, resource_dir, PlatformPaths};

#[cfg(any(target_os = "ios", target_os = "android"))]
pub use mobile::{
    choose_file_path, choose_save_path, common_engine_roots, current_platform, executable_name,
    known_engine_profiles, local_engine_supported,
};

#[cfg(target_os = "macos")]
pub use macos::{
    choose_file_path, choose_save_path, common_engine_roots, current_platform, executable_name,
    known_engine_profiles, local_engine_supported,
};

#[cfg(target_os = "windows")]
pub use windows::{
    choose_file_path, choose_save_path, common_engine_roots, current_platform, executable_name,
    known_engine_profiles, local_engine_supported,
};

#[cfg(not(any(
    target_os = "macos",
    target_os = "windows",
    target_os = "ios",
    target_os = "android"
)))]
pub use desktop_other::{
    choose_file_path, choose_save_path, common_engine_roots, current_platform, executable_name,
    known_engine_profiles, local_engine_supported,
};
