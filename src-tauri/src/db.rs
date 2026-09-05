use dirs;
use rusqlite::{Connection, Result};
use serde::Serialize;
use std::collections::HashMap;

const DATABASE_NAME: &str = "deadline_guardian.db";

fn get_db_path() -> String {
    let project_root = std::env::current_dir().expect("Failed to get current directory");
    let app_dir = project_root.join("data");
    
    if let Err(e) = std::fs::create_dir_all(&app_dir) {
        eprintln!("Warning: Failed to create app dir: {}", e);
    }
    
    let path = app_dir.join(DATABASE_NAME);
    path.to_string_lossy().to_string()
}

const CREATE_TABLES_SQL: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS tasks (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    title         TEXT NOT NULL CHECK(length(title) BETWEEN 2 AND 100),
    deadline      TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'overdue')),
    tags          TEXT DEFAULT '[]',
    show_floating INTEGER NOT NULL DEFAULT 0,
    completed_at  TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_show_floating ON tasks(show_floating) WHERE show_floating = 1;

CREATE TABLE IF NOT EXISTS floating_card_configs (
    task_id       TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
    pos_x         REAL NOT NULL DEFAULT 20,
    pos_y         REAL NOT NULL DEFAULT 20,
    card_width    INTEGER NOT NULL DEFAULT 220,
    font_family   TEXT NOT NULL DEFAULT 'PingFang SC',
    font_size     INTEGER NOT NULL DEFAULT 13,
    font_bold     INTEGER NOT NULL DEFAULT 1,
    text_color    TEXT NOT NULL DEFAULT '#FFFFFF',
    always_on_top INTEGER NOT NULL DEFAULT 1,
    click_through INTEGER NOT NULL DEFAULT 0,
    monitor_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS health_configs (
    id            TEXT PRIMARY KEY,
    enabled       INTEGER NOT NULL DEFAULT 0,
    interval_min  INTEGER NOT NULL DEFAULT 45,
    extra_config  TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS water_log (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    date          TEXT NOT NULL,
    count         INTEGER NOT NULL DEFAULT 0,
    UNIQUE(date)
);

CREATE TABLE IF NOT EXISTS settings (
    id                TEXT PRIMARY KEY DEFAULT 'singleton',
    idle_reset_min    INTEGER NOT NULL DEFAULT 5,
    notify_mode       TEXT NOT NULL DEFAULT 'sound_popup',
    auto_start        INTEGER NOT NULL DEFAULT 1,
    close_action      TEXT NOT NULL DEFAULT 'minimize',
    hotkeys           TEXT DEFAULT '{}',
    today_silent_date TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS recent_colors (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    hex           TEXT NOT NULL,
    source        TEXT NOT NULL DEFAULT 'theme',
    used_at       TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS tags (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    name          TEXT NOT NULL UNIQUE CHECK(length(name) BETWEEN 1 AND 20),
    color         TEXT NOT NULL DEFAULT '#3B82F6',
    created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

CREATE TABLE IF NOT EXISTS sprint_snapshots (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    drinking_interval_min  INTEGER,
    standing_enabled       INTEGER,
    eyecare_mode           TEXT,
    entered_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    exited_at     TEXT
);

CREATE TRIGGER IF NOT EXISTS trg_recent_colors_cleanup
AFTER INSERT ON recent_colors
WHEN (SELECT COUNT(*) FROM recent_colors) > 30
BEGIN
    DELETE FROM recent_colors
    WHERE id IN (
        SELECT id FROM recent_colors
        ORDER BY used_at ASC
        LIMIT (SELECT COUNT(*) FROM recent_colors) - 30
    );
END;
"#;

const INSERT_DEFAULT_HEALTH_CONFIGS: &str = r#"
INSERT OR IGNORE INTO health_configs VALUES ('drinking', 0, 45, '{"cup_ml":200,"daily_goal":8,"gender":"male"}');
INSERT OR IGNORE INTO health_configs VALUES ('standing', 0, 60, '{}');
INSERT OR IGNORE INTO health_configs VALUES ('eyecare', 0, 20, '{"mode":"gentle","look_duration":20,"custom_text":"眨眨眼，进行远眺"}');
"#;

const INSERT_DEFAULT_SETTINGS: &str = r#"
INSERT OR IGNORE INTO settings VALUES ('singleton', 5, 'sound_popup', 1, 'minimize', '{}', NULL);
"#;

fn create_tables(conn: &Connection) -> Result<()> {
    conn.execute_batch(CREATE_TABLES_SQL)?;
    conn.execute_batch(INSERT_DEFAULT_HEALTH_CONFIGS)?;
    conn.execute_batch(INSERT_DEFAULT_SETTINGS)?;
    Ok(())
}

fn backup_corrupt_db(db_path: &str) {
    let backup_path = format!("{}.corrupt.bak", db_path);
    if let Err(e) = std::fs::copy(db_path, &backup_path) {
        eprintln!("Failed to backup corrupted database: {}", e);
    } else {
        eprintln!("Corrupted database backed up to: {}", backup_path);
    }
}

pub fn ensure_db_healthy(conn: &Connection) -> Result<()> {
    let result: String = conn.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    
    if result != "ok" {
        eprintln!("Database integrity check failed: {}", result);
        let db_path = get_db_path();
        backup_corrupt_db(&db_path);
        create_tables(conn)?;
        eprintln!("Database recreated due to corruption");
    }
    
    Ok(())
}

pub fn init_db() -> Result<Connection> {
    let db_path = get_db_path();
    
    let conn = Connection::open(&db_path)?;
    
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "busy_timeout", 5000)?;
    
    create_tables(&conn)?;
    ensure_db_healthy(&conn)?;
    
    Ok(conn)
}

pub fn get_connection() -> Result<Connection> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path)?;
    conn.pragma_update(None, "busy_timeout", 5000)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    Ok(conn)
}

pub fn quick_test() -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    // Test INSERT
    conn.execute(
        "INSERT INTO tasks (title, deadline, status, tags, show_floating) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params!["__TEST__", "2099-01-01T00:00:00Z", "pending", "[]", 0],
    ).map_err(|e| format!("INSERT failed: {}", e))?;
    println!("[DB_TEST] INSERT succeeded");
    // Test SELECT
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM tasks WHERE title = '__TEST__'", [], |row| row.get(0))
        .map_err(|e| format!("SELECT failed: {}", e))?;
    println!("[DB_TEST] SELECT count={}", count);
    // Cleanup
    conn.execute("DELETE FROM tasks WHERE title = '__TEST__'", [])
        .map_err(|e| format!("DELETE failed: {}", e))?;
    println!("[DB_TEST] DELETE succeeded");
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub rows: Vec<HashMap<String, serde_json::Value>>,
    pub rows_affected: i64,
}

#[tauri::command]
pub fn db_execute(sql: String, params: Vec<serde_json::Value>) -> Result<QueryResult, String> {
    println!("[DB_EXEC] sql={}, params={:?}", sql, params);
    let conn = get_connection().map_err(|e| {
        let msg = format!("DB connection failed: {}", e);
        println!("[DB_EXEC] ERROR: {}", msg);
        msg
    })?;
    
    let rows_affected = if params.is_empty() {
        conn.execute(&sql, []).map_err(|e| {
            let msg = format!("DB execute failed: {}", e);
            println!("[DB_EXEC] ERROR: {}", msg);
            msg
        })?
    } else {
        let mut stmt = conn.prepare(&sql).map_err(|e| {
            let msg = format!("DB prepare failed: {}", e);
            println!("[DB_EXEC] ERROR: {}", msg);
            msg
        })?;
        let sql_values: Vec<rusqlite::types::Value> =
            params.into_iter().map(to_sql_value).collect();
        println!("[DB_EXEC] sql_values={:?}", sql_values);
        stmt.execute(rusqlite::params_from_iter(sql_values.iter()))
            .map_err(|e| {
                let msg = format!("DB stmt execute failed: {}", e);
                println!("[DB_EXEC] ERROR: {}", msg);
                msg
            })?
    };
    
    println!("[DB_EXEC] SUCCESS rows_affected={}", rows_affected);
    Ok(QueryResult {
        rows: Vec::new(),
        rows_affected: rows_affected as i64,
    })
}

#[tauri::command]
pub fn db_query(sql: String, params: Vec<serde_json::Value>) -> Result<Vec<HashMap<String, serde_json::Value>>, String> {
    println!("[DB_QUERY] sql={}, params={:?}", sql, params);
    let conn = get_connection().map_err(|e| {
        let msg = format!("DB query connection failed: {}", e);
        println!("[DB_QUERY] ERROR: {}", msg);
        msg
    })?;
    let mut stmt = conn.prepare(&sql).map_err(|e| {
        let msg = format!("DB query prepare failed: {}", e);
        println!("[DB_QUERY] ERROR: {}", msg);
        msg
    })?;
    
    let column_names: Vec<String> = stmt
        .column_names()
        .iter()
        .map(|c| c.to_string())
        .collect();
    
    let sql_values: Vec<rusqlite::types::Value> =
        params.into_iter().map(to_sql_value).collect();
    
    let mut query_iter = stmt
        .query(rusqlite::params_from_iter(sql_values.iter()))
        .map_err(|e| e.to_string())?;
    
    let mut rows = Vec::new();
    
    while let Some(row) = query_iter.next().map_err(|e| e.to_string())? {
        let mut row_map = HashMap::new();
        
        for (i, col_name) in column_names.iter().enumerate() {
            let value: Option<serde_json::Value> = match row.get::<usize, rusqlite::types::Value>(i) {
                Ok(v) => match v {
                    rusqlite::types::Value::Null => Some(serde_json::Value::Null),
                    rusqlite::types::Value::Integer(n) => Some(serde_json::Value::Number(n.into())),
                    rusqlite::types::Value::Real(n) => Some(serde_json::Value::Number(serde_json::Number::from_f64(n).unwrap())),
                    rusqlite::types::Value::Text(s) => Some(serde_json::Value::String(s.to_string())),
                    rusqlite::types::Value::Blob(_) => Some(serde_json::Value::String("[BLOB]".to_string())),
                },
                Err(_) => None,
            };
            
            if let Some(v) = value {
                row_map.insert(col_name.clone(), v);
            }
        }
        
        rows.push(row_map);
    }
    
    Ok(rows)
}

fn to_sql_value(v: serde_json::Value) -> rusqlite::types::Value {
    if v.is_null() {
        rusqlite::types::Value::Null
    } else if let Some(s) = v.as_str() {
        rusqlite::types::Value::Text(s.to_string())
    } else if let Some(n) = v.as_i64() {
        rusqlite::types::Value::Integer(n)
    } else if let Some(n) = v.as_f64() {
        rusqlite::types::Value::Real(n)
    } else if let Some(b) = v.as_bool() {
        rusqlite::types::Value::Integer(if b { 1 } else { 0 })
    } else {
        rusqlite::types::Value::Text(v.to_string())
    }
}
