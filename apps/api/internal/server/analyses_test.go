package server

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/noeulnight/memehub/apps/api/internal/config"
)

func TestAdminAnalysisRetry(t *testing.T) {
	pool := testPool(t)
	issuer := newIssuer(t)
	app, err := New(context.Background(), config.Config{AppBaseURL: "http://localhost:4321", OIDCIssuer: issuer.server.URL, OIDCClientID: "test-client", OIDCRedirectURL: "http://localhost:4321/api/auth/callback", SessionTTL: time.Hour, TextMaxLength: 10000, OpenAIModel: "test-model"}, pool)
	if err != nil {
		t.Fatal(err)
	}
	h := app.Handler()
	owner, csrf := signIn(t, h, issuer, "author", false)
	admin, adminCSRF := signIn(t, h, issuer, "admin", false)
	if _, err = pool.Exec(context.Background(), "UPDATE users SET is_admin=true WHERE oidc_subject='admin'"); err != nil {
		t.Fatal(err)
	}
	created := request(t, h, "POST", "/api/memes", map[string]any{"content_type": "text", "body_text": "Test analysis"}, owner, csrf)
	mustStatus(t, created, 201)
	var meme Meme
	if err = json.Unmarshal(created.Body.Bytes(), &meme); err != nil {
		t.Fatal(err)
	}
	path := "/api/admin/memes/" + meme.ID.String() + "/analyses"
	mustStatus(t, request(t, h, "GET", path, nil, nil, ""), 401)
	mustStatus(t, request(t, h, "GET", path, nil, owner, ""), 403)
	body := map[string]any{"content_revision": 0}
	mustStatus(t, request(t, h, "POST", path, body, owner, csrf), 403)
	mustStatus(t, request(t, h, "POST", path, body, admin, ""), 403)
	mustStatus(t, request(t, h, "POST", path, body, admin, adminCSRF), 409)
	if _, err = pool.Exec(context.Background(), "UPDATE jobs SET status='failed',error_code='provider_failed' WHERE meme_id=$1", meme.ID); err != nil {
		t.Fatal(err)
	}
	mustStatus(t, request(t, h, "POST", path, map[string]any{"content_revision": 1}, admin, adminCSRF), 409)
	list := request(t, h, "GET", path, nil, admin, "")
	mustStatus(t, list, 200)
	var status struct {
		Items []map[string]any `json:"items"`
	}
	if err = json.Unmarshal(list.Body.Bytes(), &status); err != nil || len(status.Items) != 1 {
		t.Fatalf("invalid jobs: %s", list.Body.String())
	}
	if _, ok := status.Items[0]["result"]; ok {
		t.Fatal("raw result exposed")
	}
	mustStatus(t, request(t, h, "POST", path, body, admin, adminCSRF), 202)
	mustStatus(t, request(t, h, "POST", path, body, admin, adminCSRF), 409)
}
