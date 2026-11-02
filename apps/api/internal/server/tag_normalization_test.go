package server

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestTagMergePreservesAssociations(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "ALTER TABLE tags DROP CONSTRAINT tags_no_whitespace"); err != nil {
		t.Fatal(err)
	}
	owner, m1, m2 := uuid.New(), uuid.New(), uuid.New()
	if _, err = tx.Exec(ctx, "INSERT INTO users(id,oidc_issuer,oidc_subject) VALUES($1,'test','merge')", owner); err != nil {
		t.Fatal(err)
	}
	for _, id := range []uuid.UUID{m1, m2} {
		if _, err = tx.Exec(ctx, "INSERT INTO memes(id,created_by,content_type,body_text,status) VALUES($1,$2,'text','body','ready')", id, owner); err != nil {
			t.Fatal(err)
		}
	}
	spaced, canonical, unicode := uuid.New(), uuid.New(), uuid.New()
	for id, name := range map[uuid.UUID]string{spaced: "반응 짤", canonical: "반응짤", unicode: "반응\u00a0짤"} {
		if _, err = tx.Exec(ctx, "INSERT INTO tags(id,name,normalized_name) VALUES($1,$2,$2)", id, name); err != nil {
			t.Fatal(err)
		}
	}
	for _, entry := range []struct {
		m, tag uuid.UUID
		source string
	}{{m1, spaced, "user"}, {m1, canonical, "ai"}, {m2, spaced, "ai"}, {m2, unicode, "ai"}} {
		if _, err = tx.Exec(ctx, "INSERT INTO meme_tags(meme_id,tag_id,source) VALUES($1,$2,$3)", entry.m, entry.tag, entry.source); err != nil {
			t.Fatal(err)
		}
	}
	migration, err := os.ReadFile("../database/migrations/20261102141929_normalize_tag_whitespace.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = tx.Exec(ctx, strings.Split(string(migration), "-- +goose Down")[0]); err != nil {
		t.Fatal(err)
	}
	var tags, links int
	if err = tx.QueryRow(ctx, "SELECT count(*) FROM tags").Scan(&tags); err != nil || tags != 1 {
		t.Fatalf("tags not merged: %d %v", tags, err)
	}
	if err = tx.QueryRow(ctx, "SELECT count(*) FROM meme_tags WHERE tag_id=$1", canonical).Scan(&links); err != nil || links != 2 {
		t.Fatalf("connections lost: %d %v", links, err)
	}
	var source, name, key string
	if err = tx.QueryRow(ctx, "SELECT source FROM meme_tags WHERE meme_id=$1 AND tag_id=$2", m1, canonical).Scan(&source); err != nil || source != "user" {
		t.Fatal("user attribution lost")
	}
	if err = tx.QueryRow(ctx, "SELECT name,normalized_name FROM tags WHERE id=$1", canonical).Scan(&name, &key); err != nil || name != "반응짤" || key != "반응짤" {
		t.Fatal("canonical name not retained")
	}
	var bumped int
	if err = tx.QueryRow(ctx, "SELECT count(*) FROM memes WHERE content_revision=1").Scan(&bumped); err != nil || bumped != 2 {
		t.Fatal("edit versions not updated")
	}
}
func TestTagInputNormalization(t *testing.T) {
	s := &Server{}
	input := memeInput{ContentType: "image", Tags: []string{" 반응 짤 ", "반응짤", "반응\u00a0짤", "Work Life", "worklife"}}
	if problem := s.validateMeme(&input); problem != "" {
		t.Fatal(problem)
	}
	if len(input.Tags) != 2 || input.Tags[0] != "반응짤" || input.Tags[1] != "WorkLife" {
		t.Fatalf("normalization failed: %v", input.Tags)
	}
}
