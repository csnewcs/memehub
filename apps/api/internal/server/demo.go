package server

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *Server) demoUser(ctx context.Context, tx pgx.Tx) (uuid.UUID, error) {
	var userID uuid.UUID
	err := tx.QueryRow(ctx, `INSERT INTO users(id,oidc_issuer,oidc_subject,display_name,username,is_admin)
 VALUES($1,$2,'demo','데모 사용자','demo',true)
 ON CONFLICT(oidc_issuer,oidc_subject) DO UPDATE SET display_name=excluded.display_name,username=excluded.username,is_admin=true,updated_at=now() RETURNING id`, uuid.New(), s.cfg.OIDCIssuer).Scan(&userID)
	return userID, err
}

// Demo login issues ordinary sessions so authorization and CSRF checks remain active.
func (s *Server) demoLogin(w http.ResponseWriter, r *http.Request) {
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		internal(w)
		return
	}
	defer tx.Rollback(r.Context())
	userID, err := s.demoUser(r.Context(), tx)
	if err != nil {
		internal(w)
		return
	}
	if old, err := r.Cookie(sessionCookie); err == nil {
		if _, err = tx.Exec(r.Context(), "DELETE FROM sessions WHERE token_hash=$1", hash(old.Value)); err != nil {
			internal(w)
			return
		}
	}
	if _, err = tx.Exec(r.Context(), "DELETE FROM sessions WHERE expires_at<=now()"); err != nil {
		internal(w)
		return
	}
	rawSession, csrf := newToken(), newToken()
	if _, err = tx.Exec(r.Context(), "INSERT INTO sessions(token_hash,user_id,csrf_hash,expires_at) VALUES($1,$2,$3,$4)", hash(rawSession), userID, hash(csrf), time.Now().Add(s.cfg.SessionTTL)); err != nil {
		internal(w)
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		internal(w)
		return
	}
	s.cookie(w, sessionCookie, rawSession, "/api", s.cfg.SessionTTL, true)
	s.cookie(w, csrfCookie, csrf, "/", s.cfg.SessionTTL, false)
	http.Redirect(w, r, s.cfg.AppBaseURL+"/", http.StatusSeeOther)
}
