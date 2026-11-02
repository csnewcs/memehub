package config

import (
	"strings"
	"testing"
)

func TestConfigurationValidation(t *testing.T) {
	baseline := map[string]string{"APP_ENV": "development", "HTTP_ADDR": "127.0.0.1:8080", "DATABASE_URL": "postgres://local:secret@localhost/memehub", "APP_BASE_URL": "http://localhost:4321", "OIDC_ISSUER_URL": "https://id.example.com", "OIDC_CLIENT_ID": "memehub", "OIDC_REDIRECT_URL": "http://localhost:4321/api/auth/callback", "OPENAI_MODEL": "configured-model", "SESSION_COOKIE_SECURE": "false", "SESSION_TTL_SECONDS": "604800", "TEXT_MAX_LENGTH": "10000"}
	for _, tc := range []struct {
		name, key, value string
		wantError        bool
	}{
		{name: "valid"},
		{"invalid database", "DATABASE_URL", "postgres://secret@", true},
		{"cross origin callback", "OIDC_REDIRECT_URL", "https://evil.example/api/auth/callback", true},
		{"insecure production", "APP_ENV", "production", true},
		{"invalid boolean", "SESSION_COOKIE_SECURE", "maybe", true},
		{"unbounded session", "SESSION_TTL_SECONDS", "999999999999", true},
		{"missing model", "OPENAI_MODEL", "", true},
		{"invalid text limit", "TEXT_MAX_LENGTH", "-1", true},
		{"invalid upload limit", "UPLOAD_MAX_BYTES", "52428801", true},
		{"unsupported image type", "UPLOAD_ALLOWED_MIME_TYPES", "image/svg+xml", true},
		{"excessive signed URL lifetime", "S3_PRESIGN_TTL_SECONDS", "86400", true},
		{"storage without credentials", "S3_ENDPOINT", "http://localhost:9000", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			values := map[string]string{}
			for k, v := range baseline {
				values[k] = v
			}
			if tc.key != "" {
				values[tc.key] = tc.value
			}
			_, err := Parse(func(key string) string { return values[key] })
			if (err != nil) != tc.wantError {
				t.Fatalf("unexpected validation result: %v", err)
			}
			if err != nil && strings.Contains(err.Error(), "secret") {
				t.Fatal("configuration error exposed a secret")
			}
		})
	}
}
