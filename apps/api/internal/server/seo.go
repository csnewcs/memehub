package server

import (
	"encoding/xml"
	"net/http"
	"net/url"
	"time"

	"github.com/google/uuid"
)

type sitemapURL struct {
	Loc     string `xml:"loc"`
	LastMod string `xml:"lastmod,omitempty"`
}
type sitemap struct {
	XMLName   xml.Name     `xml:"urlset"`
	Namespace string       `xml:"xmlns,attr"`
	URLs      []sitemapURL `xml:"url"`
}

func (s *Server) sitemap(w http.ResponseWriter, r *http.Request) {
	base, err := url.Parse(s.cfg.AppBaseURL)
	if err != nil {
		internal(w)
		return
	}
	base.RawQuery = ""
	base.Fragment = ""
	if base.Path == "" {
		base.Path = "/"
	}
	result := sitemap{Namespace: "http://www.sitemaps.org/schemas/sitemap/0.9", URLs: []sitemapURL{{Loc: base.String()}}}
	// shortcut: split into a sitemap index when the library exceeds 49,999 public memes.
	rows, err := s.db.Query(r.Context(), "SELECT id,updated_at FROM memes WHERE deleted_at IS NULL AND status='ready' ORDER BY id LIMIT 49999")
	if err != nil {
		internal(w)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id uuid.UUID
		var updated time.Time
		if err = rows.Scan(&id, &updated); err != nil {
			internal(w)
			return
		}
		target := *base
		target.RawQuery = url.Values{"meme": []string{id.String()}}.Encode()
		result.URLs = append(result.URLs, sitemapURL{Loc: target.String(), LastMod: updated.UTC().Format(time.RFC3339)})
	}
	if rows.Err() != nil {
		internal(w)
		return
	}
	data, err := xml.Marshal(result)
	if err != nil {
		internal(w)
		return
	}
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	_, _ = w.Write(append([]byte(xml.Header), data...))
}
