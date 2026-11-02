package server

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/noeulnight/memehub/apps/api/internal/cleanup"
)

type cleanupStore struct {
	keys map[string]bool
	fail bool
}

func (s *cleanupStore) Delete(_ context.Context, key string) error {
	if s.fail {
		return errors.New("storage failed")
	}
	s.keys[key] = true
	return nil
}
func TestCleanupRetentionAndRetry(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	owner := uuid.New()
	if _, err := pool.Exec(ctx, "INSERT INTO users(id,oidc_issuer,oidc_subject) VALUES($1,'test','cleanup')", owner); err != nil {
		t.Fatal(err)
	}
	seed := func(age string, deleted bool) uuid.UUID {
		t.Helper()
		id := uuid.New()
		_, err := pool.Exec(ctx, `INSERT INTO memes(id,created_by,content_type,status,original_filename,original_object_key,updated_at,deleted_at) VALUES($1,$5,'image','uploading','test.png',$2,now()-$3::interval,CASE WHEN $4 THEN now()-$3::interval ELSE NULL END)`, id, "original/"+id.String(), age, deleted, owner)
		if err != nil {
			t.Fatal(err)
		}
		return id
	}
	old := seed("8 days", true)
	abandoned := seed("25 hours", false)
	recent := seed("1 hour", false)
	retained := seed("1 day", true)
	store := &cleanupStore{keys: map[string]bool{}, fail: true}
	worker := cleanup.Worker{DB: pool, Store: store, DeletedRetention: 7 * 24 * time.Hour, UploadRetention: 24 * time.Hour}
	if worked, err := worker.RunOne(ctx); !worked || err == nil {
		t.Fatal("expected storage failure")
	}
	var delayed bool
	if err := pool.QueryRow(ctx, "SELECT cleanup_after>now() AND objects_deleted_at IS NULL FROM memes WHERE id=$1", old).Scan(&delayed); err != nil || !delayed {
		t.Fatalf("missing retry delay: %v", err)
	}
	store.fail = false
	if worked, err := worker.RunOne(ctx); !worked || err != nil {
		t.Fatalf("other candidate blocked: %v", err)
	}
	if !store.keys["original/"+abandoned.String()] {
		t.Fatal("abandoned upload not cleaned")
	}
	if _, err := pool.Exec(ctx, "UPDATE memes SET cleanup_after=now()-interval '1 second' WHERE id=$1", old); err != nil {
		t.Fatal(err)
	}
	if worked, err := worker.RunOne(ctx); !worked || err != nil {
		t.Fatal(err)
	}
	if worked, err := worker.RunOne(ctx); worked || err != nil {
		t.Fatalf("recent file selected: %v", err)
	}
	for _, id := range []uuid.UUID{old, abandoned} {
		for _, key := range []string{"original/" + id.String(), "staging/" + id.String(), "thumbnails/" + id.String() + ".png", "previews/" + id.String() + ".webp"} {
			if !store.keys[key] {
				t.Errorf("key not deleted: %s", key)
			}
		}
		var cleaned bool
		if err := pool.QueryRow(ctx, "SELECT objects_deleted_at IS NOT NULL AND deleted_at IS NOT NULL FROM memes WHERE id=$1", id).Scan(&cleaned); err != nil || !cleaned {
			t.Fatal("cleanup not recorded")
		}
	}
	for _, id := range []uuid.UUID{recent, retained} {
		if store.keys["original/"+id.String()] {
			t.Fatal("retained object deleted")
		}
	}
	// Stored retention overrides the process defaults without a restart.
	override := seed("3 hours", false)
	if _, err := pool.Exec(ctx, "UPDATE admin_settings SET incomplete_upload_retention_hours=2 WHERE singleton"); err != nil {
		t.Fatal(err)
	}
	if worked, err := worker.RunOne(ctx); !worked || err != nil {
		t.Fatalf("stored retention ignored: %v", err)
	}
	if !store.keys["original/"+override.String()] {
		t.Fatal("override candidate not cleaned")
	}

}
