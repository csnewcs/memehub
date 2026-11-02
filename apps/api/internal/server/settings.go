package server

import (
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type adminSettings struct {
	Model       string `json:"openai_model"`
	DeletedDays int    `json:"deleted_image_retention_days"`
	UploadHours int    `json:"incomplete_upload_retention_hours"`
	Revision    *int64 `json:"revision"`
}

var modelName = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$`)

func (s *Server) readSettings(w http.ResponseWriter, r *http.Request) {
	if !s.adminSession(w, r, false) {
		return
	}
	var value adminSettings
	err := s.db.QueryRow(r.Context(), `SELECT COALESCE(openai_model,$1),COALESCE(deleted_image_retention_days,$2),COALESCE(incomplete_upload_retention_hours,$3),revision FROM admin_settings WHERE singleton`, s.cfg.OpenAIModel, int(s.cfg.DeletedImageRetention/(24*time.Hour)), int(s.cfg.IncompleteUploadRetention/time.Hour)).Scan(&value.Model, &value.DeletedDays, &value.UploadHours, &value.Revision)
	if err != nil {
		internal(w)
		return
	}
	writeJSON(w, 200, value)
}
func (s *Server) updateSettings(w http.ResponseWriter, r *http.Request) {
	session, ok := s.authenticate(w, r, true)
	if !ok {
		return
	}
	if !session.IsAdmin {
		problem(w, 403, "admin_required")
		return
	}
	var value adminSettings
	if !decodeJSON(w, r, &value) {
		return
	}
	value.Model = strings.TrimSpace(value.Model)
	if !modelName.MatchString(value.Model) || value.DeletedDays < 1 || value.DeletedDays > 365 || value.UploadHours < 2 || value.UploadHours > 168 || value.Revision == nil {
		problem(w, 422, "invalid_settings")
		return
	}
	var revision int64
	err := s.db.QueryRow(r.Context(), `UPDATE admin_settings SET openai_model=$1,deleted_image_retention_days=$2,incomplete_upload_retention_hours=$3,revision=revision+1,updated_by=$4,updated_at=now() WHERE singleton AND revision=$5 RETURNING revision`, value.Model, value.DeletedDays, value.UploadHours, session.UserID, *value.Revision).Scan(&revision)
	if errors.Is(err, pgx.ErrNoRows) {
		problem(w, 409, "settings_revision_conflict")
		return
	}
	if err != nil {
		internal(w)
		return
	}
	value.Revision = &revision
	writeJSON(w, 200, value)
}
