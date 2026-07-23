package migrations

import "embed"

// FS holds the MySQL migration SQL files (001–006).
//
//go:embed *.sql
var FS embed.FS
