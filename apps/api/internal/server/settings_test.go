package server

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/noeulnight/memehub/apps/api/internal/config"
)

func TestAdminSettings(t *testing.T) {
	pool := testPool(t)
	issuer := newIssuer(t)
	cfg := config.Config{AppBaseURL: "http://localhost:4321", OIDCIssuer: issuer.server.URL, OIDCClientID: "test-client", OIDCRedirectURL: "http://localhost:4321/api/auth/callback", SessionTTL: time.Hour, TextMaxLength: 10000, OpenAIModel: "test-model", DeletedImageRetention: 7 * 24 * time.Hour, IncompleteUploadRetention: 24 * time.Hour}
	app, err := New(context.Background(), cfg, pool)
	if err != nil {
		t.Fatal(err)
	}
	h := app.Handler()
	member, memberCSRF := signIn(t, h, issuer, "member", false)
	admin, csrf := signIn(t, h, issuer, "admin", false)
	if _, err = pool.Exec(context.Background(), "UPDATE users SET is_admin=true WHERE oidc_subject='admin'"); err != nil {
		t.Fatal(err)
	}
	path := "/api/admin/settings"
	mustStatus(t, request(t, h, "GET", path, nil, nil, ""), 401)
	mustStatus(t, request(t, h, "GET", path, nil, member, ""), 403)
	get := request(t, h, "GET", path, nil, admin, "")
	mustStatus(t, get, 200)
	var value adminSettings
	if err = json.Unmarshal(get.Body.Bytes(), &value); err != nil {
		t.Fatal(err)
	}
	if value.Model != "test-model" || value.DeletedDays != 7 || value.UploadHours != 24 || value.Revision == nil {
		t.Fatalf("incorrect defaults: %+v", value)
	}
	value.Model = "gpt-test-new"
	value.DeletedDays = 14
	value.UploadHours = 48
	mustStatus(t, request(t, h, "PUT", path, value, member, memberCSRF), 403)
	mustStatus(t, request(t, h, "PUT", path, value, admin, ""), 403)
	invalid := value
	invalid.UploadHours = 1
	mustStatus(t, request(t, h, "PUT", path, invalid, admin, csrf), 422)
	invalid = value
	invalid.Model = "https://invalid model"
	mustStatus(t, request(t, h, "PUT", path, invalid, admin, csrf), 422)
	saved := request(t, h, "PUT", path, value, admin, csrf)
	mustStatus(t, saved, 200)
	mustStatus(t, request(t, h, "PUT", path, value, admin, csrf), 409)
	var persisted adminSettings
	if err = json.Unmarshal(request(t, h, "GET", path, nil, admin, "").Body.Bytes(), &persisted); err != nil {
		t.Fatal(err)
	}
	if persisted.Model != value.Model || persisted.DeletedDays != 14 || persisted.UploadHours != 48 || *persisted.Revision != 1 {
		t.Fatalf("not persisted: %+v", persisted)
	}
	created := request(t, h, "POST", "/api/memes", map[string]any{"content_type": "text", "body_text": "settings test"}, member, memberCSRF)
	mustStatus(t, created, 201)
	var meme Meme
	if err = json.Unmarshal(created.Body.Bytes(), &meme); err != nil {
		t.Fatal(err)
	}
	var model string
	if err = pool.QueryRow(context.Background(), "SELECT requested_model FROM jobs WHERE meme_id=$1", meme.ID).Scan(&model); err != nil || model != value.Model {
		t.Fatalf("new model not used: %s %v", model, err)
	}
	mustStatus(t, request(t, h, "GET", "/api/admin/memes", nil, member, ""), 403)
	mustStatus(t, request(t, h, "GET", "/api/admin/memes?analysis_status=invalid", nil, admin, ""), 400)
	page := request(t, h, "GET", "/api/admin/memes?analysis_status=queued", nil, admin, "")
	mustStatus(t, page, 200)
	var result struct {
		Items []Meme `json:"items"`
	}
	if err = json.Unmarshal(page.Body.Bytes(), &result); err != nil || len(result.Items) != 1 {
		t.Fatalf("filter failed: %s", page.Body.String())
	}
	if _, err = pool.Exec(context.Background(), "UPDATE jobs SET status='failed' WHERE meme_id=$1", meme.ID); err != nil {
		t.Fatal(err)
	}
	retry := request(t, h, "POST", "/api/admin/memes/"+meme.ID.String()+"/analyses", map[string]any{"content_revision": 0}, admin, csrf)
	mustStatus(t, retry, 202)
	if err = pool.QueryRow(context.Background(), "SELECT requested_model FROM jobs WHERE meme_id=$1 AND status='queued'", meme.ID).Scan(&model); err != nil || model != value.Model {
		t.Fatal("retry model not used")
	}
	// Revoking the database role takes effect for an existing session.
	if _, err = pool.Exec(context.Background(), "UPDATE users SET is_admin=false WHERE oidc_subject='admin'"); err != nil {
		t.Fatal(err)
	}
	mustStatus(t, request(t, h, "GET", path, nil, admin, ""), 403)
	mustStatus(t, request(t, h, "PUT", path, persisted, admin, csrf), 403)
}
