package server

import (
	"context"
	"encoding/xml"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/noeulnight/memehub/apps/api/internal/config"
)

func TestPublicSitemap(t *testing.T) {
	pool := testPool(t)
	issuer := newIssuer(t)
	app, err := New(context.Background(), config.Config{AppBaseURL: "https://memes.example", OIDCIssuer: issuer.server.URL, OIDCClientID: "client", SessionTTL: time.Hour}, pool)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	owner, visible, deleted, pending := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	if _, err = pool.Exec(ctx, "INSERT INTO users(id,oidc_issuer,oidc_subject) VALUES($1,'test','sitemap')", owner); err != nil {
		t.Fatal(err)
	}
	for _, id := range []uuid.UUID{visible, deleted} {
		if _, err = pool.Exec(ctx, "INSERT INTO memes(id,created_by,content_type,body_text,status) VALUES($1,$2,'text','body','ready')", id, owner); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = pool.Exec(ctx, "UPDATE memes SET deleted_at=now() WHERE id=$1", deleted); err != nil {
		t.Fatal(err)
	}
	if _, err = pool.Exec(ctx, "INSERT INTO memes(id,created_by,content_type,original_filename,original_object_key,status) VALUES($1,$2,'image','pending.png','pending','uploading')", pending, owner); err != nil {
		t.Fatal(err)
	}
	response := request(t, app.Handler(), "GET", "/api/sitemap.xml", nil, nil, "")
	mustStatus(t, response, 200)
	if !strings.HasPrefix(response.Header().Get("Content-Type"), "application/xml") {
		t.Fatal("invalid MIME")
	}
	var result sitemap
	if err = xml.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if len(result.URLs) != 2 || result.URLs[0].Loc != "https://memes.example/" || result.URLs[1].Loc != "https://memes.example/?meme="+visible.String() || result.URLs[1].LastMod == "" {
		t.Fatalf("invalid sitemap: %s", response.Body.String())
	}
}
