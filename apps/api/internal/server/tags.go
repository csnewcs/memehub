package server

import (
	"encoding/base64"
	"encoding/json"
	"github.com/noeulnight/memehub/apps/api/internal/tag"
	"net/http"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
)

type tagListItem struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	MemeCount int64     `json:"meme_count"`
}
type tagCursor struct {
	Count int64     `json:"count"`
	ID    uuid.UUID `json:"id"`
}

func (s *Server) listTags(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if !utf8.ValidString(q) || utf8.RuneCountInString(q) > 200 || strings.IndexFunc(q, unicode.IsControl) >= 0 {
		problem(w, 400, "invalid_query")
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
	var count *int64
	var id *uuid.UUID
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		if len(raw) > 512 {
			problem(w, 400, "invalid_cursor")
			return
		}
		data, err := base64.RawURLEncoding.DecodeString(raw)
		var c tagCursor
		if err != nil || json.Unmarshal(data, &c) != nil || c.Count < 1 || c.ID == uuid.Nil {
			problem(w, 400, "invalid_cursor")
			return
		}
		count = &c.Count
		id = &c.ID
	}
	q = tag.Name(q)
	pattern := "%" + strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(q) + "%"
	rows, err := s.db.Query(r.Context(), `WITH counts AS (
 SELECT t.id,t.name,count(*) AS meme_count FROM tags t
 JOIN meme_tags mt ON mt.tag_id=t.id JOIN memes m ON m.id=mt.meme_id
 WHERE m.deleted_at IS NULL AND m.status='ready' AND t.name ILIKE $1
 GROUP BY t.id
 ) SELECT id,name,meme_count FROM counts
 WHERE ($2::bigint IS NULL OR meme_count<$2 OR (meme_count=$2 AND id>$3::uuid))
 ORDER BY meme_count DESC,id ASC LIMIT $4`, pattern, count, id, limit+1)
	if err != nil {
		internal(w)
		return
	}
	defer rows.Close()
	items := []tagListItem{}
	for rows.Next() {
		var item tagListItem
		if err = rows.Scan(&item.ID, &item.Name, &item.MemeCount); err != nil {
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
		data, _ := json.Marshal(tagCursor{Count: last.MemeCount, ID: last.ID})
		value := base64.RawURLEncoding.EncodeToString(data)
		next = &value
	}
	writeJSON(w, 200, map[string]any{"items": items, "next_cursor": next})
}
