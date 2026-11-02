package server

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/oauth2"
)

const sessionCookie = "memehub_session"
const csrfCookie = "memehub_csrf"
const flowCookie = "memehub_login"

type session struct {
	UserID   uuid.UUID
	CSRFHash string
	IsAdmin  bool
}

func newToken() string {
	var value [32]byte
	_, _ = rand.Read(value[:])
	return base64.RawURLEncoding.EncodeToString(value[:])
}
func hash(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}
func (s *Server) cookie(w http.ResponseWriter, name, value, path string, ttl time.Duration, httpOnly bool) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: value, Path: path, HttpOnly: httpOnly, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode, MaxAge: int(ttl.Seconds()), Expires: time.Now().Add(ttl)})
}
func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	state, nonce, verifier := newToken(), newToken(), oauth2.GenerateVerifier()
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		internal(w)
		return
	}
	defer tx.Rollback(r.Context())
	if _, err = tx.Exec(r.Context(), "DELETE FROM login_flows WHERE expires_at <= now()"); err != nil {
		internal(w)
		return
	}
	if _, err = tx.Exec(r.Context(), "INSERT INTO login_flows(state_hash,nonce,code_verifier,expires_at) VALUES($1,$2,$3,$4)", hash(state), nonce, verifier, time.Now().Add(10*time.Minute)); err != nil {
		internal(w)
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		internal(w)
		return
	}
	s.cookie(w, flowCookie, state, "/api/auth/callback", 10*time.Minute, true)
	http.Redirect(w, r, s.oauth.AuthCodeURL(state, oidc.Nonce(nonce), oauth2.S256ChallengeOption(verifier)), http.StatusFound)
}
func (s *Server) callback(w http.ResponseWriter, r *http.Request) {
	state, code := r.URL.Query().Get("state"), r.URL.Query().Get("code")
	cookie, err := r.Cookie(flowCookie)
	if err != nil || len(state) != 43 || code == "" || subtle.ConstantTimeCompare([]byte(state), []byte(cookie.Value)) != 1 {
		problem(w, 400, "invalid_login_state")
		return
	}
	var nonce, verifier string
	err = s.db.QueryRow(r.Context(), "DELETE FROM login_flows WHERE state_hash=$1 AND expires_at>now() RETURNING nonce,code_verifier", hash(state)).Scan(&nonce, &verifier)
	if errors.Is(err, pgx.ErrNoRows) {
		problem(w, 400, "invalid_login_state")
		return
	}
	if err != nil {
		internal(w)
		return
	}
	s.cookie(w, flowCookie, "", "/api/auth/callback", -time.Second, true)
	ctx := oidc.ClientContext(r.Context(), s.client)
	token, err := s.oauth.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		problem(w, 401, "oidc_exchange_failed")
		return
	}
	raw, ok := token.Extra("id_token").(string)
	if !ok {
		problem(w, 401, "id_token_required")
		return
	}
	id, err := s.verifier.Verify(ctx, raw)
	if err != nil || id.Subject == "" || id.Nonce != nonce {
		problem(w, 401, "invalid_id_token")
		return
	}
	var claims struct {
		Name            string `json:"name"`
		Username        string `json:"preferred_username"`
		AuthorizedParty string `json:"azp"`
	}
	if err = id.Claims(&claims); err != nil || (len(id.Audience) > 1 && claims.AuthorizedParty == "") || (claims.AuthorizedParty != "" && claims.AuthorizedParty != s.cfg.OIDCClientID) {
		problem(w, 401, "invalid_id_token")
		return
	}
	username := strings.TrimSpace(claims.Username)
	if !validUsername(username) {
		username = ""
	}
	rawSession, csrf := newToken(), newToken()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		internal(w)
		return
	}
	defer tx.Rollback(ctx)
	var userID uuid.UUID
	err = tx.QueryRow(ctx, `INSERT INTO users(id,oidc_issuer,oidc_subject,display_name,username) VALUES($1,$2,$3,$4,$5)
 ON CONFLICT(oidc_issuer,oidc_subject) DO UPDATE SET display_name=excluded.display_name,username=excluded.username,updated_at=now() RETURNING id`, uuid.New(), id.Issuer, id.Subject, claims.Name, nullable(username)).Scan(&userID)
	if err != nil {
		internal(w)
		return
	}
	if old, err := r.Cookie(sessionCookie); err == nil {
		if _, err = tx.Exec(ctx, "DELETE FROM sessions WHERE token_hash=$1", hash(old.Value)); err != nil {
			internal(w)
			return
		}
	}
	if _, err = tx.Exec(ctx, "DELETE FROM sessions WHERE expires_at<=now()"); err != nil {
		internal(w)
		return
	}
	if _, err = tx.Exec(ctx, "INSERT INTO sessions(token_hash,user_id,csrf_hash,expires_at) VALUES($1,$2,$3,$4)", hash(rawSession), userID, hash(csrf), time.Now().Add(s.cfg.SessionTTL)); err != nil {
		internal(w)
		return
	}
	if err = tx.Commit(ctx); err != nil {
		internal(w)
		return
	}
	s.cookie(w, sessionCookie, rawSession, "/api", s.cfg.SessionTTL, true)
	s.cookie(w, csrfCookie, csrf, "/", s.cfg.SessionTTL, false)
	http.Redirect(w, r, s.cfg.AppBaseURL+"/", http.StatusSeeOther)
}
func (s *Server) authenticate(w http.ResponseWriter, r *http.Request, mutate bool) (session, bool) {
	var sess session
	cookie, err := r.Cookie(sessionCookie)
	if err != nil || len(cookie.Value) != 43 {
		problem(w, 401, "login_required")
		return sess, false
	}
	err = s.db.QueryRow(r.Context(), "SELECT s.user_id,s.csrf_hash,u.is_admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()", hash(cookie.Value)).Scan(&sess.UserID, &sess.CSRFHash, &sess.IsAdmin)
	if errors.Is(err, pgx.ErrNoRows) {
		problem(w, 401, "login_required")
		return sess, false
	}
	if err != nil {
		internal(w)
		return sess, false
	}
	if mutate {
		token := r.Header.Get("X-CSRF-Token")
		if r.Header.Get("Origin") != s.cfg.AppBaseURL || len(token) != 43 || subtle.ConstantTimeCompare([]byte(hash(token)), []byte(sess.CSRFHash)) != 1 {
			problem(w, 403, "invalid_csrf_token")
			return sess, false
		}
	}
	return sess, true
}
func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	sess, ok := s.authenticate(w, r, false)
	if !ok {
		return
	}
	var name, username *string
	if err := s.db.QueryRow(r.Context(), "SELECT display_name,username FROM users WHERE id=$1", sess.UserID).Scan(&name, &username); err != nil {
		internal(w)
		return
	}
	writeJSON(w, 200, map[string]any{"id": sess.UserID, "display_name": name, "username": username, "is_admin": sess.IsAdmin})
}
func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	_, ok := s.authenticate(w, r, true)
	if !ok {
		return
	}
	cookie, _ := r.Cookie(sessionCookie)
	if _, err := s.db.Exec(r.Context(), "DELETE FROM sessions WHERE token_hash=$1", hash(cookie.Value)); err != nil {
		internal(w)
		return
	}
	s.cookie(w, sessionCookie, "", "/api", -time.Second, true)
	s.cookie(w, csrfCookie, "", "/", -time.Second, false)
	w.WriteHeader(http.StatusNoContent)
}
