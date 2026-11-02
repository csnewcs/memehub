package server

import (
	"net/http"
	"strings"
	"unicode"
	"unicode/utf8"
)

func (s *Server) searchSuggestions(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	q := r.URL.Query().Get("q")
	if (kind != "user" && kind != "tag") || !utf8.ValidString(q) || utf8.RuneCountInString(q) > 200 || strings.IndexFunc(q, unicode.IsControl) >= 0 {
		problem(w, 400, "invalid_suggestion_query")
		return
	}
	prefix := strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(q) + "%"
	sql := `SELECT t.name,t.name FROM tags t
 WHERE lower(t.name) LIKE lower($1) AND EXISTS(SELECT 1 FROM meme_tags mt JOIN memes m ON m.id=mt.meme_id WHERE mt.tag_id=t.id AND m.status='ready' AND m.deleted_at IS NULL)
 ORDER BY t.normalized_name,t.name LIMIT 5`
	args := []any{prefix}
	if kind == "user" {
		sql = `SELECT DISTINCT ON (lower(u.username)) u.username,COALESCE(NULLIF(u.display_name,''),u.username) FROM users u
 WHERE u.oidc_issuer=$2 AND u.username IS NOT NULL AND (lower(u.username) LIKE lower($1) OR lower(u.display_name) LIKE lower($1))
 AND EXISTS(SELECT 1 FROM memes m WHERE m.created_by=u.id AND m.status='ready' AND m.deleted_at IS NULL)
 ORDER BY lower(u.username),u.id LIMIT 5`
		args = append(args, s.cfg.OIDCIssuer)
	}
	rows, err := s.db.Query(r.Context(), sql, args...)
	if err != nil {
		internal(w)
		return
	}
	defer rows.Close()
	type suggestion struct {
		Value string `json:"value"`
		Label string `json:"label"`
	}
	items := []suggestion{}
	for rows.Next() {
		var item suggestion
		if err = rows.Scan(&item.Value, &item.Label); err != nil {
			internal(w)
			return
		}
		items = append(items, item)
	}
	if rows.Err() != nil {
		internal(w)
		return
	}
	writeJSON(w, 200, map[string]any{"items": items})
}
