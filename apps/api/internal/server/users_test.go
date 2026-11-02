package server

import (
	"context"
	"encoding/json"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/noeulnight/memehub/apps/api/internal/config"
)

func TestAdminUserList(t *testing.T) {
	pool := testPool(t)
	issuer := newIssuer(t)
	app, err := New(context.Background(), config.Config{AppBaseURL: "http://localhost:4321", OIDCIssuer: issuer.server.URL, OIDCClientID: "test-client", OIDCRedirectURL: "http://localhost:4321/api/auth/callback", SessionTTL: time.Hour}, pool)
	if err != nil {
		t.Fatal(err)
	}
	h := app.Handler()
	member, _ := signIn(t, h, issuer, "member", false)
	admin, _ := signIn(t, h, issuer, "admin", false)
	signIn(t, h, issuer, "third", false)
	if _, err = pool.Exec(context.Background(), "UPDATE users SET is_admin=true WHERE oidc_subject='admin'"); err != nil {
		t.Fatal(err)
	}
	path := "/api/admin/users"
	mustStatus(t, request(t, h, "GET", path, nil, nil, ""), 401)
	mustStatus(t, request(t, h, "GET", path, nil, member, ""), 403)
	for _, q := range []string{"?limit=0", "?limit=101", "?cursor=invalid"} {
		mustStatus(t, request(t, h, "GET", path+q, nil, admin, ""), 400)
	}
	type page struct {
		Items []adminUser `json:"items"`
		Next  *string     `json:"next_cursor"`
	}
	first := request(t, h, "GET", path+"?limit=2", nil, admin, "")
	mustStatus(t, first, 200)
	for _, secret := range []string{"oidc_subject", "oidc_issuer", "session", "token"} {
		if strings.Contains(first.Body.String(), secret) {
			t.Fatalf("private field exposed: %s", secret)
		}
	}
	var a, b page
	if err = json.Unmarshal(first.Body.Bytes(), &a); err != nil || len(a.Items) != 2 || a.Next == nil {
		t.Fatalf("invalid page: %s", first.Body.String())
	}
	second := request(t, h, "GET", path+"?limit=2&cursor="+url.QueryEscape(*a.Next), nil, admin, "")
	mustStatus(t, second, 200)
	if err = json.Unmarshal(second.Body.Bytes(), &b); err != nil || len(b.Items) != 1 || b.Next != nil {
		t.Fatalf("invalid final page: %s", second.Body.String())
	}
	seen := map[string]bool{}
	admins := 0
	for _, u := range append(a.Items, b.Items...) {
		if seen[u.ID.String()] {
			t.Fatal("duplicate user")
		}
		seen[u.ID.String()] = true
		if u.IsAdmin {
			admins++
		}
		if u.CreatedAt.IsZero() {
			t.Fatal("missing joined date")
		}
	}
	if len(seen) != 3 || admins != 1 {
		t.Fatal("missing users or role")
	}
	if _, err = pool.Exec(context.Background(), "UPDATE users SET is_admin=false WHERE oidc_subject='admin'"); err != nil {
		t.Fatal(err)
	}
	mustStatus(t, request(t, h, "GET", path, nil, admin, ""), 403)
}
