package server

import (
	"context"
	"encoding/json"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/noeulnight/memehub/apps/api/internal/config"
)

func TestTagList(t *testing.T) {
	pool := testPool(t)
	issuer := newIssuer(t)
	app, err := New(context.Background(), config.Config{AppBaseURL: "http://localhost:4321", OIDCIssuer: issuer.server.URL, OIDCClientID: "test-client", SessionTTL: time.Hour}, pool)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	owner := uuid.New()
	if _, err = pool.Exec(ctx, "INSERT INTO users(id,oidc_issuer,oidc_subject) VALUES($1,'test','tags')", owner); err != nil {
		t.Fatal(err)
	}
	visible := []uuid.UUID{uuid.New(), uuid.New()}
	deleted, pending := uuid.New(), uuid.New()
	for _, id := range append(visible, deleted) {
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
	tag := func(name string, memes ...uuid.UUID) {
		t.Helper()
		id := uuid.New()
		if _, err = pool.Exec(ctx, "INSERT INTO tags(id,name,normalized_name) VALUES($1,$2,$2)", id, name); err != nil {
			t.Fatal(err)
		}
		for _, m := range memes {
			if _, err = pool.Exec(ctx, "INSERT INTO meme_tags(meme_id,tag_id,source) VALUES($1,$2,'user')", m, id); err != nil {
				t.Fatal(err)
			}
		}
	}
	tag("Popular", visible[0], visible[1], deleted, pending)
	tag("literal%tag", visible[0])
	tag("literal_tag", visible[1])
	tag("hidden", deleted, pending)
	tag("unused")
	h := app.Handler()
	type page struct {
		Items []tagListItem `json:"items"`
		Next  *string       `json:"next_cursor"`
	}
	read := func(path string) page {
		t.Helper()
		r := request(t, h, "GET", path, nil, nil, "")
		mustStatus(t, r, 200)
		var p page
		if err = json.Unmarshal(r.Body.Bytes(), &p); err != nil {
			t.Fatal(err)
		}
		return p
	}
	all := read("/api/tags")
	if len(all.Items) != 3 || all.Items[0].Name != "Popular" || all.Items[0].MemeCount != 2 {
		t.Fatalf("visibility/count/order failed: %+v", all)
	}
	seen := map[uuid.UUID]bool{}
	next := "/api/tags?limit=1"
	for i := 0; i < 4; i++ {
		p := read(next)
		if len(p.Items) != 1 || seen[p.Items[0].ID] {
			t.Fatalf("invalid page: %+v", p)
		}
		seen[p.Items[0].ID] = true
		if p.Next == nil {
			break
		}
		next = "/api/tags?limit=1&cursor=" + url.QueryEscape(*p.Next)
	}
	if len(seen) != 3 {
		t.Fatal("pagination missed tags")
	}
	for query, want := range map[string]string{"POPULAR": "Popular", "Pop ular": "Popular", "%": "literal%tag", "_": "literal_tag"} {
		p := read("/api/tags?q=" + url.QueryEscape(query))
		if len(p.Items) != 1 || p.Items[0].Name != want {
			t.Fatalf("literal/case search failed: %+v", p)
		}
	}
	if len(read("/api/tags?q=unused").Items) != 0 {
		t.Fatal("unused tag exposed")
	}
	for _, query := range []string{"limit=0", "limit=101", "cursor=invalid", "q=%00", "q=" + strings.Repeat("a", 201)} {
		mustStatus(t, request(t, h, "GET", "/api/tags?"+query, nil, nil, ""), 400)
	}
}
