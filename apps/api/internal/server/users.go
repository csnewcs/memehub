package server

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
)

type adminUser struct {
	ID          uuid.UUID `json:"id"`
	Username    *string   `json:"username"`
	DisplayName *string   `json:"display_name"`
	IsAdmin     bool      `json:"is_admin"`
	CreatedAt   time.Time `json:"created_at"`
}

func (s *Server) listUsers(w http.ResponseWriter, r *http.Request) {
	if !s.adminSession(w, r, false) {
		return
	}
	limit := 50
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > 100 {
			problem(w, 400, "invalid_limit")
			return
		}
		limit = n
	}
	var at *time.Time
	var id *uuid.UUID
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		if len(raw) > 512 {
			problem(w, 400, "invalid_cursor")
			return
		}
		data, err := base64.RawURLEncoding.DecodeString(raw)
		var c cursor
		if err != nil || json.Unmarshal(data, &c) != nil || c.CreatedAt.IsZero() || c.ID == uuid.Nil {
			problem(w, 400, "invalid_cursor")
			return
		}
		at = &c.CreatedAt
		id = &c.ID
	}
	rows, err := s.db.Query(r.Context(), `SELECT id,username,display_name,is_admin,created_at FROM users WHERE ($1::timestamptz IS NULL OR (created_at,id)<($1,$2::uuid)) ORDER BY created_at DESC,id DESC LIMIT $3`, at, id, limit+1)
	if err != nil {
		internal(w)
		return
	}
	defer rows.Close()
	items := []adminUser{}
	for rows.Next() {
		var item adminUser
		if err = rows.Scan(&item.ID, &item.Username, &item.DisplayName, &item.IsAdmin, &item.CreatedAt); err != nil {
			internal(w)
			return
		}
		items = append(items, item)
	}
	if rows.Err() != nil {
		internal(w)
		return
	}
	var next *string
	if len(items) > limit {
		items = items[:limit]
		last := items[len(items)-1]
		data, _ := json.Marshal(cursor{CreatedAt: last.CreatedAt, ID: last.ID})
		value := base64.RawURLEncoding.EncodeToString(data)
		next = &value
	}
	writeJSON(w, 200, map[string]any{"items": items, "next_cursor": next})
}
