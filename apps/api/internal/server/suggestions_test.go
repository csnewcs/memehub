package server

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/noeulnight/memehub/apps/api/internal/config"
)

func TestSearchSuggestions(t *testing.T) {
	pool := testPool(t)
	issuer := newIssuer(t)
	app, err := New(context.Background(), config.Config{AppBaseURL: "http://localhost:4321", OIDCIssuer: issuer.server.URL, OIDCClientID: "test-client", SessionTTL: time.Hour}, pool)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	var visible, deleted uuid.UUID
	for i := 0; i < 11; i++ {
		userID, memeID := uuid.New(), uuid.New()
		origin := issuer.server.URL
		if i == 10 {
			origin = "https://other-issuer.invalid"
		}
		if _, err = pool.Exec(ctx, `INSERT INTO users(id,oidc_issuer,oidc_subject,username,display_name) VALUES($1,$2,$3,$4,$5)`, userID, origin, fmt.Sprint(i), fmt.Sprintf("user%d", i), fmt.Sprintf("Person %d", i)); err != nil {
			t.Fatal(err)
		}
		if i == 8 {
			continue
		}
		if _, err = pool.Exec(ctx, `INSERT INTO memes(id,created_by,content_type,body_text,status) VALUES($1,$2,'text','body','ready')`, memeID, userID); err != nil {
			t.Fatal(err)
		}
		if i == 0 {
			visible = memeID
		}
		if i == 9 {
			deleted = memeID
			if _, err = pool.Exec(ctx, "UPDATE memes SET deleted_at=now() WHERE id=$1", memeID); err != nil {
				t.Fatal(err)
			}
		}
	}
	for i, name := range []string{"work", "work%literal", "work_literal", "workshop", "unused"} {
		tagID := uuid.New()
		if _, err = pool.Exec(ctx, "INSERT INTO tags(id,name,normalized_name) VALUES($1,$2,$2)", tagID, name); err != nil {
			t.Fatal(err)
		}
		if i == 4 {
			continue
		}
		memeID := visible
		if i == 3 {
			memeID = deleted
		}
		if _, err = pool.Exec(ctx, "INSERT INTO meme_tags(meme_id,tag_id,source) VALUES($1,$2,'user')", memeID, tagID); err != nil {
			t.Fatal(err)
		}
	}
	h := app.Handler()
	for _, query := range []string{"kind=bad", "kind=user&q=" + strings.Repeat("a", 201), "kind=tag&q=%00"} {
		mustStatus(t, request(t, h, "GET", "/api/search/suggestions?"+query, nil, nil, ""), 400)
	}
	for _, entry := range []struct {
		query string
		count int
		value string
	}{
		{"kind=user&q=user", 5, "user0"},
		{"kind=user&q=USER0", 1, "user0"},
		{"kind=user&q=Person+0", 1, "user0"},
		{"kind=user&q=user8", 0, ""},
		{"kind=user&q=user9", 0, ""},
		{"kind=user&q=user10", 0, ""},
		{"kind=tag&q=work", 3, "work"},
		{"kind=tag&q=work%25", 1, "work%literal"},
		{"kind=tag&q=work_", 1, "work_literal"},
		{"kind=tag&q=unused", 0, ""},
	} {
		response := request(t, h, "GET", "/api/search/suggestions?"+entry.query, nil, nil, "")
		mustStatus(t, response, 200)
		var result struct {
			Items []struct {
				Value string `json:"value"`
				Label string `json:"label"`
			} `json:"items"`
		}
		if err = json.Unmarshal(response.Body.Bytes(), &result); err != nil || len(result.Items) != entry.count {
			t.Fatalf("%s: wrong suggestion count", entry.query)
		}
		if entry.count > 0 && result.Items[0].Value != entry.value {
			t.Fatalf("%s: unexpected candidate", entry.query)
		}
	}
}
