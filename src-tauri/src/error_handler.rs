use dirs;
use std::panic;
use std::fs;
use std::io::Write;

use chrono;
use serde;

pub fn install_panic_handler() {
    panic::set_hook(Box::new(|panic_info| {
        let payload = panic_info
            .payload()
            .downcast_ref::<&str>()
            .unwrap_or(&"unknown panic payload");
        
        let message = format!("Rust panic occurred: {}\n", payload);
        
        if let Some(location) = panic_info.location() {
            let location_str = format!("Location: {}:{}:{}\n", 
                location.file(), 
                location.line(), 
                location.column()
            );
            eprintln!("{}", message);
            eprintln!("{}", location_str);
            write_panic_log(&format!("{}{}", message, location_str));
        } else {
            eprintln!("{}", message);
            write_panic_log(&message);
        }
    }));
}

fn write_panic_log(content: &str) {
    let log_path = get_log_path();
    
    if let Ok(mut file) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let log_entry = format!("\n[{}] {}\n", timestamp, content);
        
        if let Err(e) = writeln!(file, "{}", log_entry) {
            eprintln!("Failed to write panic log: {}", e);
        }
    } else {
        eprintln!("Failed to open panic log file: {}", log_path);
    }
}

fn get_log_path() -> String {
    let project_root = std::env::current_dir().expect("Failed to get current directory");
    let app_dir = project_root.join("logs");
    
    if let Err(e) = std::fs::create_dir_all(&app_dir) {
        eprintln!("Warning: Failed to create log dir: {}", e);
    }
    
    app_dir.join("panic.log").to_string_lossy().to_string()
}

#[derive(Debug)]
pub enum AppError {
    Database(String),
    Window(String),
    InvalidInput(String),
    Internal(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            AppError::Database(msg) => write!(f, "Database error: {}", msg),
            AppError::Window(msg) => write!(f, "Window error: {}", msg),
            AppError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            AppError::Internal(msg) => write!(f, "Internal error: {}", msg),
        }
    }
}

impl std::error::Error for AppError {}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Database(e.to_string())
    }
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
