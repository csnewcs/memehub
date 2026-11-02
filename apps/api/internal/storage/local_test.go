package storage

import (
	"bytes"
	"context"
	"io"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/noeulnight/memehub/apps/api/internal/config"
)

func TestLocalStorage(t *testing.T) {
	cfg := config.Config{DemoMode: true, Env: "test", DemoDataDir: t.TempDir(), AppBaseURL: "http://localhost:4321", S3TTL: time.Minute, UploadMaxBytes: 100}
	s, err := NewLocal(cfg)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	data := []byte("demo bytes")
	upload, err := s.UploadURL(ctx, "staging/demo", "image/png", int64(len(data)))
	if err != nil {
		t.Fatal(err)
	}
	call := func(method, target string, data []byte, mime string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, target, bytes.NewReader(data))
		r.Header.Set("Content-Type", mime)
		w := httptest.NewRecorder()
		s.LocalHandler().ServeHTTP(w, r)
		return w
	}
	if w := call("PUT", upload.URL, data, "image/png"); w.Code != 200 {
		t.Fatalf("upload: %d %s", w.Code, w.Body.String())
	}
	if w := call("PUT", upload.URL, append(data, 'x'), "image/png"); w.Code != 400 {
		t.Fatalf("oversized upload: %d", w.Code)
	}
	if w := call("PUT", upload.URL, data[:1], "image/png"); w.Code != 400 {
		t.Fatalf("short upload: %d", w.Code)
	}
	if w := call("PUT", upload.URL, data, "image/jpeg"); w.Code != 400 {
		t.Fatalf("MIME mismatch: %d", w.Code)
	}
	if w := call("GET", upload.URL, nil, ""); w.Code != 403 {
		t.Fatalf("method tampering: %d", w.Code)
	}
	u, _ := url.Parse(upload.URL)
	q := u.Query()
	q.Set("size", "1")
	u.RawQuery = q.Encode()
	if w := call("PUT", u.String(), data[:1], "image/png"); w.Code != 403 {
		t.Fatalf("size tampering: %d", w.Code)
	}
	if _, err := s.UploadURL(ctx, "originals/demo", "image/png", 1); err == nil {
		t.Fatal("allowed original overwrite URL")
	}
	if err := s.Put(ctx, "originals/demo", "image/png", data); err != nil {
		t.Fatal(err)
	}
	read, err := s.ReadURL(ctx, "originals/demo")
	if err != nil {
		t.Fatal(err)
	}
	if w := call("GET", read.URL, nil, ""); w.Code != 200 || !bytes.Equal(w.Body.Bytes(), data) {
		t.Fatalf("read: %d %s", w.Code, w.Body.String())
	}
	if w := call("GET", "http://localhost:4321/api/demo/storage/originals/demo", nil, ""); w.Code != 403 {
		t.Fatalf("unsigned read: %d", w.Code)
	}
	s.local.ttl = -time.Minute
	expired, _ := s.ReadURL(ctx, "originals/demo")
	if w := call("GET", expired.URL, nil, ""); w.Code != 403 {
		t.Fatalf("expired URL: %d", w.Code)
	}
	// Objects survive a restart; previously issued URLs intentionally do not.
	reopened, err := NewLocal(cfg)
	if err != nil {
		t.Fatal(err)
	}
	body, err := reopened.Read(ctx, "originals/demo")
	if err != nil {
		t.Fatal(err)
	}
	got, err := io.ReadAll(body)
	body.Close()
	if err != nil || !bytes.Equal(got, data) {
		t.Fatal("object was not persisted")
	}
	if err := s.Delete(ctx, "staging/demo"); err != nil {
		t.Fatal(err)
	}
	if err := s.Delete(ctx, "staging/demo"); err != nil {
		t.Fatal("delete must be idempotent", err)
	}
	for _, key := range []string{"../outside", "/absolute", "a/../../outside", "a\\outside"} {
		if err := s.Put(ctx, key, "image/png", data); err == nil {
			t.Fatalf("accepted unsafe key %q", key)
		}
		if _, err := s.Read(ctx, key); err == nil {
			t.Fatalf("read unsafe key %q", key)
		}
		if err := s.Delete(ctx, key); err == nil {
			t.Fatalf("deleted unsafe key %q", key)
		}
	}
	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "private"), []byte("secret"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(cfg.DemoDataDir, "escape")); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Read(ctx, "escape/private"); err == nil {
		t.Fatal("read escaped through symlink")
	}
	if err := s.Put(ctx, "escape/private", "image/png", data); err == nil {
		t.Fatal("write escaped through symlink")
	}
	if err := s.Delete(ctx, "escape/private"); err == nil {
		t.Fatal("delete escaped through symlink")
	}
}

func TestLocalStorageRejectsNonDemo(t *testing.T) {
	for _, cfg := range []config.Config{{Env: "development"}, {DemoMode: true, Env: "production"}} {
		if _, err := NewLocal(cfg); err == nil {
			t.Fatal("accepted local storage outside development/test demo mode")
		}
	}
}
